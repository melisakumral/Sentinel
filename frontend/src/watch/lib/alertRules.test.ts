import { describe, expect, it } from 'vitest';
import type { WatchEvent } from '../types';
import {
  countInWindow,
  evaluateNewEvent,
  matchesThreshold,
  shouldFireFrequency,
  type FrequencyRule,
  type ThresholdRule,
} from './alertRules';

function event(overrides: Partial<WatchEvent> = {}): WatchEvent {
  return {
    id: '1-1',
    ledger: 100,
    closedAt: new Date().toISOString(),
    txHash: 'abc',
    kind: 'deposit',
    topics: ['deposit'],
    value: 50_000_000n,
    numericValue: 50_000_000n,
    ...overrides,
  };
}

const threshold: ThresholdRule = {
  id: 'r1',
  contractId: 'C1',
  kind: 'threshold',
  label: 'Big deposit',
  eventKind: 'deposit',
  comparator: '>',
  thresholdStroops: 10_000_000n,
  enabled: true,
};

const frequency: FrequencyRule = {
  id: 'r2',
  contractId: 'C1',
  kind: 'frequency',
  label: 'Deposit burst',
  eventKind: 'deposit',
  count: 3,
  windowSeconds: 60,
  enabled: true,
};

describe('matchesThreshold', () => {
  it('fires when the value crosses the threshold', () => {
    expect(matchesThreshold(threshold, event())).toBe(true);
  });

  it('does not fire when disabled', () => {
    expect(matchesThreshold({ ...threshold, enabled: false }, event())).toBe(false);
  });

  it('does not fire for a different event kind', () => {
    expect(matchesThreshold(threshold, event({ kind: 'refund' }))).toBe(false);
  });

  it('matches any kind when eventKind is "any"', () => {
    expect(matchesThreshold({ ...threshold, eventKind: 'any' }, event({ kind: 'claim' }))).toBe(true);
  });

  it('does not fire when the event has no numeric value', () => {
    expect(matchesThreshold(threshold, event({ numericValue: null }))).toBe(false);
  });

  it('respects the comparator direction', () => {
    const small = event({ numericValue: 1_000_000n });
    expect(matchesThreshold(threshold, small)).toBe(false);
    expect(matchesThreshold({ ...threshold, comparator: '<' }, small)).toBe(true);
  });
});

describe('countInWindow', () => {
  it('counts only events within the trailing window', () => {
    const now = Date.parse('2026-01-01T00:01:00Z');
    const events = [
      event({ closedAt: '2026-01-01T00:00:50Z' }), // 10s ago -> in window
      event({ closedAt: '2026-01-01T00:00:00Z' }), // 60s ago -> boundary, in window
      event({ closedAt: '2025-12-31T23:58:00Z' }), // 180s ago -> out of window
    ];
    expect(countInWindow(events, 'deposit', 60, now)).toBe(2);
  });

  it('filters by kind unless "any"', () => {
    const now = Date.now();
    const events = [event({ kind: 'deposit', closedAt: new Date(now).toISOString() }), event({ kind: 'refund', closedAt: new Date(now).toISOString() })];
    expect(countInWindow(events, 'deposit', 60, now)).toBe(1);
    expect(countInWindow(events, 'any', 60, now)).toBe(2);
  });
});

describe('shouldFireFrequency', () => {
  it('fires once the count threshold is reached', () => {
    const now = Date.now();
    const events = [event(), event(), event()].map((e) => ({ ...e, closedAt: new Date(now).toISOString() }));
    expect(shouldFireFrequency(frequency, events, now, undefined)).toBe(true);
  });

  it('does not fire below the count threshold', () => {
    const now = Date.now();
    const events = [event()].map((e) => ({ ...e, closedAt: new Date(now).toISOString() }));
    expect(shouldFireFrequency(frequency, events, now, undefined)).toBe(false);
  });

  it('debounces: will not re-fire before the window elapses', () => {
    const now = Date.now();
    const events = [event(), event(), event()].map((e) => ({ ...e, closedAt: new Date(now).toISOString() }));
    expect(shouldFireFrequency(frequency, events, now, now - 5_000)).toBe(false);
    expect(shouldFireFrequency(frequency, events, now, now - 61_000)).toBe(true);
  });
});

describe('evaluateNewEvent', () => {
  it('returns fired alerts for matching threshold rules', () => {
    const fired = evaluateNewEvent([threshold], event(), [], {}, Date.now());
    expect(fired).toHaveLength(1);
    expect(fired[0].ruleId).toBe('r1');
    expect(fired[0].message).toContain('deposit');
  });

  it('returns nothing when no rule matches', () => {
    const fired = evaluateNewEvent([threshold], event({ kind: 'claim' }), [], {}, Date.now());
    expect(fired).toHaveLength(0);
  });

  it('evaluates frequency rules against the recent window', () => {
    const now = Date.now();
    const recent = [event(), event(), event()].map((e) => ({ ...e, closedAt: new Date(now).toISOString() }));
    const fired = evaluateNewEvent([frequency], event(), recent, {}, now);
    expect(fired.map((f) => f.ruleId)).toEqual(['r2']);
  });
});
