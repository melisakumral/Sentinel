import { describe, expect, it } from 'vitest';
import { fmtStroops, fmtValuePreview, relativeTime, shortId } from './format';

describe('shortId', () => {
  it('truncates long ids to head...tail', () => {
    expect(shortId('CAGE4RJ5C4MAAWVT5I5F7XOUE25GVMWUTPXRQRIMPCEIJUD6E3DT5LR3')).toBe('CAGE4R...DT5LR3');
  });

  it('leaves short ids untouched', () => {
    expect(shortId('short')).toBe('short');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-01-01T00:10:00Z');

  it('reports "just now" for very recent timestamps', () => {
    expect(relativeTime('2026-01-01T00:09:58Z', now)).toBe('just now');
  });

  it('reports seconds ago', () => {
    expect(relativeTime('2026-01-01T00:09:30Z', now)).toBe('30s ago');
  });

  it('reports minutes ago', () => {
    expect(relativeTime('2026-01-01T00:05:00Z', now)).toBe('5m ago');
  });

  it('reports hours ago', () => {
    expect(relativeTime('2025-12-31T22:10:00Z', now)).toBe('2h ago');
  });

  it('falls back to the raw string for unparsable input', () => {
    expect(relativeTime('not-a-date', now)).toBe('not-a-date');
  });
});

describe('fmtStroops', () => {
  it('converts stroops to XLM with up to 2 decimals', () => {
    expect(fmtStroops(50_000_000n)).toBe('5');
    expect(fmtStroops(12_345_678n)).toBe('1.23');
  });
});

describe('fmtValuePreview', () => {
  it('formats bigint as XLM', () => {
    expect(fmtValuePreview(20_000_000n)).toBe('2 XLM');
  });

  it('shortens long strings', () => {
    expect(fmtValuePreview('GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEOESTKKX45YUYVMPP')).toContain('...');
  });

  it('renders a placeholder for null', () => {
    expect(fmtValuePreview(null)).toBe('—');
  });
});
