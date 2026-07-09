import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import './App.css';
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

type TxState = 'idle' | 'pending' | 'success' | 'fail';

// A lookback window that stays comfortably inside testnet's event retention.
const EVENT_LOOKBACK_LEDGERS = 400;
const MAX_ACTIVITY_ITEMS = 8;

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
  const progress =
    target > 0n ? Math.min(100, (Number(total) / Number(target)) * 100) : 0;
  const isRecipient =
    !!campaign?.recipient && !!pubKey && campaign.recipient === pubKey;
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
    none: { t: 'NOT STARTED', c: '#94a3b8' },
    running: { t: 'ACTIVE', c: '#38bdf8' },
    success: { t: 'SUCCESSFUL', c: '#10b981' },
    failed: { t: 'FAILED', c: '#ef4444' },
  }[state];

  const msgColor =
    tx === 'success' ? '#10b981' : tx === 'fail' ? '#f87171' : '#38bdf8';
  const msgBg =
    tx === 'success'
      ? 'rgba(16,185,129,0.1)'
      : tx === 'fail'
        ? 'rgba(239,68,68,0.1)'
        : 'rgba(56,189,248,0.1)';
  const msgBorder =
    tx === 'success' ? '#10b981' : tx === 'fail' ? '#ef4444' : '#38bdf8';

  const card: CSSProperties = {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '16px',
  };
  const input: CSSProperties = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="app-shell"
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        backgroundImage:
          'radial-gradient(circle at 15% -10%, rgba(56,189,248,0.12), transparent 45%), radial-gradient(circle at 85% 0%, rgba(16,185,129,0.10), transparent 40%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="app-card"
        style={{
          maxWidth: '540px',
          width: '100%',
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          border: '1px solid #334155',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: '#38bdf8', letterSpacing: '-1px' }}>
            🪐 Sentinel <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>Crowdfunding</span>
          </h1>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: stateBadge.c,
              border: `1px solid ${stateBadge.c}`,
              borderRadius: '20px',
              padding: '4px 10px',
            }}
          >
            {stateBadge.t}
          </span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '6px 0 22px' }}>
          Decentralized crowdfunding · Stellar Testnet
        </p>

        {!CONTRACT_ID && (
          <div
            style={{
              backgroundColor: 'rgba(245,158,11,0.1)',
              border: '1px solid #f59e0b',
              color: '#fbbf24',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            ⚠️ <strong>VITE_CONTRACT_ID</strong> is not set. After deploying, add the Contract ID to{' '}
            <code>frontend/.env</code>.
          </div>
        )}

        {!pubKey ? (
          <button
            className="btn"
            onClick={connectWallet}
            disabled={connecting}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontSize: '16px',
              fontWeight: 700,
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            {connecting ? 'Selecting wallet...' : '🔌 Connect Wallet'}
          </button>
        ) : (
          <>
            {/* Connection */}
            <div
              className="conn-row"
              style={{ ...card, marginBottom: '18px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold' }}>● CONNECTED</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>
                  {short(pubKey)}
                  {isRecipient && <span style={{ color: '#38bdf8' }}> · owner</span>}
                </div>
              </div>
              <button
                className="btn"
                onClick={disconnect}
                style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', fontSize: '11px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Disconnect
              </button>
            </div>

            {/* Wallet balance (Level 1: fetch + clearly display the connected wallet's XLM balance) */}
            <div
              className="balance-row stat-card"
              style={{
                ...card,
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(16,185,129,0.05))',
                borderColor: '#334155',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>
                  💳 WALLET BALANCE
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px' }}>
                  {xlmBalance === null ? (
                    <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 400 }}>Loading…</span>
                  ) : (
                    <>
                      {fromStroops(xlmBalance).toFixed(2)} <span style={{ fontSize: '14px', color: '#94a3b8' }}>XLM</span>
                    </>
                  )}
                </div>
              </div>
              <a
                href="https://friendbot.stellar.org"
                target="_blank"
                rel="noreferrer"
                className="balance-pill"
                style={{
                  fontSize: '11px',
                  color: '#38bdf8',
                  border: '1px solid #334155',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                🚰 Get test XLM
              </a>
            </div>

            {/* Progress */}
            <div className="stat-card" style={{ ...card, marginBottom: '18px' }}>
              {loadingCampaign && !campaign ? (
                <div style={{ fontSize: '13px', color: '#94a3b8', padding: '6px 0' }}>
                  ⏳ Loading campaign data…
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800 }}>
                      {fromStroops(total).toFixed(2)}{' '}
                      <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                        / {fromStroops(target).toFixed(2)} XLM
                      </span>
                    </span>
                    <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 700 }}>{progress.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: '10px', background: '#0b1220', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155' }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: state === 'failed' ? '#ef4444' : state === 'success' ? '#10b981' : '#38bdf8',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>⏳ {initialized ? (running ? fmtCountdown(deadline - now) : 'Ended') : '—'}</span>
                    <span>Your contribution: <strong style={{ color: '#f8fafc' }}>{fromStroops(myContribution).toFixed(2)} XLM</strong></span>
                  </div>
                </>
              )}
            </div>

            {/* Activity feed (real-time event streaming) */}
            {events.length > 0 && (
              <div style={{ ...card, marginBottom: '18px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '10px', letterSpacing: '0.5px' }}>
                  🔴 LIVE ACTIVITY
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {events.map((e) => (
                    <div key={e.id} className="activity-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#cbd5e1' }}>
                        {{ deposit: '💰', claim: '✅', refund: '↩️' }[e.type]}{' '}
                        {{ deposit: 'Donation', claim: 'Claim', refund: 'Refund' }[e.type]}
                        {' · '}
                        <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{short(e.actor)}</span>
                      </span>
                      <strong style={{ color: '#f8fafc' }}>{fromStroops(e.amount).toFixed(2)} XLM</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {state === 'running' && (
              <>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>
                  Donation Amount (XLM)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ ...input, marginBottom: '14px' }}
                  placeholder="e.g. 10"
                />
                <button
                  className="btn"
                  onClick={handleDeposit}
                  disabled={tx === 'pending' || !CONTRACT_ID}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: tx === 'pending' ? '#334155' : '#10b981',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '12px',
                    cursor: tx === 'pending' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {tx === 'pending' ? 'Processing...' : 'Donate'}
                </button>
              </>
            )}

            {state === 'success' && (
              <button
                className="btn"
                onClick={handleClaim}
                disabled={tx === 'pending' || !isRecipient || campaign?.claimed}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: campaign?.claimed ? '#334155' : '#10b981',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '12px',
                  cursor: !isRecipient || campaign?.claimed ? 'not-allowed' : 'pointer',
                }}
                title={!isRecipient ? 'Only the campaign owner can withdraw' : ''}
              >
                {campaign?.claimed
                  ? '✅ Funds withdrawn'
                  : isRecipient
                    ? 'Withdraw Funds (claim)'
                    : 'Campaign successful · owner will withdraw'}
              </button>
            )}

            {state === 'failed' && (
              <button
                className="btn"
                onClick={handleRefund}
                disabled={tx === 'pending' || myContribution <= 0n}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: myContribution > 0n ? '#38bdf8' : '#334155',
                  color: myContribution > 0n ? '#0f172a' : '#94a3b8',
                  fontSize: '16px',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '12px',
                  cursor: myContribution > 0n ? 'pointer' : 'not-allowed',
                }}
              >
                {myContribution > 0n ? 'Get Your Refund (refund)' : 'No contribution to refund'}
              </button>
            )}

            {/* Transaction status */}
            {tx !== 'idle' && message && (
              <div
                style={{
                  marginTop: '15px',
                  padding: '14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  backgroundColor: msgBg,
                  border: `1px solid ${msgBorder}`,
                  color: msgColor,
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {tx === 'pending' && '⏳ Transaction pending...'}
                  {tx === 'success' && '✅ Success'}
                  {tx === 'fail' && '❌ Error'}
                </div>
                <div style={{ marginTop: '4px', wordBreak: 'break-word' }}>{message}</div>
                {txHash && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '6px' }}>
                    Hash:{' '}
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="tx-link"
                      style={{ color: '#38bdf8' }}
                    >
                      {short(txHash)}
                    </a>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <p style={{ color: '#475569', fontSize: '12px', marginTop: '18px' }}>
        Contract: {CONTRACT_ID ? short(CONTRACT_ID) : 'not set'} · Network: Testnet
      </p>
    </div>
  );
}

export default App;
