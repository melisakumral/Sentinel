import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import ConnectGate from './ConnectGate';
import { SentinelLogo } from './Logo';
import { kit, getAvailableWallets, classifyError } from './lib/wallet';
import {
  CONTRACT_ID,
  getCampaign,
  getXlmBalance,
  deposit,
  claim,
  refund,
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
  IconLogout,
  IconRadar,
  IconWallet,
} from './icons';

type TxState = 'idle' | 'pending' | 'success' | 'fail';

// A lookback window that stays comfortably inside testnet's event retention.
const EVENT_LOOKBACK_LEDGERS = 400;
const MAX_ACTIVITY_ITEMS = 14;

const EVENT_META: Record<ActivityEvent['type'], { label: string; dot: string }> = {
  deposit: { label: 'Donation', dot: 'var(--accent)' },
  claim: { label: 'Claim', dot: 'var(--success)' },
  refund: { label: 'Refund', dot: 'var(--text-muted)' },
};

function App() {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [xlmBalance, setXlmBalance] = useState<bigint | null>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [amount, setAmount] = useState('10');

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
        setMessage(err.message);
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
            setMessage(err.message);
          }
        },
      });
    } catch (e) {
      const err = classifyError(e);
      setTx('fail');
      setMessage(err.message);
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
      setMessage(err.message);
      console.error(e);
    }
  };

  const handleDeposit = () => {
    if (!pubKey) return;
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      setTx('fail');
      setMessage('Please enter a positive amount.');
      return;
    }
    runTx(() => deposit(pubKey, toStroops(val)), 'Signing and sending your donation...', 'Your donation was recorded!');
  };

  const handleClaim = () =>
    pubKey && runTx(() => claim(pubKey), 'Withdrawing funds...', 'Funds were transferred to the owner’s wallet!');

  const handleRefund = () =>
    pubKey && runTx(() => refund(pubKey), 'Processing refund...', 'Your refund was sent to your wallet!');

  // --- Derived state ---
  const short = (k: string) => `${k.slice(0, 6)}...${k.slice(-6)}`;
  const relativeTime = (iso: string, nowMs: number) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const diff = Math.max(0, Math.round((nowMs - t) / 1000));
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
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
    if (secs <= 0) return 'Ended';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const stateBadge = {
    none: { t: 'NOT STARTED', variant: 'neutral' },
    running: { t: 'ACTIVE', variant: 'accent' },
    success: { t: 'SUCCESSFUL', variant: 'success' },
    failed: { t: 'FAILED', variant: 'danger' },
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
      <div className="sn-dash sn-fade-in">
        <aside className="sn-side">
          <div className="sn-brand" style={{ marginBottom: 18 }}>
            <div className="sn-brand-mark">
              <SentinelLogo size={16} />
            </div>
            <div>
              <div className="sn-brand-name">Sentinel</div>
              <div className="sn-brand-sub">Crowdfunding</div>
            </div>
          </div>

          <span className={`sn-pill sn-pill--${stateBadge.variant}`} style={{ alignSelf: 'flex-start' }}>
            {stateBadge.t}
          </span>

          <div className="sn-side-section">
            <span className="sn-side-label">Account</span>
            <span className="sn-side-value sn-mono">{short(pubKey)}</span>
            {isRecipient && (
              <span className="sn-pill sn-pill--accent" style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                Campaign owner
              </span>
            )}
          </div>

          <div className="sn-side-section">
            <span className="sn-side-label">Contract</span>
            <span className="sn-side-value sn-mono">{CONTRACT_ID ? short(CONTRACT_ID) : 'not set'}</span>
          </div>

          <div className="sn-side-section">
            <span className="sn-side-label">Network</span>
            <span className="sn-side-value">Stellar Testnet</span>
          </div>

          <div className="sn-side-spacer" />

          <a href="#/watch" className="sn-side-link">
            <IconRadar size={14} />
            Sentinel Watch
          </a>
          <button className="sn-side-link sn-side-link--danger" onClick={disconnect}>
            <IconLogout size={14} />
            Disconnect
          </button>
        </aside>

        <main className="sn-dash-main">
          <div className="sn-dash-header">
            <div>
              <h1 className="sn-dash-title">Campaign overview</h1>
              <p className="sn-dash-subtitle">Live funding progress and on-chain activity, synced from Stellar.</p>
            </div>
            <a href="https://friendbot.stellar.org" target="_blank" rel="noreferrer" className="sn-footer-link">
              <IconDroplet size={13} />
              Get test XLM
            </a>
          </div>

          {!CONTRACT_ID && (
            <div
              className="sn-card sn-card-block"
              style={{ borderColor: 'var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13 }}
            >
              <strong>VITE_CONTRACT_ID</strong> is not set. After deploying, add the Contract ID to{' '}
              <code className="sn-mono">frontend/.env</code>.
            </div>
          )}

          {/* Level 1: connected wallet's own XLM balance, clearly displayed */}
          <div className="sn-stat-grid">
            <div className="sn-stat-card">
              <span className="sn-stat-label">
                <IconWallet size={12} />
                Wallet balance
              </span>
              <span className="sn-stat-value">
                {xlmBalance === null ? (
                  <span className="sn-stat-loading">Loading…</span>
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
                Total raised
              </span>
              <span className="sn-stat-value">
                {fromStroops(total).toFixed(2)} <small>/ {fromStroops(target).toFixed(2)} XLM</small>
              </span>
            </div>
            <div className="sn-stat-card">
              <span className="sn-stat-label">Your contribution</span>
              <span className="sn-stat-value">
                {fromStroops(myContribution).toFixed(2)} <small>XLM</small>
              </span>
            </div>
            <div className="sn-stat-card">
              <span className="sn-stat-label">
                <IconClock size={12} />
                Time remaining
              </span>
              <span className="sn-stat-value" style={{ fontSize: 19 }}>
                {initialized ? (running ? fmtCountdown(deadline - now) : 'Ended') : '—'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="sn-card sn-card-block">
            {loadingCampaign && !campaign ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <IconClock size={13} />
                Loading campaign data…
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span className="sn-label">Progress toward goal</span>
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
                Campaign activity
              </div>
              {events.length === 0 ? (
                <div className="sn-activity-empty">
                  No activity yet — donations, claims, and refunds will appear here in real time.
                </div>
              ) : (
                <div>
                  {events.map((e) => {
                    const meta = EVENT_META[e.type];
                    return (
                      <div key={e.id} className="sn-activity-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', minWidth: 0 }}>
                          <span className="sn-activity-dot" style={{ background: meta.dot }} />
                          <span style={{ whiteSpace: 'nowrap' }}>{meta.label}</span>
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
                            title="View transaction"
                            style={{ color: 'var(--accent)', fontSize: 13, lineHeight: 1 }}
                          >
                            ↗
                          </a>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="sn-card sn-card-block">
              <div className="sn-label" style={{ marginBottom: 14 }}>
                Actions
              </div>

              {state === 'running' && (
                <>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Donation amount (XLM)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="sn-input"
                    style={{ marginBottom: 14 }}
                    placeholder="e.g. 10"
                  />
                  <button
                    className="sn-btn sn-btn--primary sn-btn--block"
                    onClick={handleDeposit}
                    disabled={tx === 'pending' || !CONTRACT_ID}
                  >
                    {tx === 'pending' ? 'Processing...' : 'Donate'}
                  </button>
                </>
              )}

              {state === 'success' && (
                <button
                  className="sn-btn sn-btn--primary sn-btn--block"
                  onClick={handleClaim}
                  disabled={tx === 'pending' || !isRecipient || campaign?.claimed}
                  title={!isRecipient ? 'Only the campaign owner can withdraw' : ''}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {campaign?.claimed ? (
                    <>
                      <IconCheckCircle size={15} />
                      Funds withdrawn
                    </>
                  ) : isRecipient ? (
                    'Withdraw funds (claim)'
                  ) : (
                    'Campaign successful · owner will withdraw'
                  )}
                </button>
              )}

              {state === 'failed' && (
                <button
                  className="sn-btn sn-btn--primary sn-btn--block"
                  onClick={handleRefund}
                  disabled={tx === 'pending' || myContribution <= 0n}
                >
                  {myContribution > 0n ? 'Get your refund (refund)' : 'No contribution to refund'}
                </button>
              )}

              {state === 'none' && <div className="sn-activity-empty">Waiting for the campaign to start.</div>}

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
                    {tx === 'pending' && 'Transaction pending'}
                    {tx === 'success' && 'Success'}
                    {tx === 'fail' && 'Error'}
                  </div>
                  <div style={{ marginTop: 4, wordBreak: 'break-word', color: 'var(--text-secondary)' }}>{message}</div>
                  {txHash && (
                    <div className="sn-mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      Hash:{' '}
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
  );
}

export default App;
