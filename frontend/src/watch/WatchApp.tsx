import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent } from 'react';
import './WatchApp.css';
import { kit, getAvailableWallets, classifyError } from '../lib/wallet';
import { CONTRACT_ID } from '../lib/contract';
import { fetchWatchEvents, getLatestLedger } from './lib/sorobanWatch';
import { evaluateNewEvent, type AlertRule, type FiredAlert } from './lib/alertRules';
import type { WatchEvent } from './types';
import EventFeedPanel from './components/EventFeedPanel';
import AnalyticsPanel from './components/AnalyticsPanel';
import AlertsPanel from './components/AlertsPanel';
import SimulatorPanel from './components/SimulatorPanel';
import ProfileMenu from '../ProfileMenu';
import FeedbackButton from '../FeedbackButton';
import TopNav from '../TopNav';
import { useLanguage, translateAppError } from '../i18n/useLanguage';
import type { TranslationKey } from '../i18n/translations';
import { IconAlert, IconBarChart, IconFlask, IconRadar } from '../icons';

type Tab = 'feed' | 'analytics' | 'alerts' | 'simulator';

const TABS: { id: Tab; labelKey: TranslationKey; icon: ComponentType<{ size?: number }> }[] = [
  { id: 'feed', labelKey: 'watchTabFeed', icon: IconRadar },
  { id: 'analytics', labelKey: 'watchTabAnalytics', icon: IconBarChart },
  { id: 'alerts', labelKey: 'watchTabAlerts', icon: IconAlert },
  { id: 'simulator', labelKey: 'watchTabSimulator', icon: IconFlask },
];

// A lookback window that stays comfortably inside testnet's event retention.
const EVENT_LOOKBACK_LEDGERS = 400;
const MAX_EVENTS = 300;
const RULES_STORAGE_KEY = 'sentinel-watch-rules-v1';

function loadRules(): AlertRule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map((r) =>
      r.kind === 'threshold' ? ({ ...r, thresholdStroops: BigInt(r.thresholdStroops as string) } as unknown as AlertRule) : (r as unknown as AlertRule),
    );
  } catch {
    return [];
  }
}

function saveRules(rules: AlertRule[]) {
  try {
    const serializable = rules.map((r) =>
      r.kind === 'threshold' ? { ...r, thresholdStroops: r.thresholdStroops.toString() } : r,
    );
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Storage unavailable (private mode, quota, etc.) — rules just won't persist.
  }
}

function notifyBrowser(alerts: FiredAlert[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const a of alerts) {
    try {
      new Notification(`Sentinel Watch · ${a.label}`, { body: a.message });
    } catch {
      // Notification construction can fail in some embedded/webview contexts — non-fatal.
    }
  }
}

export default function WatchApp() {
  const { t } = useLanguage();
  const [contractIdInput, setContractIdInput] = useState(CONTRACT_ID ?? '');
  const [activeContractId, setActiveContractId] = useState(CONTRACT_ID ?? '');
  const [activeTab, setActiveTab] = useState<Tab>('feed');

  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [latestLedger, setLatestLedger] = useState<number | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const [rules, setRules] = useState<AlertRule[]>(() => loadRules());
  const [firedAlerts, setFiredAlerts] = useState<FiredAlert[]>([]);
  const [toasts, setToasts] = useState<FiredAlert[]>([]);

  const [pubKey, setPubKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletMessage, setWalletMessage] = useState('');

  const [now, setNow] = useState(Date.now());
  const [notifPermVersion, setNotifPermVersion] = useState(0);

  const nextLedgerRef = useRef<number | null>(null);
  const rulesRef = useRef<AlertRule[]>(rules);
  const lastFiredAtRef = useRef<Record<string, number>>({});

  const notifPermission: NotificationPermission | 'unsupported' =
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  // Referenced so the banner re-renders right after the user grants/denies permission.
  void notifPermVersion;

  useEffect(() => {
    rulesRef.current = rules;
    saveRules(rules);
  }, [rules]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const poll = useCallback(async () => {
    if (!activeContractId) return;
    try {
      if (nextLedgerRef.current === null) {
        const latest = await getLatestLedger();
        nextLedgerRef.current = Math.max(1, latest - EVENT_LOOKBACK_LEDGERS);
      }
      const { events: fresh, latestLedger: newLatest } = await fetchWatchEvents(
        activeContractId,
        nextLedgerRef.current,
      );
      setPollError(null);
      setLatestLedger(newLatest);
      if (fresh.length > 0) {
        setEvents((prev) => {
          const merged = [...prev, ...fresh].slice(-MAX_EVENTS);
          const activeRules = rulesRef.current.filter((r) => r.contractId === activeContractId);
          if (activeRules.length > 0) {
            const nowMs = Date.now();
            const newAlerts: FiredAlert[] = [];
            for (const ev of fresh) {
              newAlerts.push(...evaluateNewEvent(activeRules, ev, merged, lastFiredAtRef.current, nowMs));
            }
            if (newAlerts.length > 0) {
              for (const a of newAlerts) lastFiredAtRef.current[a.ruleId] = a.at;
              setFiredAlerts((p) => [...newAlerts, ...p].slice(0, 30));
              setToasts((p) => [...newAlerts, ...p].slice(0, 5));
              notifyBrowser(newAlerts);
            }
          }
          return merged;
        });
      }
      nextLedgerRef.current = newLatest + 1;
    } catch (e) {
      setPollError(e instanceof Error ? e.message : String(e));
    }
  }, [activeContractId]);

  useEffect(() => {
    nextLedgerRef.current = null;
    setEvents([]);
    setLatestLedger(null);
    setPollError(null);
    if (!activeContractId) return;
    poll();
    const id = setInterval(poll, 6000);
    return () => clearInterval(id);
  }, [activeContractId, poll]);

  // Toasts self-expire ~8s after the newest one arrives.
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setTimeout(() => setToasts((p) => p.slice(0, -1)), 8000);
    return () => clearTimeout(id);
  }, [toasts]);

  const submitContract = (e: FormEvent) => {
    e.preventDefault();
    setActiveContractId(contractIdInput.trim());
  };

  const connectWallet = async () => {
    setConnecting(true);
    setWalletMessage('');
    try {
      const available = await getAvailableWallets();
      if (available.length === 0) {
        setWalletMessage(translateAppError(t, classifyError('no wallet found')));
        return;
      }
      await kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            setPubKey(address);
            setWalletMessage('');
          } catch (e) {
            setWalletMessage(translateAppError(t, classifyError(e)));
          }
        },
      });
    } catch (e) {
      setWalletMessage(translateAppError(t, classifyError(e)));
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      await kit.disconnect();
    } catch {
      // Best-effort — the kit may not have an active session to tear down.
    }
    setPubKey(null);
  };

  const requestNotifPermission = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(() => setNotifPermVersion((n) => n + 1));
  };

  const activeRules = useMemo(
    () => rules.filter((r) => r.contractId === activeContractId),
    [rules, activeContractId],
  );

  const addRule = (rule: AlertRule) => setRules((prev) => [...prev, rule]);
  const toggleRule = (id: string) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  const deleteRule = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id));

  const statusText = pollError ? t('watchRpcError') : activeContractId ? t('watchLive') : t('watchIdle');

  return (
    <div className="watch-app">
      <TopNav active="watch" />
      <header className="watch-subbar">
        <form className="watch-contract-form" onSubmit={submitContract}>
          <input
            className="watch-mono-input"
            value={contractIdInput}
            onChange={(e) => setContractIdInput(e.target.value)}
            placeholder={t('watchContractPlaceholder')}
          />
          <button type="submit" className="watch-btn watch-btn--primary">
            {t('watchAction')}
          </button>
        </form>

        <div className="watch-status">
          <span
            className={`watch-pulse ${pollError ? 'watch-pulse--error' : activeContractId ? 'watch-pulse--live' : ''}`}
          />
          <span>{statusText}</span>
        </div>

        <div className="watch-wallet">
          {pubKey ? (
            <ProfileMenu pubKey={pubKey} onDisconnect={disconnectWallet} align="right" />
          ) : (
            <button className="watch-btn watch-btn--ghost" onClick={connectWallet} disabled={connecting}>
              {connecting ? t('connectingButton') : t('watchConnectWallet')}
            </button>
          )}
        </div>
      </header>

      {walletMessage && <div className="watch-banner watch-banner--error watch-banner--topbar">{walletMessage}</div>}

      <div className="watch-body">
        <nav className="watch-sidebar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`watch-nav-btn ${activeTab === tab.id ? 'watch-nav-btn--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="watch-nav-icon">
                  <Icon size={15} />
                </span>
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
          <div style={{ marginTop: 'auto', paddingTop: 12 }}>
            <FeedbackButton align="left" />
          </div>
        </nav>

        <main className="watch-main">
          {activeTab === 'simulator' ? (
            <SimulatorPanel defaultContractId={activeContractId} defaultSourceAddress={pubKey ?? ''} />
          ) : !activeContractId ? (
            <div className="watch-empty watch-empty--hero">
              {t('watchHeroEmpty', { watchAction: t('watchAction') })}
            </div>
          ) : (
            <>
              {activeTab === 'feed' && (
                <EventFeedPanel events={events} latestLedger={latestLedger} error={pollError} now={now} />
              )}
              {activeTab === 'analytics' && <AnalyticsPanel events={events} />}
              {activeTab === 'alerts' && (
                <AlertsPanel
                  contractId={activeContractId}
                  rules={activeRules}
                  firedAlerts={firedAlerts}
                  notifPermission={notifPermission}
                  onRequestNotifPermission={requestNotifPermission}
                  onAdd={addRule}
                  onToggle={toggleRule}
                  onDelete={deleteRule}
                  now={now}
                />
              )}
            </>
          )}
        </main>
      </div>

      <div className="watch-toast-stack">
        {toasts.map((toast, i) => (
          <div className="watch-toast" key={`${toast.ruleId}-${toast.at}-${i}`}>
            <div className="watch-toast-title">
              <IconAlert size={13} /> {toast.label}
            </div>
            <div className="watch-toast-msg">{toast.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
