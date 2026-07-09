import { useState } from 'react';
import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import { Horizon, TransactionBuilder, Networks, Asset, Operation } from 'stellar-sdk';

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

function App() {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [totalBill, setTotalBill] = useState('100');
  const [peopleCount, setPeopleCount] = useState('2');
  const [recipient, setRecipient] = useState('');

  const connectWallet = async () => {
    setLoading(true);
    try {
      if (await isConnected()) {
        const response = await requestAccess() as any;
        const publicKey = response.address ? response.address : response;
        setPubKey(publicKey);
        
        const account = await server.loadAccount(publicKey);
        const xlmBalance = account.balances.find((b: any) => b.asset_type === 'native');
        setBalance(xlmBalance ? xlmBalance.balance : '0');
        
        setRecipient(publicKey);
      } else {
        alert("Lütfen Freighter cüzdanını tarayıcınıza kurun!");
      }
    } catch (error) {
      console.error(error);
      alert("Bağlantı hatası!");
    } finally {
      setLoading(false);
    }
  };

  const sendPayment = async () => {
    if (!totalBill || !peopleCount || !recipient) return alert("Lütfen tüm alanları doldurun.");
    const splitAmount = (parseFloat(totalBill) / parseInt(peopleCount)).toFixed(2);
    
    setTxLoading(true);
    setTxHash(null);
    try {
      const sourceAccount = await server.loadAccount(pubKey!);
      
      const transaction = new TransactionBuilder(sourceAccount, {
        fee: "100", 
        networkPassphrase: Networks.TESTNET,
      })
      .addOperation(Operation.payment({
        destination: recipient,
        asset: Asset.native(),
        amount: splitAmount, 
      }))
      .setTimeout(30)
      .build();

      const signedXdr = await signTransaction(transaction.toXDR(), { 
        network: 'TESTNET',
        networkPassphrase: Networks.TESTNET
      }) as any;
      
      let xdrString = '';
      if (typeof signedXdr === 'string') {
        xdrString = signedXdr;
      } else if (signedXdr && typeof signedXdr === 'object') {
        if (signedXdr.error) throw new Error(signedXdr.error);
        // 🔥 İŞTE ÇÖZÜM: Freighter'ın yeni parametresi olan 'signedTxXdr' eklendi!
        xdrString = signedXdr.signedTxXdr || signedXdr.signedTx || signedXdr.transaction || signedXdr.tx || signedXdr.xdr || signedXdr.signedTransaction;
      }

      if (!xdrString) {
        throw new Error("Format bulunamadı!");
      }

      const txToSubmit = TransactionBuilder.fromXDR(xdrString, Networks.TESTNET);
      const response = await server.submitTransaction(txToSubmit as any);
      
      setTxHash(response.hash);
      
      const updatedAccount = await server.loadAccount(pubKey!);
      const newBalance = updatedAccount.balances.find((b: any) => b.asset_type === 'native');
      setBalance(newBalance ? newBalance.balance : '0');

    } catch (error: any) {
      console.error("İşlem Hatası:", error);
      alert("İşlem başarısız oldu! Hata detayı konsola yazdırıldı.");
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <div style={{ maxWidth: '500px', width: '100%', backgroundColor: '#1e293b', borderRadius: '16px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid #334155' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 5px 0', color: '#38bdf8', letterSpacing: '-1px' }}>CoreSplit <span style={{fontSize:'16px', color:'#94a3b8'}}>v1.0</span></h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '30px' }}>Dağıtık Ortak Gider Yönetim Protokolü</p>

        {!pubKey ? (
          <button onClick={connectWallet} disabled={loading} style={{ width: '100%', padding: '16px', backgroundColor: '#38bdf8', color: '#0f172a', fontSize: '16px', fontWeight: '700', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
            {loading ? "Cüzdana Bağlanıyor..." : "Freighter'ı Bağla"}
          </button>
        ) : (
          <div>
            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '25px' }}>
              <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span> BAĞLANDI
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: '15px' }}>{pubKey}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Kullanılabilir Bakiye</div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#f8fafc' }}>{parseFloat(balance || '0').toFixed(2)} <span style={{fontSize:'16px', color:'#38bdf8'}}>XLM</span></div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Toplam Fatura (XLM)</label>
                <input type="number" value={totalBill} onChange={(e) => setTotalBill(e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '16px' }} placeholder="Örn: 100" />
              </div>
              <div style={{ width: '100px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Kişi Sayısı</label>
                <input type="number" value={peopleCount} onChange={(e) => setPeopleCount(e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '16px' }} placeholder="2" />
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Alıcı Cüzdan Adresi</label>
              <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px', fontFamily: 'monospace' }} placeholder="G..." />
            </div>

            {totalBill && peopleCount && (
              <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px dashed #38bdf8', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', color: '#38bdf8', fontSize: '14px' }}>
                Sizin Payınıza Düşen Tutar: <strong style={{ fontSize: '18px' }}>{(parseFloat(totalBill) / parseInt(peopleCount)).toFixed(2)} XLM</strong>
              </div>
            )}

            <button onClick={sendPayment} disabled={txLoading} style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: '#fff', fontSize: '16px', fontWeight: '700', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '15px' }}>
              {txLoading ? "Ağda İşleniyor..." : "Payımı Gönder"}
            </button>

            {txHash && (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
                <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>✅ İşlem Başarılı!</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  Hash: <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>{txHash}</a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;