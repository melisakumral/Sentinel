// Alert rule model + pure evaluation logic. No network, no localStorage —
// storage and RPC polling live in WatchApp; this file only decides whether a
// rule fires given events it's handed. Tested in isolation.
import type { WatchEvent } from '../types';

export type Comparator = '>' | '>=' | '<' | '<=';

interface RuleBase {
  id: string;
  contractId: string; // rules are scoped to the contract they were created for
  label: string;
  eventKind: string; // 'any' or a specific event kind (e.g. "deposit")
  enabled: boolean;
}

export interface ThresholdRule extends RuleBase {
  kind: 'threshold';
  comparator: Comparator;
  thresholdStroops: bigint;
}

export interface FrequencyRule extends RuleBase {
  kind: 'frequency';
  count: number;
  windowSeconds: number;
}

export type AlertRule = ThresholdRule | FrequencyRule;

export interface FiredAlert {
  ruleId: string;
  label: string;
  message: string;
  at: number; // epoch ms
}

export function newRuleId(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function matchesKind(rule: RuleBase, eventKind: string): boolean {
  return rule.eventKind === 'any' || rule.eventKind === eventKind;
}

function compare(comparator: Comparator, a: bigint, b: bigint): boolean {
  switch (comparator) {
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
  }
}

// Checks a single freshly-arrived event against a threshold rule.
export function matchesThreshold(rule: ThresholdRule, event: WatchEvent): boolean {
  if (!rule.enabled) return false;
  if (!matchesKind(rule, event.kind)) return false;
  if (event.numericValue === null) return false;
  return compare(rule.comparator, event.numericValue, rule.thresholdStroops);
}

// Counts events of a given kind whose ledger-close time falls within the
// trailing `windowSeconds` window ending at `nowMs`.
export function countInWindow(
  events: WatchEvent[],
  eventKind: string,
  windowSeconds: number,
  nowMs: number,
): number {
  const cutoff = nowMs - windowSeconds * 1000;
  return events.filter((e) => {
    if (eventKind !== 'any' && e.kind !== eventKind) return false;
    const t = Date.parse(e.closedAt);
    return Number.isFinite(t) && t >= cutoff;
  }).length;
}

// Frequency rules are debounced: once fired, they won't fire again until a
// full window has elapsed, so one burst of activity raises one alert rather
// than one per event.
export function shouldFireFrequency(
  rule: FrequencyRule,
  events: WatchEvent[],
  nowMs: number,
  lastFiredAt: number | undefined,
): boolean {
  if (!rule.enabled) return false;
  if (lastFiredAt !== undefined && nowMs - lastFiredAt < rule.windowSeconds * 1000) return false;
  return countInWindow(events, rule.eventKind, rule.windowSeconds, nowMs) >= rule.count;
}

const xlmFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatXlm(stroops: bigint): string {
  return xlmFormatter.format(Number(stroops) / 1e7);
}

// Evaluates every enabled rule against one newly-arrived event plus the
// recent event window (needed for frequency rules), returning whichever
// alerts fire. `lastFiredAt` is a ruleId -> epoch-ms map the caller persists
// across polls so frequency rules can debounce themselves.
export function evaluateNewEvent(
  rules: AlertRule[],
  event: WatchEvent,
  recentEvents: WatchEvent[],
  lastFiredAt: Record<string, number>,
  nowMs: number,
): FiredAlert[] {
  const fired: FiredAlert[] = [];
  for (const rule of rules) {
    if (rule.kind === 'threshold') {
      if (matchesThreshold(rule, event)) {
        fired.push({
          ruleId: rule.id,
          label: rule.label,
          message: `${event.kind} · ${formatXlm(event.numericValue ?? 0n)} XLM ${rule.comparator} ${formatXlm(rule.thresholdStroops)} XLM (ledger ${event.ledger})`,
          at: nowMs,
        });
      }
    } else if (shouldFireFrequency(rule, recentEvents, nowMs, lastFiredAt[rule.id])) {
      fired.push({
        ruleId: rule.id,
        label: rule.label,
        message: `${rule.count}+ "${rule.eventKind}" events in the last ${rule.windowSeconds}s`,
        at: nowMs,
      });
    }
  }
  return fired;
}
