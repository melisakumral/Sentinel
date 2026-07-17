import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import ConnectGate from './ConnectGate';
import ProfileMenu from './ProfileMenu';
import FeedbackButton from './FeedbackButton';
import TopNav from './TopNav';
import { useLanguage, translateAppError } from './i18n/useLanguage';
import type { TranslationKey } from './i18n/translations';
import { kit, getAvailableWallets, classifyError } from './lib/wallet';
import {
  CONTRACT_ID,
  getCampaign,
  getXlmBalance,
  deposit,
  depositSponsored,
  claim,
  claimSponsored,
  refund,
  refundSponsored,
  toStroops,
  fromStroops,
  getLatestLedger,
  getRecentEvents,
  type Campaign,
  type ActivityEvent,
} from './lib/contract';
import {
  IconActivity,
  IconAlert,
  IconCheckCircle,
  IconClock,
  IconDroplet,
  IconWallet,
} from './icons';

type TxState = 'idle' | 'pending' | 'success' | 'fail';

// A lookback window that stays comfortably inside testnet's event retention.
const EVENT_LOOKBACK_LEDGERS = 400;
const MAX_ACTIVITY_ITEMS = 14;

const EVENT_DOT: Record<ActivityEvent['type'], string> = {
  deposit: 'var(--accent)',
  claim: 'var(--success)',
  refund: 'var(--text-muted)',
};
const EVENT_LABEL_KEY: Record<ActivityEvent['type'], TranslationKey> = {
  deposit: 'eventDeposit',
  claim: 'eventClaim',
  refund: 'eventRefund',
};

function App() {
  const { t } = useLanguage();
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [xlmBalance, setXlmBalance] = useState<bigint | null>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [amount, setAmount] = useState('10');
  const [gasless, setGasless] = useState(false);

  const [tx, setTx] = useState<TxState>('idle');
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const nextLedgerRef = useRef<number | null>(null);

  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // --- Connect wallet (all 3 error types are caught here) ---
  const connectWallet = async () => {
    setConnecting(true);
    setMessage('');
    try {
      const available = await getAvailableWallets();
      if (available.length === 0) {
        const err = classifyError('no wallet found');
        setTx('fail');
        setMessage(translateAppError(t, err));
        return;
      }
      await kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            setPubKey(address);
            setTx('idle');
            setMessage('');
          } catch (e) {
            const err = classifyError(e);
            setTx('fail');
            setMessage(translateAppError(t, err));
          }
        },
      });
    } catch (e) {
      const err = classifyError(e);
      setTx('fail');
      setMessage(translateAppError(t, err));
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await kit.disconnect();
    } catch {
      /* ignore */
    }
    setPubKey(null);
    setXlmBalance(null);
    setCampaign(null);
    setEvents([]);
    nextLedgerRef.current = null;
    setTx('idle');
    setMessage('');
    setTxHash(null);
  };

  // --- Fetch the connected wallet's own native XLM balance (Level 1) ---
  const refreshBalance = useCallback(async (address: string) => {
    try {
      const balance = await getXlmBalance(address);
      setXlmBalance(balance);
    } catch (e) {
      console.error('balance fetch', e);
    }
  }, []);

  // --- Fetch campaign state (live tracking) ---
  const refresh = useCallback(async (address: string) => {
    if (!CONTRACT_ID) return;
    setLoadingCampaign((prev) => prev || true);
    try {
      const c = await getCampaign(address);
      setCampaign(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCampaign(false);
    }
  }, []);

  // --- Event streaming: listens for the deposit/claim/refund events the
  // contract publishes via the Soroban RPC getEvents, building a real-time
  // activity feed (a channel independent of, and in addition to, state polling).
  const pollEvents = useCallback(async () => {
    if (!CONTRACT_ID) return;
    try {
      if (nextLedgerRef.current === null) {
        const latest = await getLatestLedger();
        nextLedgerRef.current = Math.max(1, latest - EVENT_LOOKBACK_LEDGERS);
      }
      const { events: fresh, latestLedger } = await getRecentEvents(nextLedgerRef.current);
      if (fresh.length > 0) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          const merged = [...fresh.filter((e) => !seen.has(e.id)).reverse(), ...prev];
          return merged.slice(0, MAX_ACTIVITY_ITEMS);
        });
      }
      nextLedgerRef.current = latestLedger + 1;
    } catch (e) {
      console.error('event polling', e);
    }
  }, []);

  useEffect(() => {
    if (!pubKey) return;
    refreshBalance(pubKey);
    refresh(pubKey);
    pollEvents();
    const balanceId = setInterval(() => refreshBalance(pubKey), 8000);
    const stateId = setInterval(() => refresh(pubKey), 8000); // live state refresh every 8s
    const eventId = setInterval(pollEvents, 6000); // check for new events every 6s
    return () => {
      clearInterval(balanceId);
      clearInterval(stateId);
      clearInterval(eventId);
    };
  }, [pubKey, refresh, refreshBalance, pollEvents]);

  // Second-by-second tick for the countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // --- Write transactions (shared wrapper) ---
  const runTx = async (fn: () => Promise<{ hash: string }>, pendingMsg: string, okMsg: string) => {
    setTx('pending');
    setMessage(pendingMsg);
    setTxHash(null);
    try {
      const { hash } = await fn();
      setTxHash(hash);
      setTx('success');
      setMessage(okMsg);
      if (pubKey) {
        await Promise.all([refresh(pubKey), refreshBalance(pubKey)]);
      }
    } catch (e) {
      const err = classifyError(e);
      setTx('fail');
      setMessage(translateAppError(t, err));
      console.error(e);
    }
  };

  const handleDeposit = () => {
    if (!pubKey) return;
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      setTx('fail');
      setMessage(t('msgPositiveAmount'));
      return;
    }
    const stroops = toStroops(val);
    runTx(
      () => (gasless ? depositSponsored(pubKey, stroops) : deposit(pubKey, stroops)),
      t('msgDepositPending'),
      t('msgDepositOk'),
    );
  };

  const handleClaim = () =>
    pubKey &&
    runTx(() => (gasless ? claimSponsored(pubKey) : claim(pubKey)), t('msgClaimPending'), t('msgClaimOk'));

  const handleRefund = () =>
    pubKey &&
    runTx(() => (gasless ? refundSponsored(pubKey) : refund(pubKey)), t('msgRefundPending'), t('msgRefundOk'));

  // --- Derived state ---
  const short = (k: string) => `${k.slice(0, 6)}...${k.slice(-6)}`;
  const relativeTime = (iso: string, nowMs: number) => {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return '';
    const diff = Math.max(0, Math.round((nowMs - ts) / 1000));
    if (diff < 5) return t('justNow');
    if (diff < 60) return t('secondsAgo', { n: diff });
    if (diff < 3600) return t('minutesAgo', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('hoursAgo', { n: Math.floor(diff / 3600) });
    return t('daysAgo', { n: Math.floor(diff / 86400) });
  };
  const deadline = campaign ? Number(campaign.deadline) : 0;
  const initialized = deadline > 0;
  const running = initialized && now < deadline;
  const total = campaign ? campaign.total : 0n;
  const target = campaign ? campaign.target : 0n;
  const reached = target > 0n && total >= target;
  const state: 'running' | 'success' | 'failed' | 'none' = !initialized
    ? 'none'
    : running
      ? 'running'
      : reached
        ? 'success'
        : 'failed';
  const progress = target > 0n ? Math.min(100, (Number(total) / Number(target)) * 100) : 0;
  const isRecipient = !!campaign?.recipient && !!pubKey && campaign.recipient === pubKey;
  const myContribution = campaign ? campaign.contribution : 0n;

  const fmtCountdown = (secs: number) => {
    if (secs <= 0) return t('ended');
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const stateBadge = {
    none: { t: t('badgeNotStarted'), variant: 'neutral' },
    running: { t: t('badgeActive'), variant: 'accent' },
    success: { t: t('badgeSuccessful'), variant: 'success' },
    failed: { t: t('badgeFailed'), variant: 'danger' },
  }[state];

  const progressColor = state === 'failed' ? 'var(--danger)' : state === 'success' ? 'var(--success)' : 'var(--accent)';

  const msgVariant = tx === 'success' ? 'success' : tx === 'fail' ? 'danger' : 'accent';
  const MsgIcon = tx === 'pending' ? IconClock : tx === 'success' ? IconCheckCircle : IconAlert;

  if (!pubKey) {
    return (
      <div className="sentinel-app">
        <ConnectGate connecting={connecting} errorMessage={tx === 'fail' ? message : ''} onConnect={connectWallet} />
      </div>
    );
  }

  return (
    <div className="sentinel-app">
      <div className="sn-dash-page">
        <TopNav active="home" />
        <div className="sn-dash sn-fade-in">
        <aside className="sn-side">
          <div className="sn-side-section" style={{ borderTop: 'none', paddingTop: 0 }}>
            <span className="sn-side-label">{t('sideAccount')}</span>
            <ProfileMenu pubKey={pubKey} isOwner={isRecipient} onDisconnect={disconnect} align="left" />
          </div>

          <div className="sn-side-section">
            <span className="sn-side-label">{t('sideContract')}</span>
            <span className="sn-side-value sn-mono">{CONTRACT_ID ? short(CONTRACT_ID) : t('sideNotSet')}</span>
          </div>

          <div className="sn-side-spacer" />

          <div style={{ marginTop: 8 }}>
            <FeedbackButton align="left" />
          </div>
        </aside>

        <main className="sn-dash-main">
          <div className="sn-dash-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 className="sn-dash-title" style={{ margin: 0 }}>
                  {t('dashTitle')}
                </h1>
                <span className={`sn-pill sn-pill--${stateBadge.variant}`}>{stateBadge.t}</span>
              </div>
              <p className="sn-dash-subtitle">{t('dashSubtitle')}</p>
            </div>
            <a href="https://friendbot.stellar.org" target="_blank" rel="noreferrer" className="sn-footer-link">
              <IconDroplet size={13} />
              {t('getTestXlm')}
            </a>
          </div>

          {!CONTRACT_ID && (
            <div
              className="sn-card sn-card-block"
              style={{ borderColor: 'var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13 }}
            >
              <strong>VITE_CONTRACT_ID</strong> {t('contractIdWarningPrefix')} <code className="sn-mono">frontend/.env</code>.
            </div>
          )}

          {/* Level 1: connected wallet's own XLM balance, clearly displayed */}
          <div className="sn-stat-grid">
            <div className="sn-stat-card">
              <span className="sn-stat-label">
                <IconWallet size={12} />
                {t('statBalance')}
              </span>
              <span className="sn-stat-value">
                {xlmBalance === null ? (
                  <span className="sn-stat-loading">{t('statLoading')}</span>
                ) : (
                  <>
                    {fromStroops(xlmBalance).toFixed(2)} <small>XLM</small>
                  </>
                )}
              </span>
            </div>
            <div className="sn-stat-card">
              <span className="sn-stat-label">
                <IconActivity size={12} />
                {t('statTotalRaised')}
              </span>
              <span className="sn-stat-value">
                {fromStroops(total).toFixed(2)} <small>/ {fromStroops(target).toFixed(2)} XLM</small>
              </span>
            </div>
            <div className="sn-stat-card">
              <span className="sn-stat-label">{t('statContribution')}</span>
              <span className="sn-stat-value">
                {fromStroops(myContribution).toFixed(2)} <small>XLM</small>
              </span>
            </div>
            <div className="sn-stat-card">
              <span className="sn-stat-label">
                <IconClock size={12} />
                {t('statTimeRemaining')}
              </span>
              <span className="sn-stat-value" style={{ fontSize: 19 }}>
                {initialized ? (running ? fmtCountdown(deadline - now) : t('ended')) : '—'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="sn-card sn-card-block">
            {loadingCampaign && !campaign ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <IconClock size={13} />
                {t('loadingCampaign')}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span className="sn-label">{t('progressLabel')}</span>
                  <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>{progress.toFixed(0)}%</span>
                </div>
                <div className="sn-progress-track">
                  <div className="sn-progress-fill" style={{ width: `${progress}%`, background: progressColor }} />
                </div>
              </>
            )}
          </div>

          <div className="sn-content-grid">
            {/* Campaign activity — deposit/claim/refund events, real-time */}
            <div className="sn-card sn-card-block sn-activity-panel">
              <div className="sn-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <IconActivity size={13} />
                {t('activityHeading')}
              </div>
              {events.length === 0 ? (
                <div className="sn-activity-empty">{t('activityEmpty')}</div>
              ) : (
                <div>
                  {events.map((e) => (
                    <div key={e.id} className="sn-activity-row">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', minWidth: 0 }}>
                        <span className="sn-activity-dot" style={{ background: EVENT_DOT[e.type] }} />
                        <span style={{ whiteSpace: 'nowrap' }}>{t(EVENT_LABEL_KEY[e.type])}</span>
                        <span className="sn-mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {short(e.actor)}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relativeTime(e.closedAt, now * 1000)}</span>
                        <strong className="sn-mono" style={{ color: 'var(--text)' }}>
                          {fromStroops(e.amount).toFixed(2)} XLM
                        </strong>
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          title={t('viewTxTooltip')}
                          style={{ color: 'var(--accent)', fontSize: 13, lineHeight: 1 }}
                        >
                          ↗
                        </a>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="sn-card sn-card-block">
              <div className="sn-label" style={{ marginBottom: 14 }}>
                {t('actionsHeading')}
              </div>

              {state !== 'none' && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginBottom: 14,
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={gasless}
                    onChange={(e) => setGasless(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{t('gaslessLabel')}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {t('gaslessHint')}
                    </span>
                  </span>
                </label>
              )}

              {state === 'running' && (
                <>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {t('donationAmountLabel')}
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="sn-input"
                    style={{ marginBottom: 14 }}
                    placeholder={t('donationPlaceholder')}
                  />
                  <button
                    className="sn-btn sn-btn--primary sn-btn--block"
                    onClick={handleDeposit}
                    disabled={tx === 'pending' || !CONTRACT_ID}
                  >
                    {tx === 'pending' ? t('donateProcessing') : t('donateButton')}
                  </button>
                </>
              )}

              {state === 'success' && (
                <button
                  className="sn-btn sn-btn--primary sn-btn--block"
                  onClick={handleClaim}
                  disabled={tx === 'pending' || !isRecipient || campaign?.claimed}
                  title={!isRecipient ? t('ownerOnlyTooltip') : ''}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {campaign?.claimed ? (
                    <>
                      <IconCheckCircle size={15} />
                      {t('fundsWithdrawn')}
                    </>
                  ) : isRecipient ? (
                    t('withdrawButton')
                  ) : (
                    t('ownerWillWithdraw')
                  )}
                </button>
              )}

              {state === 'failed' && (
                <button
                  className="sn-btn sn-btn--primary sn-btn--block"
                  onClick={handleRefund}
                  disabled={tx === 'pending' || myContribution <= 0n}
                >
                  {myContribution > 0n ? t('getRefundButton') : t('noContribution')}
                </button>
              )}

              {state === 'none' && <div className="sn-activity-empty">{t('waitingForStart')}</div>}

              {tx !== 'idle' && message && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 8,
                    fontSize: 13,
                    background: `var(--${msgVariant}-bg)`,
                    border: `1px solid var(--${msgVariant})`,
                    color: `var(--${msgVariant})`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                    <MsgIcon size={14} />
                    {tx === 'pending' && t('txPending')}
                    {tx === 'success' && t('txSuccess')}
                    {tx === 'fail' && t('txError')}
                  </div>
                  <div style={{ marginTop: 4, wordBreak: 'break-word', color: 'var(--text-secondary)' }}>{message}</div>
                  {txHash && (
                    <div className="sn-mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {t('txHashLabel')}{' '}
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)' }}
                      >
                        {short(txHash)}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
        </div>
      </div>
    </div>
  );
}

export default App;
