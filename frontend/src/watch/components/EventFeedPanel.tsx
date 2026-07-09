import { colorForKind, fmtValuePreview, relativeTime, shortId } from '../lib/format';
import type { WatchEvent } from '../types';

interface Props {
  events: WatchEvent[];
  latestLedger: number | null;
  error: string | null;
  now: number;
}

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
        <div className="watch-table-wrap">
          <table className="watch-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Actor</th>
                <th>Value</th>
                <th>Ledger</th>
                <th>When</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((e) => {
                const actor = typeof e.topics[1] === 'string' ? e.topics[1] : null;
                return (
                  <tr key={e.id}>
                    <td>
                      <span className="watch-kind-badge" style={{ color: colorForKind(e.kind) }}>
                        {e.kind}
                      </span>
                    </td>
                    <td className="watch-mono">{actor ? shortId(actor) : '—'}</td>
                    <td className="watch-mono">
                      {e.numericValue !== null ? `${fmtValuePreview(e.numericValue)}` : fmtValuePreview(e.value)}
                    </td>
                    <td className="watch-mono">{e.ledger}</td>
                    <td title={e.closedAt}>{relativeTime(e.closedAt, now)}</td>
                    <td>
                      <a
                        className="watch-link"
                        href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortId(e.txHash, 4, 4)}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
