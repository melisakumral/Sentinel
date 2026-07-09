import { useState } from 'react';
import { ARG_TYPES, encodeArgs, type ArgInput, type ArgType } from '../lib/argEncoding';
import { simulateCall, type SimulationResult } from '../lib/sorobanWatch';

interface Props {
  defaultContractId: string;
  defaultSourceAddress: string;
}

function newArgRow(): ArgInput {
  return { type: 'string', value: '' };
}

function renderReturnValue(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v.toString()}n` : v), 2) ?? 'null';
  } catch {
    return String(value);
  }
}

export default function SimulatorPanel({ defaultContractId, defaultSourceAddress }: Props) {
  const [contractId, setContractId] = useState(defaultContractId);
  const [sourceAddress, setSourceAddress] = useState(defaultSourceAddress);
  const [fn, setFn] = useState('');
  const [args, setArgs] = useState<ArgInput[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateArg = (i: number, patch: Partial<ArgInput>) =>
    setArgs((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const removeArg = (i: number) => setArgs((prev) => prev.filter((_, idx) => idx !== i));

  const run = async () => {
    setError(null);
    setResult(null);
    if (!contractId.trim()) {
      setError('Enter a Contract ID to simulate against.');
      return;
    }
    if (!sourceAddress.trim()) {
      setError('Enter a source address (G...) to simulate as — it must be funded on testnet.');
      return;
    }
    if (!fn.trim()) {
      setError('Enter the contract function name to call.');
      return;
    }
    setRunning(true);
    try {
      const encoded = encodeArgs(args);
      const sim = await simulateCall(contractId.trim(), sourceAddress.trim(), fn.trim(), encoded);
      setResult(sim);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="watch-panel">
      <div className="watch-panel-head">
        <h2>Transaction Simulator</h2>
        <div className="watch-panel-meta">
          <span>dry-run via Soroban RPC — no signature, no fee, no state change</span>
        </div>
      </div>

      <div className="watch-form-row">
        <label className="watch-form-row--grow">
          Contract ID
          <input value={contractId} onChange={(e) => setContractId(e.target.value)} placeholder="C..." className="watch-mono-input" />
        </label>
      </div>
      <div className="watch-form-row">
        <label className="watch-form-row--grow">
          Simulate as (source address)
          <input
            value={sourceAddress}
            onChange={(e) => setSourceAddress(e.target.value)}
            placeholder="G... (must exist/be funded on testnet)"
            className="watch-mono-input"
          />
        </label>
        <label>
          Function
          <input value={fn} onChange={(e) => setFn(e.target.value)} placeholder="e.g. get_total" />
        </label>
      </div>

      <div className="watch-args-block">
        <div className="watch-args-head">
          <span>Arguments</span>
          <button type="button" className="watch-btn watch-btn--ghost" onClick={() => setArgs((prev) => [...prev, newArgRow()])}>
            + Add argument
          </button>
        </div>
        {args.length === 0 && <div className="watch-empty watch-empty--tight">No arguments — this call will run with none.</div>}
        {args.map((arg, i) => (
          <div className="watch-arg-row" key={i}>
            <select value={arg.type} onChange={(e) => updateArg(i, { type: e.target.value as ArgType })}>
              {ARG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={arg.value}
              onChange={(e) => updateArg(i, { value: e.target.value })}
              placeholder={arg.type === 'address' ? 'G... or C...' : arg.type === 'bool' ? 'true / false' : 'value'}
              className="watch-mono-input"
            />
            <button type="button" className="watch-btn watch-btn--danger" onClick={() => removeArg(i)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <button className="watch-btn watch-btn--primary watch-run-btn" onClick={run} disabled={running}>
        {running ? 'Simulating…' : '▶ Run simulation'}
      </button>

      {error && <div className="watch-banner watch-banner--error">{error}</div>}

      {result && (
        <div className={`watch-sim-result ${result.success ? 'watch-sim-result--ok' : 'watch-sim-result--fail'}`}>
          <div className="watch-sim-result-head">
            {result.success ? '✅ Simulation succeeded' : '❌ Simulation failed'}
            {result.needsRestore && <span className="watch-tag">state restore required</span>}
          </div>
          {result.success ? (
            <>
              <div className="watch-sim-label">Return value</div>
              <pre className="watch-code-block">{renderReturnValue(result.returnValue)}</pre>
              {result.minResourceFee && (
                <div className="watch-sim-fee">est. resource fee: {result.minResourceFee} stroops</div>
              )}
            </>
          ) : (
            <pre className="watch-code-block watch-code-block--error">{result.error}</pre>
          )}
        </div>
      )}
    </section>
  );
}
