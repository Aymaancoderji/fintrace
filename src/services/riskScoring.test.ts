import { describe, it, expect } from 'vitest';
import { combineRiskSignals } from './riskScoring.js';

describe('combineRiskSignals', () => {
  it('returns 0 for no signals', () => {
    expect(combineRiskSignals([])).toBe(0);
  });

  it('weights a single signal by its rule weight', () => {
    const score = combineRiskSignals([{ ruleName: 'structuring', score: 0.5 }]);
    expect(score).toBeCloseTo(0.5, 5); // weight 1.0
  });

  it('saturates toward 1 as more/stronger signals stack up', () => {
    const score = combineRiskSignals([
      { ruleName: 'mule-network', score: 0.9 },
      { ruleName: 'cycle', score: 0.9 },
      { ruleName: 'structuring', score: 0.9 }
    ]);
    expect(score).toBeGreaterThan(0.9);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('never exceeds 1 even with weighted scores above 1', () => {
    // mule-network has weight 1.5, so 0.9 * 1.5 > 1 before clamping
    const score = combineRiskSignals([{ ruleName: 'mule-network', score: 0.9 }]);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('treats unknown rule names with a default weight of 1', () => {
    const score = combineRiskSignals([{ ruleName: 'unknown-rule', score: 0.4 }]);
    expect(score).toBeCloseTo(0.4, 5);
  });
});
