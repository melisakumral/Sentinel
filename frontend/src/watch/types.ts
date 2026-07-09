// Shared types for the Watch module. A WatchEvent is intentionally generic —
// unlike the crowdfunding Activity Feed, Watch has no fixed schema because it
// can point at any Soroban contract, not just Sentinel's own.
export interface WatchEvent {
  id: string;
  ledger: number;
  closedAt: string; // ISO timestamp, from the RPC's ledgerClosedAt
  txHash: string;
  kind: string; // best-effort label: the first topic if it looks like a name, else "event"
  topics: unknown[]; // all decoded topics, in order
  value: unknown; // decoded event value/body
  numericValue: bigint | null; // best-effort numeric extraction of `value`, for threshold rules
}
