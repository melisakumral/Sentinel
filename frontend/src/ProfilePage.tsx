import { useEffect, useState } from 'react';
import TopNav from './TopNav';
import { useLanguage } from './i18n/useLanguage';
import { fromStroops, type ActivityEvent } from './lib/contract';
import { getWebhookConfig, setWebhookConfig, sendWebhookAlert } from './lib/webhook';
import type { TranslationKey } from './i18n/translations';
import { IconActivity } from './icons';

interface Props {
  pubKey: string;
  isOwner?: boolean;
  onDisconnect: () => void;
  events: ActivityEvent[];
  now: number;
}

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

function short(k: string): string {
  return `${k.slice(0, 6)}...${k.slice(-6)}`;
}

export default function ProfilePage({ pubKey, isOwner, onDisconnect, events, now }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'history' | 'alerts'>('history');

  const [webhook, setWebhook] = useState(() => getWebhookConfig(pubKey));
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    setWebhook(getWebhookConfig(pubKey));
  }, [pubKey]);

  const myEvents = events.filter((e) => e.actor === pubKey);

  const save = () => {
    setWebhookConfig(pubKey, webhook);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const sendTest = async () => {
    if (!webhook.url) return;
    setTestState('sending');
    const ok = await sendWebhookAlert(webhook.url, t('profileWebhookTestMessage', { addr: short(pubKey) }));
    setTestState(ok ? 'ok' : 'fail');
    setTimeout(() => setTestState('idle'), 2500);
  };

  const relativeTime = (iso: string) => {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return '';
    const diff = Math.max(0, Math.round((now * 1000 - ts) / 1000));
    if (diff < 60) return t('secondsAgo', { n: diff });
    if (diff < 3600) return t('minutesAgo', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('hoursAgo', { n: Math.floor(diff / 3600) });
    return t('daysAgo', { n: Math.floor(diff / 86400) });
  };

  return (
    <div className="sn-page">
      <TopNav active="profile" profile={{ pubKey, isOwner, onDisconnect }} />
      <main className="sn-page-main">
        <div className="sn-dash-header">
          <div>
            <h1 className="sn-dash-title">{t('profileTitle')}</h1>
            <p className="sn-dash-subtitle">{t('profileSubtitle')}</p>
          </div>
        </div>

        <div className="sn-tabs">
          <button className={`sn-tab ${tab === 'history' ? 'sn-tab--active' : ''}`} onClick={() => setTab('history')}>
            {t('profileTabHistory')}
          </button>
          <button className={`sn-tab ${tab === 'alerts' ? 'sn-tab--active' : ''}`} onClick={() => setTab('alerts')}>
            {t('profileTabAlerts')}
          </button>
        </div>

        {tab === 'history' ? (
          <div className="sn-card sn-card-block">
            <div className="sn-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <IconActivity size={13} />
              {t('profileHistoryHeading')}
            </div>
            {myEvents.length === 0 ? (
              <div className="sn-activity-empty">{t('profileHistoryEmpty')}</div>
            ) : (
              <div>
                {myEvents.map((e) => (
                  <div key={e.id} className="sn-activity-row">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', minWidth: 0 }}>
                      <span className="sn-activity-dot" style={{ background: EVENT_DOT[e.type] }} />
                      <span style={{ whiteSpace: 'nowrap' }}>{t(EVENT_LABEL_KEY[e.type])}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relativeTime(e.closedAt)}</span>
                      <strong className="sn-mono" style={{ color: 'var(--text)' }}>
                        {fromStroops(e.amount).toFixed(2)} XLM
                      </strong>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
                        target="_blank"
                        rel="noreferrer"
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
        ) : (
          <div className="sn-card sn-card-block" style={{ maxWidth: 560 }}>
            <div className="sn-label" style={{ marginBottom: 10 }}>{t('profileAlertsHeading')}</div>
            <p className="sn-field-hint">{t('profileAlertsHint')}</p>

            <label className="sn-field-label">{t('profileWebhookLabel')}</label>
            <input
              className="sn-input"
              placeholder={t('profileWebhookPlaceholder')}
              value={webhook.url}
              onChange={(e) => setWebhook((w) => ({ ...w, url: e.target.value }))}
            />

            <label className="sn-inline-check">
              <input
                type="checkbox"
                checked={webhook.enabled}
                onChange={(e) => setWebhook((w) => ({ ...w, enabled: e.target.checked }))}
              />
              {t('profileWebhookEnableLabel')}
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="sn-btn sn-btn--primary" onClick={save}>
                {saved ? t('profileWebhookSaved') : t('profileWebhookSave')}
              </button>
              <button className="sn-btn sn-btn--ghost" onClick={sendTest} disabled={!webhook.url || testState === 'sending'}>
                {t('profileWebhookTest')}
              </button>
            </div>

            {testState === 'ok' && (
              <div className="sn-pill sn-pill--success" style={{ marginTop: 12 }}>
                {t('profileWebhookTestSent')}
              </div>
            )}
            {testState === 'fail' && (
              <div className="sn-pill sn-pill--danger" style={{ marginTop: 12 }}>
                {t('profileWebhookTestFail')}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
