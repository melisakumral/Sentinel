// Vercel serverless function — Black Belt "Fee Sponsorship" advanced feature.
//
// The client builds, prepares, and signs an ordinary Soroban invocation with
// the donor's own wallet (see lib/contract.ts's signInvocation()), exactly
// as it would for a normal transaction — the donor still authorizes the
// operation. That signed transaction is POSTed here as `signedTxXdr`. This
// function wraps it in a CAP-15 fee-bump transaction paid for by a
// server-only sponsor account, so the donor never needs XLM in their wallet
// just to cover the network fee.
//
// SECURITY: the sponsor's secret key only ever lives in this server-side
// function (env var `SPONSOR_SECRET_KEY`, never prefixed with `VITE_`, so
// Vite never bundles it into client JS). Before sponsoring, we verify the
// signed transaction contains exactly one operation that invokes *this*
// deployment's contract (`VITE_CONTRACT_ID`) calling an allowed write
// function — otherwise anyone could point this endpoint at an unrelated
// transaction and drain the sponsor account for free.
import { Keypair, Networks, TransactionBuilder, rpc } from 'stellar-sdk';
import { validateSponsorable, isValidationFail } from './_lib/validateSponsorable.js';

// Minimal structural types for the Vercel Node request/response — avoids
// pulling in @vercel/node (which drags in a large, vulnerability-heavy
// transitive dependency tree) just for two interface shapes.
interface VercelRequest {
  method?: string;
  body?: unknown;
}
interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
}

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const SPONSOR_FEE = '1000000'; // 0.1 XLM cap — comfortably covers a Soroban invocation's resource fee.
const CONFIRM_ATTEMPTS = 15; // ~22.5s of polling at 1.5s each, bounded so the function can't hang past its execution limit.

// Vercel Node functions default to a 10s execution limit on some plans;
// confirmation polling below can take longer than that on a busy ledger.
export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sponsorSecret = process.env.SPONSOR_SECRET_KEY;
  const contractId = process.env.VITE_CONTRACT_ID;
  if (!sponsorSecret || !contractId) {
    res.status(503).json({ error: 'Fee sponsorship is not configured on this deployment.' });
    return;
  }

  const body = (req.body ?? {}) as { signedTxXdr?: unknown };
  if (typeof body.signedTxXdr !== 'string' || !body.signedTxXdr) {
    res.status(400).json({ error: 'signedTxXdr is required.' });
    return;
  }

  const validation = validateSponsorable(body.signedTxXdr, contractId, NETWORK_PASSPHRASE);
  if (isValidationFail(validation)) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }
  const innerTx = validation.tx;

  try {
    const sponsor = Keypair.fromSecret(sponsorSecret);
    const server = new rpc.Server(RPC_URL);

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(sponsor, SPONSOR_FEE, innerTx, NETWORK_PASSPHRASE);
    feeBumpTx.sign(sponsor);

    const sent = await server.sendTransaction(feeBumpTx);
    if ((sent.status as string) === 'ERROR') {
      res.status(400).json({ error: 'Transaction rejected by the network.', detail: sent.errorResult });
      return;
    }

    let got = await server.getTransaction(sent.hash);
    let attempts = 0;
    while (got.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < CONFIRM_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 1500));
      got = await server.getTransaction(sent.hash);
      attempts += 1;
    }
    if (got.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      // Not necessarily failed — just not confirmed within our polling budget.
      res.status(202).json({ hash: sent.hash, pending: true });
      return;
    }
    if (got.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      res.status(400).json({ error: 'Transaction failed on-chain.', detail: got.status });
      return;
    }

    res.status(200).json({ hash: sent.hash });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
