export const RULE_WEIGHTS: Record<string, number> = {
  structuring: 1.0,
  cycle: 1.2,
  'fan-in-fan-out': 0.8,
  'mule-network': 1.5
};

export interface RiskSignal {
  ruleName: string;
  score: number;
}

/**
 * Combines independent rule-hit scores into a single account risk score in [0, 1]
 * via a noisy-OR: risk = 1 - product(1 - weight_i * score_i). This saturates
 * gracefully as more/stronger signals stack up, rather than letting scores
 * from many weak rule hits sum past 1.
 */
export function combineRiskSignals(signals: RiskSignal[]): number {
  let survivalProbability = 1;
  for (const signal of signals) {
    const weight = RULE_WEIGHTS[signal.ruleName] ?? 1;
    const weighted = Math.min(1, Math.max(0, signal.score * weight));
    survivalProbability *= 1 - weighted;
  }
  return 1 - survivalProbability;
}
