// Risk-Adjusted Scoring System
// Implements scoring with penalties for risk breaches and drawdowns

export interface ScoreInputs {
  // P&L components
  realizedPnL: number;
  unrealizedPnL: number;
  
  // Risk breach metrics
  totalBreachSeconds: number;
  breachSeverityWeighted: number; // Weighted by breach type
  
  // VaR metrics
  currentVaR: number;
  varLimit: number;
  
  // Drawdown metrics
  maxDrawdown: number;
  currentDrawdown: number;
  
  // Trading costs
  totalFees: number;
  totalCommissions: number;
  
  // Session configuration
  weights: ScoringWeights;
  
  // Time metrics
  sessionDurationMinutes: number;
  elapsedMinutes: number;
}

export interface ScoringWeights {
  breachPenaltyWeight: number; // α: Weight for breach time penalties
  varPenaltyWeight: number; // β: Weight for VaR excess penalties
  drawdownPenaltyWeight: number; // γ: Weight for drawdown penalties
  feeWeight: number; // δ: Weight for trading costs
}

export interface ScoreResult {
  grossPnL: number;
  totalPenalties: number;
  adjustedScore: number;
  components: ScoreComponents;
  rank?: number;
  percentile?: number;
  timestamp: Date;
}

export interface ScoreComponents {
  realizedPnL: number;
  unrealizedPnL: number;
  breachPenalty: number;
  varPenalty: number;
  drawdownPenalty: number;
  feePenalty: number;
}

/**
 * Calculate risk-adjusted score
 * Score = realizedPnL - (α * breachSeconds + β * max(0, VaR-limit) + γ * maxDrawdown + δ * fees)
 */
export function computeScore(inputs: ScoreInputs): ScoreResult {
  const {
    realizedPnL,
    unrealizedPnL,
    totalBreachSeconds,
    breachSeverityWeighted,
    currentVaR,
    varLimit,
    maxDrawdown,
    totalFees,
    totalCommissions,
    weights,
    sessionDurationMinutes,
    elapsedMinutes
  } = inputs;
  
  // Calculate gross P&L (realized only for scoring)
  const grossPnL = realizedPnL;
  
  // Calculate breach penalty
  // Weight by severity and normalize by session time
  const normalizedBreachTime = totalBreachSeconds / 60; // Convert to minutes
  const breachRatio = normalizedBreachTime / Math.max(elapsedMinutes, 1);
  const breachPenalty = weights.breachPenaltyWeight * breachSeverityWeighted * breachRatio;
  
  // Calculate VaR excess penalty
  const varExcess = Math.max(0, currentVaR - varLimit);
  const varPenalty = weights.varPenaltyWeight * varExcess;
  
  // Calculate drawdown penalty
  const drawdownPenalty = weights.drawdownPenaltyWeight * maxDrawdown;
  
  // Calculate fee penalty
  const totalTradingCosts = totalFees + totalCommissions;
  const feePenalty = weights.feeWeight * totalTradingCosts;
  
  // Total penalties
  const totalPenalties = breachPenalty + varPenalty + drawdownPenalty + feePenalty;
  
  // Adjusted score
  const adjustedScore = grossPnL - totalPenalties;
  
  return {
    grossPnL: Number(grossPnL.toFixed(2)),
    totalPenalties: Number(totalPenalties.toFixed(2)),
    adjustedScore: Number(adjustedScore.toFixed(2)),
    components: {
      realizedPnL: Number(realizedPnL.toFixed(2)),
      unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
      breachPenalty: Number(breachPenalty.toFixed(2)),
      varPenalty: Number(varPenalty.toFixed(2)),
      drawdownPenalty: Number(drawdownPenalty.toFixed(2)),
      feePenalty: Number(feePenalty.toFixed(2))
    },
    timestamp: new Date()
  };
}

/**
 * Calculate breach severity weighting
 * Different breach types have different severity multipliers
 */
export function calculateBreachSeverity(breaches: BreachRecord[]): number {
  const severityWeights = {
    delta: 1.0,
    gamma: 1.5,
    vega: 1.0,
    theta: 0.8,
    var: 2.0 // VaR breaches are most severe
  };
  
  let weightedSeconds = 0;
  
  for (const breach of breaches) {
    const weight = severityWeights[breach.type] || 1.0;
    weightedSeconds += breach.durationSeconds * weight;
  }
  
  return weightedSeconds;
}

export interface BreachRecord {
  type: 'delta' | 'gamma' | 'vega' | 'theta' | 'var';
  durationSeconds: number;
  openedAt: Date;
  closedAt?: Date;
}

/**
 * Calculate score percentile within a session
 */
export function calculatePercentile(
  myScore: number,
  allScores: number[]
): number {
  if (allScores.length === 0) return 100;
  
  const sortedScores = [...allScores].sort((a, b) => a - b);
  const position = sortedScores.findIndex(score => score >= myScore);
  
  if (position === -1) return 100;
  
  const percentile = (position / allScores.length) * 100;
  return Number(percentile.toFixed(1));
}

/**
 * Generate score report for display
 */
export interface ScoreReport {
  score: string;
  grossPnL: string;
  penalties: string;
  rank: string;
  percentile: string;
  breakdown: {
    label: string;
    value: string;
    impact: string;
  }[];
}

export function generateScoreReport(
  result: ScoreResult,
  rank: number,
  totalParticipants: number
): ScoreReport {
  const formatCurrency = (val: number) => {
    const prefix = val < 0 ? '-$' : '$';
    return prefix + Math.abs(val).toLocaleString();
  };
  
  const formatImpact = (val: number) => {
    if (val === 0) return '—';
    return val > 0 ? `+${formatCurrency(val)}` : formatCurrency(val);
  };
  
  return {
    score: formatCurrency(result.adjustedScore),
    grossPnL: formatCurrency(result.grossPnL),
    penalties: formatCurrency(-result.totalPenalties),
    rank: `${rank} / ${totalParticipants}`,
    percentile: `${result.percentile?.toFixed(0) || 0}%`,
    breakdown: [
      {
        label: 'Realized P&L',
        value: formatCurrency(result.components.realizedPnL),
        impact: formatImpact(result.components.realizedPnL)
      },
      {
        label: 'Unrealized P&L',
        value: formatCurrency(result.components.unrealizedPnL),
        impact: '(not scored)'
      },
      {
        label: 'Breach Penalty',
        value: formatCurrency(result.components.breachPenalty),
        impact: formatImpact(-result.components.breachPenalty)
      },
      {
        label: 'VaR Penalty',
        value: formatCurrency(result.components.varPenalty),
        impact: formatImpact(-result.components.varPenalty)
      },
      {
        label: 'Drawdown Penalty',
        value: formatCurrency(result.components.drawdownPenalty),
        impact: formatImpact(-result.components.drawdownPenalty)
      },
      {
        label: 'Trading Costs',
        value: formatCurrency(result.components.feePenalty),
        impact: formatImpact(-result.components.feePenalty)
      }
    ]
  };
}

/**
 * Default scoring weights
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  breachPenaltyWeight: 10,
  varPenaltyWeight: 5,
  drawdownPenaltyWeight: 2,
  feeWeight: 1
};

/**
 * Competition scoring weights (more aggressive penalties)
 */
export const COMPETITION_WEIGHTS: ScoringWeights = {
  breachPenaltyWeight: 25,
  varPenaltyWeight: 15,
  drawdownPenaltyWeight: 5,
  feeWeight: 1
};

/**
 * Training scoring weights (more forgiving)
 */
export const TRAINING_WEIGHTS: ScoringWeights = {
  breachPenaltyWeight: 5,
  varPenaltyWeight: 2,
  drawdownPenaltyWeight: 1,
  feeWeight: 1
};
