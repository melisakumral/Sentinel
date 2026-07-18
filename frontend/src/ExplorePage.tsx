import { useEffect, useState } from 'react';
import TopNav from './TopNav';
import { useLanguage } from './i18n/useLanguage';
import { CONTRACT_ID, PUBLIC_READ_SOURCE, fromStroops, getCampaignFor, type Campaign } from './lib/contract';
import { IconActivity, IconClock } from './icons';

interface Props {
  pubKey: string | null;
  isOwner?: boolean;
  onDisconnect?: () => void;
  connecting: boolean;
  onConnect: () => void;
}

// Every campaign Sentinel knows about, by contract id. Sentinel's contracts
// are deployed one-at-a-time (see contract/src/lib.rs) — there is no on-chain
// factory or indexer yet that lists every campaign ever created, so this is
// a small hand-maintained config rather than a true open marketplace. As
// more campaigns get deployed, add their contract id + display name here.
const KNOWN_CAMPAIGNS: { id: string; name: string }[] = CONTRACT_ID ? [{ id: CONTRACT_ID, name: 'Sentinel — Main Campaign' }] : [];

type CardState = 'loading' | 'active' | 'completed' | 'failed' | 'none' | 'error';

interface Card {
  id: string;
  name: string;
  campaign: Campaign | null;
  state: CardState;
}

function deriveState(c: Campaign, now: number): CardState {
  const deadline = Number(c.deadline);
  if (deadline <= 0) return 'none';
  const running = now < deadline;
  const reached = c.target > 0n && c.total >= c.target;
  if (running) return 'active';
  return reached ? 'completed' : 'failed';
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ExplorePage({ pubKey, isOwner, onDisconnect, connecting, onConnect }: Props) {
  const { t } = useLanguage();
  const [cards, setCards] = useState<Card[]>(KNOWN_CAMPAIGNS.map((c) => ({ ...c, campaign: null, state: 'loading' })));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const source = pubKey ?? PUBLIC_READ_SOURCE;

    async function load() {
      const results = await Promise.all(
        KNOWN_CAMPAIGNS.map(async (c) => {
          try {
            const campaign = await getCampaignFor(c.id, source);
            return { ...c, campaign, state: deriveState(campaign, Math.floor(Date.now() / 1000)) as CardState };
          } catch (e) {
            console.error('explore fetch', c.id, e);
            return { ...c, campaign: null, state: 'error' as CardState };
          }
        }),
      );
      if (!cancelled) setCards(results);
    }

    load();
    const poll = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [pubKey]);

  const filtered = cards.filter((c) => {
    if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'active' && c.state !== 'active') return false;
    if (filter === 'completed' && c.state !== 'completed' && c.state !== 'failed') return false;
    return true;
  });

  return (
    <div className="sn-page">
      <TopNav active="explore" profile={pubKey ? { pubKey, isOwner, onDisconnect: onDisconnect ?? (() => {}) } : undefined} />
      <main className="sn-page-main">
        <div className="sn-dash-header">
          <div>
            <h1 className="sn-dash-title">{t('exploreTitle')}</h1>
            <p className="sn-dash-subtitle">{t('exploreSubtitle')}</p>
          </div>
        </div>

        {!pubKey && (
          <div className="sn-card sn-card-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('exploreConnectPrompt')}</span>
            <button className="sn-btn sn-btn--primary" onClick={onConnect} disabled={connecting}>
              {connecting ? t('connectingButton') : t('exploreConnectButton')}
            </button>
          </div>
        )}

        <div className="sn-explore-toolbar">
          <input
            className="sn-input sn-explore-search"
            placeholder={t('exploreSearchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="sn-filter-tabs">
            {(['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                className={`sn-filter-tab ${filter === f ? 'sn-filter-tab--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? t('exploreFilterAll') : f === 'active' ? t('exploreFilterActive') : t('exploreFilterCompleted')}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="sn-activity-empty">{t('exploreEmpty')}</div>
        ) : (
          <div className="sn-campaign-grid">
            {filtered.map((c) => {
              const campaign = c.campaign;
              const progress = campaign && campaign.target > 0n ? Math.min(100, (Number(campaign.total) / Number(campaign.target)) * 100) : 0;
              const badge =
                c.state === 'active'
                  ? { label: t('badgeActive'), variant: 'accent' }
                  : c.state === 'completed'
                    ? { label: t('badgeSuccessful'), variant: 'success' }
                    : c.state === 'failed'
                      ? { label: t('badgeFailed'), variant: 'danger' }
                      : c.state === 'error'
                        ? { label: t('badgeUnavailable'), variant: 'neutral' }
                        : { label: t('badgeNotStarted'), variant: 'neutral' };
              const progressColor = c.state === 'failed' ? 'var(--danger)' : c.state === 'completed' ? 'var(--success)' : 'var(--accent)';
              const deadline = campaign ? Number(campaign.deadline) : 0;
              const isMain = c.id === CONTRACT_ID;

              return (
                <div key={c.id} className="sn-card sn-campaign-card">
                  <div className="sn-campaign-card-head">
                    <h3 className="sn-campaign-card-name">{c.name}</h3>
                    <span className={`sn-pill sn-pill--${badge.variant}`}>{badge.label}</span>
                  </div>

                  {c.state === 'loading' ? (
                    <div className="sn-stat-loading">{t('exploreLoading')}</div>
                  ) : c.state === 'error' || !campaign ? (
                    <div className="sn-stat-loading">—</div>
                  ) : (
                    <>
                      <div className="sn-progress-track">
                        <div className="sn-progress-fill" style={{ width: `${progress}%`, background: progressColor }} />
                      </div>
                      <div className="sn-campaign-card-meta">
                        <span className="sn-campaign-card-raised">
                          {t('exploreRaisedOf', { a: fromStroops(campaign.total).toFixed(0), b: fromStroops(campaign.target).toFixed(0) })}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconClock size={12} />
                          {c.state === 'active' ? fmtCountdown(deadline - now) : t('ended')}
                        </span>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {isMain ? (
                      <a href="#/" className="sn-btn sn-btn--primary" style={{ flex: 1, textAlign: 'center' }}>
                        {t('exploreSupportButton')}
                      </a>
                    ) : (
                      <a
                        href={`https://stellar.expert/explorer/testnet/contract/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="sn-btn sn-btn--ghost"
                        style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <IconActivity size={12} />
                        {t('exploreViewButton')}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
