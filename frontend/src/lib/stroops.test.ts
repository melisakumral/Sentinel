import { describe, expect, it } from 'vitest';
import { toStroops, fromStroops, STROOPS_PER_XLM } from './stroops';

describe('stroop <-> XLM conversion', () => {
  it('converts whole XLM amounts to stroops', () => {
    expect(toStroops(1)).toBe(STROOPS_PER_XLM);
    expect(toStroops(50)).toBe(500_000_000n);
  });

  it('converts stroops back to XLM', () => {
    expect(fromStroops(500_000_000n)).toBe(50);
    expect(fromStroops(0n)).toBe(0);
  });

  it('round-trips without losing precision for typical amounts', () => {
    const amounts = [0.5, 1, 10, 12.3456789];
    for (const xlm of amounts) {
      expect(fromStroops(toStroops(xlm))).toBeCloseTo(xlm, 6);
    }
  });
});
