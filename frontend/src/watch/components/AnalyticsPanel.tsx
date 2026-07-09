import { colorForKind, fmtStroops } from '../lib/format';
import type { WatchEvent } from '../types';

interface Props {
  events: WatchEvent[];
}

interface KindCount {
  kind: string;
  count: number;
}

function countByKind(events: WatchEvent[]): KindCount[] {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
}

// Cumulative XLM volume over the fetched window, ordered by ledger — used to
// draw the volume sparkline. Events with no numeric value don't move the line.
function cumulativeVolume(events: WatchEvent[]): { ledger: number; total: bigint }[] {
  const sorted = [...events].sort((a, b) => a.ledger - b.ledger);
  let running = 0n;
  return sorted.map((e) => {
    if (e.numericValue !== null) running += e.numericValue;
    return { ledger: e.ledger, total: running };
  });
}

function BarChart({ data }: { data: KindCount[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="watch-barchart">
      {data.map((d) => (
        <div className="watch-bar-row" key={d.kind}>
          <span className="watch-bar-label">{d.kind}</span>
          <div className="watch-bar-track">
            <div
              className="watch-bar-fill"
              style={{ width: `${(d.count / max) * 100}%`, background: colorForKind(d.kind) }}
            />
          </div>
          <span className="watch-bar-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function VolumeSparkline({ points }: { points: { ledger: number; total: bigint }[] }) {
  if (points.length < 2) {
    return <div className="watch-empty watch-empty--tight">Not enough data points yet for a trend line.</div>;
  }
  const W = 600;
  const H = 140;
  const pad = 8;
  const maxTotal = Number(points[points.length - 1].total) || 1;
  const stepX = (W - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = H - pad - (Number(p.total) / maxTotal) * (H - pad * 2);
    return [x, y] as const;
  });
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${H - pad} L${coords[0][0].toFixed(1)},${H - pad} Z`;

  return (
    <svg className="watch-sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path d={areaPath} fill="url(#watch-volume-gradient)" stroke="none" />
      <path d={linePath} fill="none" stroke="var(--watch-accent-2)" strokeWidth="2" />
      <defs>
        <linearGradient id="watch-volume-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--watch-accent-2)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--watch-accent-2)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AnalyticsPanel({ events }: Props) {
  const kinds = countByKind(events);
  const volume = cumulativeVolume(events);
  const totalVolume = volume.length > 0 ? volume[volume.length - 1].total : 0n;
  const actors = new Set(
    events.map((e) => (typeof e.topics[1] === 'string' ? e.topics[1] : null)).filter((a): a is string => a !== null),
  );

  return (
    <section className="watch-panel">
      <div className="watch-panel-head">
        <h2>Analytics</h2>
        <div className="watch-panel-meta">
          <span>computed from the {events.length}-event window</span>
        </div>
      </div>

      <div className="watch-stat-grid">
        <div className="watch-stat-card">
          <span className="watch-stat-label">Total events</span>
          <span className="watch-stat-value">{events.length}</span>
        </div>
        <div className="watch-stat-card">
          <span className="watch-stat-label">Unique actors</span>
          <span className="watch-stat-value">{actors.size}</span>
        </div>
        <div className="watch-stat-card">
          <span className="watch-stat-label">Total volume</span>
          <span className="watch-stat-value">{fmtStroops(totalVolume)} <small>XLM</small></span>
        </div>
        <div className="watch-stat-card">
          <span className="watch-stat-label">Event kinds</span>
          <span className="watch-stat-value">{kinds.length}</span>
        </div>
      </div>

      <div className="watch-analytics-grid">
        <div className="watch-subpanel">
          <h3>Events by kind</h3>
          {kinds.length === 0 ? (
            <div className="watch-empty watch-empty--tight">No events yet.</div>
          ) : (
            <BarChart data={kinds} />
          )}
        </div>
        <div className="watch-subpanel">
          <h3>Cumulative volume (XLM)</h3>
          <VolumeSparkline points={volume} />
        </div>
      </div>
    </section>
  );
}
