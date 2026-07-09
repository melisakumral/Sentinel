import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { kit, getAvailableWallets, classifyError } from './lib/wallet';
import {
  CONTRACT_ID,
  getCampaign,
  deposit,
  claim,
  refund,
  toStroops,
  fromStroops,
  type Campaign,
} from './lib/contract';

type TxState = 'idle' | 'pending' | 'success' | 'fail';

function App() {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [amount, setAmount] = useState('10');

  const [tx, setTx] = useState<TxState>('idle');
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // --- Cüzdan bağlama (3 hata tipi burada yakalanır) ---
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
      /* yok say */
    }
    setPubKey(null);
    setCampaign(null);
    setTx('idle');
    setMessage('');
    setTxHash(null);
  };

  // --- Kampanya verisini çek (canlı takip) ---
  const refresh = useCallback(async (address: string) => {
    if (!CONTRACT_ID) return;
    try {
      const c = await getCampaign(address);
      setCampaign(c);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!pubKey) return;
    refresh(pubKey);
    const id = setInterval(() => refresh(pubKey), 8000); // her 8 sn canlı güncelle
    return () => clearInterval(id);
  }, [pubKey, refresh]);

  // Geri sayım için saniye sayacı.
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // --- Yazma işlemleri (ortak sarmalayıcı) ---
  const runTx = async (fn: () => Promise<{ hash: string }>, pendingMsg: string, okMsg: string) => {
    setTx('pending');
    setMessage(pendingMsg);
    setTxHash(null);
    try {
      const { hash } = await fn();
      setTxHash(hash);
      setTx('success');
      setMessage(okMsg);
      if (pubKey) await refresh(pubKey);
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
      setMessage('Lütfen pozitif bir miktar gir.');
      return;
    }
    runTx(() => deposit(pubKey, toStroops(val)), 'Bağış imzalanıyor ve gönderiliyor...', 'Bağışın kaydedildi!');
  };

  const handleClaim = () =>
    pubKey && runTx(() => claim(pubKey), 'Fonlar çekiliyor...', 'Fonlar sahibin cüzdanına aktarıldı!');

  const handleRefund = () =>
    pubKey && runTx(() => refund(pubKey), 'İade işleniyor...', 'İaden cüzdanına gönderildi!');

  // --- Türetilmiş durum ---
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
    if (secs <= 0) return 'Süre doldu';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}g ${h}s ${m}dk`;
    if (h > 0) return `${h}s ${m}dk ${s}sn`;
    return `${m}dk ${s}sn`;
  };

  const stateBadge = {
    none: { t: 'BAŞLATILMADI', c: '#94a3b8' },
    running: { t: 'AKTİF', c: '#38bdf8' },
    success: { t: 'BAŞARILI', c: '#10b981' },
    failed: { t: 'BAŞARISIZ', c: '#ef4444' },
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
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '540px',
          width: '100%',
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          border: '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: '#38bdf8', letterSpacing: '-1px' }}>
            CoreSplit <span style={{ fontSize: '14px', color: '#94a3b8' }}>Crowdfunding</span>
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
          Merkeziyetsiz kitle fonlama · Stellar Testnet
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
            ⚠️ <strong>VITE_CONTRACT_ID</strong> tanımlı değil. Deploy sonrası{' '}
            <code>frontend/.env</code> içine Contract ID ekle.
          </div>
        )}

        {!pubKey ? (
          <button
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
            {connecting ? 'Cüzdan seçiliyor...' : 'Cüzdan Bağla'}
          </button>
        ) : (
          <>
            {/* Bağlantı */}
            <div style={{ ...card, marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold' }}>● BAĞLANDI</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>
                  {short(pubKey)}
                  {isRecipient && <span style={{ color: '#38bdf8' }}> · sahip</span>}
                </div>
              </div>
              <button
                onClick={disconnect}
                style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', fontSize: '11px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Çıkış
              </button>
            </div>

            {/* İlerleme */}
            <div style={{ ...card, marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <span style={{ fontSize: '24px', fontWeight: 800 }}>
                  {fromStroops(total).toFixed(2)}{' '}
                  <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                    / {fromStroops(target).toFixed(2)} XLM
                  </span>
                </span>
                <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 700 }}>%{progress.toFixed(0)}</span>
              </div>
              <div style={{ height: '10px', background: '#0b1220', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: state === 'failed' ? '#ef4444' : state === 'success' ? '#10b981' : '#38bdf8',
                    transition: 'width 0.5s',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
                <span>⏳ {initialized ? (running ? fmtCountdown(deadline - now) : 'Süre doldu') : '—'}</span>
                <span>Senin katkın: <strong style={{ color: '#f8fafc' }}>{fromStroops(myContribution).toFixed(2)} XLM</strong></span>
              </div>
            </div>

            {/* Aksiyonlar */}
            {state === 'running' && (
              <>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>
                  Bağış Miktarı (XLM)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ ...input, marginBottom: '14px' }}
                  placeholder="Örn: 10"
                />
                <button
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
                  {tx === 'pending' ? 'İşleniyor...' : 'Bağış Yap'}
                </button>
              </>
            )}

            {state === 'success' && (
              <button
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
                title={!isRecipient ? 'Sadece kampanya sahibi çekebilir' : ''}
              >
                {campaign?.claimed
                  ? '✅ Fonlar çekildi'
                  : isRecipient
                    ? 'Fonları Çek (claim)'
                    : 'Kampanya başarılı · fonları sahip çeker'}
              </button>
            )}

            {state === 'failed' && (
              <button
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
                {myContribution > 0n ? 'İadeni Al (refund)' : 'İade edilecek katkın yok'}
              </button>
            )}

            {/* İşlem durumu */}
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
                  {tx === 'pending' && '⏳ İşlem bekleniyor...'}
                  {tx === 'success' && '✅ Başarılı'}
                  {tx === 'fail' && '❌ Hata'}
                </div>
                <div style={{ marginTop: '4px', wordBreak: 'break-word' }}>{message}</div>
                {txHash && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '6px' }}>
                    Hash:{' '}
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
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
        Contract: {CONTRACT_ID ? short(CONTRACT_ID) : 'tanımsız'} · Ağ: Testnet
      </p>
    </div>
  );
}

export default App;
