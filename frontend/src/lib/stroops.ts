// Saf stroop <-> XLM dönüşümleri. Bağımlılığı yok, izole test edilebilir.
// 1 XLM = 10^7 stroop.
export const STROOPS_PER_XLM = 10_000_000n;

export const toStroops = (xlm: number): bigint =>
  BigInt(Math.round(xlm * Number(STROOPS_PER_XLM)));

export const fromStroops = (stroops: bigint): number =>
  Number(stroops) / Number(STROOPS_PER_XLM);
