import { colorForKind, fmtValuePreview, relativeTime, shortId } from '../lib/format';
import type { WatchEvent } from '../types';

interface Props {
  events: WatchEvent[];
  latestLedger: number | null;
  error: string | null;
  now: number;
}

// Streams events as a dark, monospace terminal log rather than a table — new
// lines glow in at the top, matching Watch's "mission control" identity.
export default function EventFeedPanel({ events, latestLedger, error, now }: Props) {
  const ordered = [...events].reverse();

  return (
    <section className="watch-panel">
      <div className="watch-panel-head">
        <h2>Live Event Feed</h2>
        <div className="watch-panel-meta">
          {latestLedger !== null && <span>ledger #{latestLedger}</span>}
          <span>{events.length} event{events.length === 1 ? '' : 's'} in window</span>
        </div>
      </div>

      {error && <div className="watch-banner watch-banner--error">RPC error: {error}</div>}

      {ordered.length === 0 && !error ? (
        <div className="watch-empty">No events observed yet — this contract may be idle, or events are still loading.</div>
      ) : (
        <div className="watch-terminal">
          <div className="watch-term-cursor" aria-hidden="true">
            <span className="watch-term-prompt">&gt;</span>
            <span className="watch-term-cursor-block" />
          </div>
          {ordered.map((e) => {
            const actor = typeof e.topics[1] === 'string' ? e.topics[1] : null;
            const value = e.numericValue !== null ? fmtValuePreview(e.numericValue) : fmtValuePreview(e.value);
            return (
              <div key={e.id} className="watch-term-line">
                <span className="watch-term-prompt">&gt;</span>
                <span className="watch-term-kind" style={{ color: colorForKind(e.kind) }}>
                  {e.kind.toUpperCase()}
                </span>
                <span className="watch-term-actor">{actor ? shortId(actor) : '—'}</span>
                <span className="watch-term-value">{value}</span>
                <span className="watch-term-ledger">#{e.ledger}</span>
                <span className="watch-term-time">{relativeTime(e.closedAt, now)}</span>
                <a
                  className="watch-term-tx"
                  href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortId(e.txHash, 4, 4)}
                </a>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
