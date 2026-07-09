// Pure stroop <-> XLM conversion. No dependencies, tested in isolation.
// 1 XLM = 10^7 stroops.
export const STROOPS_PER_XLM = 10_000_000n;

export const toStroops = (xlm: number): bigint =>
  BigInt(Math.round(xlm * Number(STROOPS_PER_XLM)));

export const fromStroops = (stroops: bigint): number =>
  Number(stroops) / Number(STROOPS_PER_XLM);
