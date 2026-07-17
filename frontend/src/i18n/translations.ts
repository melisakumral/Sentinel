// Central EN/TR dictionary. Every UI string used by ConnectGate, the
// Dashboard, TopNav, ProfileMenu, FeedbackButton, and ErrorBoundary lives
// here so the two languages can never drift out of key-parity (tr is typed
// against en's keys).
export type Lang = 'en' | 'tr';

const en = {
  brandName: 'Sentinel',
  brandSub: 'Decentralized crowdfunding',
  securedCaption: 'Secured by the Stellar network',
  connectHeading: 'Connect your wallet',
  connectSubtext:
    'Sign in with Freighter or any supported Stellar wallet to view your balance and support this campaign on Stellar Testnet.',
  connectButton: 'Connect wallet',
  connectingButton: 'Connecting…',
  finePrint:
    'Sentinel never asks for a seed phrase or private key. Your wallet extension signs every transaction locally — this app only ever sees the signed result.',
  worksWith: 'Works with',
  securityHeading: 'Security, verified on-chain.',
  securitySubtext:
    'Sentinel never holds your funds or your keys. Every deposit, claim, and refund is signed in your own wallet and settled directly on the Stellar network.',
  featureNonCustodialTitle: 'Non-custodial by design',
  featureNonCustodialBody: "Sentinel can't move your funds. Only you can sign a transaction.",
  featureVerifiableTitle: 'Publicly verifiable',
  featureVerifiableBody: 'Every transaction is recorded on Stellar and open to audit.',
  featureMonitoringTitle: 'Real-time monitoring',
  featureMonitoringBody: 'Campaign state and activity update live from the chain.',

  navOverview: 'Overview',
  navWatch: 'Sentinel Watch',

  badgeNotStarted: 'NOT STARTED',
  badgeActive: 'ACTIVE',
  badgeSuccessful: 'SUCCESSFUL',
  badgeFailed: 'FAILED',

  sideAccount: 'Account',
  sideContract: 'Contract',
  sideNotSet: 'not set',
  sideCampaignOwner: 'Campaign owner',

  contractIdWarningPrefix: 'is not set. After deploying, add the Contract ID to',

  dashTitle: 'Campaign overview',
  dashSubtitle: 'Live funding progress and on-chain activity, synced from Stellar.',
  getTestXlm: 'Get test XLM',

  statBalance: 'Wallet balance',
  statLoading: 'Loading…',
  statTotalRaised: 'Total raised',
  statContribution: 'Your contribution',
  statTimeRemaining: 'Time remaining',
  loadingCampaign: 'Loading campaign data…',
  progressLabel: 'Progress toward goal',

  activityHeading: 'Campaign activity',
  activityEmpty: 'No activity yet — donations, claims, and refunds will appear here in real time.',
  eventDeposit: 'Donation',
  eventClaim: 'Claim',
  eventRefund: 'Refund',

  actionsHeading: 'Actions',
  donationAmountLabel: 'Donation amount (XLM)',
  donateProcessing: 'Processing...',
  donateButton: 'Donate',
  fundsWithdrawn: 'Funds withdrawn',
  withdrawButton: 'Withdraw funds (claim)',
  ownerWillWithdraw: 'Campaign successful · owner will withdraw',
  getRefundButton: 'Get your refund (refund)',
  noContribution: 'No contribution to refund',
  waitingForStart: 'Waiting for the campaign to start.',

  txPending: 'Transaction pending',
  txSuccess: 'Success',
  txError: 'Error',
  txHashLabel: 'Hash:',

  footerContract: 'Contract:',
  footerNetwork: 'Network: Testnet',

  ended: 'Ended',

  msgPositiveAmount: 'Please enter a positive amount.',
  msgDepositPending: 'Signing and sending your donation...',
  msgDepositOk: 'Your donation was recorded!',
  msgClaimPending: 'Withdrawing funds...',
  msgClaimOk: 'Funds were transferred to the owner’s wallet!',
  msgRefundPending: 'Processing refund...',
  msgRefundOk: 'Your refund was sent to your wallet!',

  errWalletNotFound: 'Wallet not found. Please install Freighter (or another supported wallet) and try again.',
  errUserRejected: 'The transaction was rejected in your wallet.',
  errInsufficientBalance:
    'Insufficient balance. Make sure your wallet has enough test XLM (fund it via Friendbot).',

  pmCopyAddress: 'Copy address',
  pmCopied: 'Copied',
  pmViewExplorer: 'View on explorer',
  pmNetwork: 'Network',
  pmDisconnect: 'Disconnect',

  fbTrigger: 'Feedback',
  fbTitle: 'Send feedback',
  fbHint: 'Opens a pre-filled GitHub issue on the public repo — takes a few seconds.',
  fbPlaceholder: "What worked, what didn't, what would make this better?",
  fbCancel: 'Cancel',
  fbSubmit: 'Submit',

  ebTitle: 'Something went wrong',
  ebBody: 'Sentinel hit an unexpected error. Reloading usually fixes it — if it keeps happening, let us know.',
  ebReload: 'Reload',
  ebReport: 'Report issue',

  watchTabFeed: 'Event Feed',
  watchTabAnalytics: 'Analytics',
  watchTabAlerts: 'Alerts',
  watchTabSimulator: 'Simulator',
  watchConnectWallet: 'Connect Wallet',
  watchHeroEmpty: 'Enter a Soroban Contract ID above and hit {watchAction} to start monitoring — live events, analytics and alert rules, all against real testnet data.',
  watchAction: 'Watch',
  watchLive: 'live',
  watchIdle: 'idle',
  watchRpcError: 'RPC error',

  langToggleLabel: 'Language',

  justNow: 'just now',
  secondsAgo: '{n}s ago',
  minutesAgo: '{n}m ago',
  hoursAgo: '{n}h ago',
  daysAgo: '{n}d ago',
  ownerOnlyTooltip: 'Only the campaign owner can withdraw',
  viewTxTooltip: 'View transaction',
  donationPlaceholder: 'e.g. 10',
  watchContractPlaceholder: 'Soroban Contract ID (C...)',

  gaslessLabel: 'Gasless (sponsored fee)',
  gaslessHint: 'The network fee is covered for you — no XLM needed just to cover it.',
  gaslessUnavailable: 'Gasless sponsorship is not available on this deployment.',
} as const;

const tr: Record<keyof typeof en, string> = {
  brandName: 'Sentinel',
  brandSub: 'Merkeziyetsiz bağış toplama',
  securedCaption: 'Stellar ağı ile güvence altında',
  connectHeading: 'Cüzdanınızı bağlayın',
  connectSubtext:
    'Bakiyenizi görmek ve bu kampanyayı desteklemek için Freighter veya desteklenen herhangi bir Stellar cüzdanıyla Stellar Testnet üzerinde giriş yapın.',
  connectButton: 'Cüzdanı bağla',
  connectingButton: 'Bağlanıyor…',
  finePrint:
    'Sentinel asla gizli anahtar veya kurtarma cümlesi istemez. Her işlem cüzdan eklentinizde yerel olarak imzalanır — bu uygulama yalnızca imzalanmış sonucu görür.',
  worksWith: 'Desteklenen cüzdanlar',
  securityHeading: 'Güvenlik, zincir üzerinde doğrulanır.',
  securitySubtext:
    'Sentinel fonlarınızı veya anahtarlarınızı asla tutmaz. Her bağış, çekim ve iade kendi cüzdanınızda imzalanır ve doğrudan Stellar ağında sonuçlanır.',
  featureNonCustodialTitle: 'Tasarım gereği vesayetsiz',
  featureNonCustodialBody: 'Sentinel fonlarınızı hareket ettiremez. Bir işlemi yalnızca siz imzalayabilirsiniz.',
  featureVerifiableTitle: 'Herkese açık doğrulanabilir',
  featureVerifiableBody: 'Her işlem Stellar üzerinde kayıt altına alınır ve denetime açıktır.',
  featureMonitoringTitle: 'Gerçek zamanlı izleme',
  featureMonitoringBody: 'Kampanya durumu ve aktivite zincirden canlı olarak güncellenir.',

  navOverview: 'Genel Bakış',
  navWatch: 'Sentinel Watch',

  badgeNotStarted: 'BAŞLAMADI',
  badgeActive: 'AKTİF',
  badgeSuccessful: 'BAŞARILI',
  badgeFailed: 'BAŞARISIZ',

  sideAccount: 'Hesap',
  sideContract: 'Kontrat',
  sideNotSet: 'ayarlanmadı',
  sideCampaignOwner: 'Kampanya sahibi',

  contractIdWarningPrefix: "ayarlanmamış. Dağıtımdan sonra Contract ID'yi şuraya ekleyin:",

  dashTitle: 'Kampanya genel bakışı',
  dashSubtitle: 'Stellar ile senkronize, canlı fonlama ilerlemesi ve zincir üstü aktivite.',
  getTestXlm: 'Test XLM al',

  statBalance: 'Cüzdan bakiyesi',
  statLoading: 'Yükleniyor…',
  statTotalRaised: 'Toplanan tutar',
  statContribution: 'Katkınız',
  statTimeRemaining: 'Kalan süre',
  loadingCampaign: 'Kampanya verisi yükleniyor…',
  progressLabel: 'Hedefe ilerleme',

  activityHeading: 'Kampanya aktivitesi',
  activityEmpty: 'Henüz aktivite yok — bağışlar, çekimler ve iadeler burada gerçek zamanlı görünecek.',
  eventDeposit: 'Bağış',
  eventClaim: 'Çekim',
  eventRefund: 'İade',

  actionsHeading: 'İşlemler',
  donationAmountLabel: 'Bağış miktarı (XLM)',
  donateProcessing: 'İşleniyor...',
  donateButton: 'Bağış yap',
  fundsWithdrawn: 'Fonlar çekildi',
  withdrawButton: 'Fonları çek (claim)',
  ownerWillWithdraw: 'Kampanya başarılı · sahibi fonları çekecek',
  getRefundButton: 'İadeni al (refund)',
  noContribution: 'İade edilecek katkı yok',
  waitingForStart: 'Kampanyanın başlaması bekleniyor.',

  txPending: 'İşlem bekliyor',
  txSuccess: 'Başarılı',
  txError: 'Hata',
  txHashLabel: 'Hash:',

  footerContract: 'Kontrat:',
  footerNetwork: 'Ağ: Testnet',

  ended: 'Sona erdi',

  msgPositiveAmount: 'Lütfen pozitif bir miktar girin.',
  msgDepositPending: 'Bağışınız imzalanıyor ve gönderiliyor...',
  msgDepositOk: 'Bağışınız kaydedildi!',
  msgClaimPending: 'Fonlar çekiliyor...',
  msgClaimOk: 'Fonlar sahibin cüzdanına aktarıldı!',
  msgRefundPending: 'İade işleniyor...',
  msgRefundOk: 'İadeniz cüzdanınıza gönderildi!',

  errWalletNotFound: 'Cüzdan bulunamadı. Lütfen Freighter (veya desteklenen başka bir cüzdan) yükleyip tekrar deneyin.',
  errUserRejected: 'İşlem cüzdanınızda reddedildi.',
  errInsufficientBalance:
    'Yetersiz bakiye. Cüzdanınızda yeterli test XLM olduğundan emin olun (Friendbot ile fonlayın).',

  pmCopyAddress: 'Adresi kopyala',
  pmCopied: 'Kopyalandı',
  pmViewExplorer: "Explorer'da görüntüle",
  pmNetwork: 'Ağ',
  pmDisconnect: 'Bağlantıyı kes',

  fbTrigger: 'Geri bildirim',
  fbTitle: 'Geri bildirim gönder',
  fbHint: 'Herkese açık repoda önceden doldurulmuş bir GitHub issue açar — birkaç saniye sürer.',
  fbPlaceholder: 'Ne işe yaradı, ne yaramadı, neyi daha iyi yapabiliriz?',
  fbCancel: 'Vazgeç',
  fbSubmit: 'Gönder',

  ebTitle: 'Bir şeyler ters gitti',
  ebBody: 'Sentinel beklenmedik bir hatayla karşılaştı. Sayfayı yenilemek genelde çözer — devam ederse bize bildirin.',
  ebReload: 'Yenile',
  ebReport: 'Hata bildir',

  watchTabFeed: 'Olay Akışı',
  watchTabAnalytics: 'Analitik',
  watchTabAlerts: 'Uyarılar',
  watchTabSimulator: 'Simülatör',
  watchConnectWallet: 'Cüzdanı Bağla',
  watchHeroEmpty:
    'İzlemeye başlamak için yukarıya bir Soroban Contract ID girip {watchAction} butonuna basın — gerçek testnet verisine karşı canlı olaylar, analitik ve uyarı kuralları.',
  watchAction: 'İzle',
  watchLive: 'canlı',
  watchIdle: 'boşta',
  watchRpcError: 'RPC hatası',

  langToggleLabel: 'Dil',

  justNow: 'az önce',
  secondsAgo: '{n}sn önce',
  minutesAgo: '{n}dk önce',
  hoursAgo: '{n}sa önce',
  daysAgo: '{n}g önce',
  ownerOnlyTooltip: 'Sadece kampanya sahibi çekim yapabilir',
  viewTxTooltip: 'İşlemi görüntüle',
  donationPlaceholder: 'örn. 10',
  watchContractPlaceholder: 'Soroban Contract ID (C...)',

  gaslessLabel: 'Gazsız (ücret sponsorlu)',
  gaslessHint: 'Ağ ücreti sizin için karşılanır — sadece bunun için XLM gerekmez.',
  gaslessUnavailable: 'Bu dağıtımda gazsız sponsorluk aktif değil.',
};

export const translations: Record<Lang, Record<keyof typeof en, string>> = { en, tr };
export type TranslationKey = keyof typeof en;
