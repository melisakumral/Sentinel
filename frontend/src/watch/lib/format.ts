// Small display-formatting helpers shared by the Watch panels. Pure, tested.
const KIND_COLOR: Record<string, string> = {
  deposit: 'var(--watch-success)',
  claim: 'var(--watch-accent-2)',
  refund: 'var(--watch-accent)',
};

export function colorForKind(kind: string): string {
  return KIND_COLOR[kind] ?? 'var(--watch-text-dim)';
}

export function shortId(id: string, head = 6, tail = 6): string {
  if (id.length <= head + tail + 3) return id;
  return `${id.slice(0, head)}...${id.slice(-tail)}`;
}

export function relativeTime(iso: string, nowMs: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diff = Math.max(0, Math.round((nowMs - t) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const xlmFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

// Locale is pinned to en-US (not the browser's) so numbers stay a stable,
// unambiguous "1,234.56" everywhere regardless of the viewer's OS settings.
export function fmtStroops(v: bigint): string {
  return xlmFormatter.format(Number(v) / 1e7);
}

// Best-effort one-line rendering of a decoded event value that isn't a plain
// number/bigint (structs, vecs, addresses, etc.) — used when a WatchEvent's
// numericValue is null and we still need something to show in the feed.
export function fmtValuePreview(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'bigint') return `${fmtStroops(value)} XLM`;
  if (typeof value === 'string') return shortId(value, 10, 6);
  try {
    const json = JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    return json.length > 60 ? `${json.slice(0, 60)}…` : json;
  } catch {
    return String(value);
  }
}
