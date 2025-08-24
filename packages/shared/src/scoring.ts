// Scoring System for the Commodity Options Training Game
// Score = Realized PnL - (breach_time × α + var_exceed × β + drawdown × γ + fees)

export interface ScoringWeights {
  alpha: number;  // Breach time penalty weight
  beta: number;   // VaR exceed penalty weight
  gamma: number;  // Drawdown penalty weight
  base_score: number; // Starting score
}

export interface RiskBreach {
  type: 'DELTA' | 'GAMMA' | 'VEGA' | 'THETA' | 'VAR';
  startTime: Date;
  endTime?: Date;
  severity: 'WARNING' | 'BREACH' | 'CRITICAL';
  limitValue: number;
  actualValue: number;
}

export interface PlayerMetrics {
  realizedPnL: number;
  unrealizedPnL: number;
  totalFees: number;
  maxDrawdown: number;
  currentDrawdown: number;
  breaches: RiskBreach[];
  varExceeds: number;
  sharpeRatio?: number;
  winRate?: number;
  avgWin?: number;
  avgLoss?: number;
}

export class ScoringEngine {
  private weights: ScoringWeights;
  private highWaterMark: number = 0;

  constructor(
    weights: ScoringWeights = {
      alpha: 0.1,  // 0.1 points per second of breach
      beta: 0.2,   // 0.2 points per dollar of VaR exceed
      gamma: 0.1,  // 0.1 points per percent of drawdown
      base_score: 1000
    }
  ) {
    this.weights = weights;
  }

  // Calculate total score for a player
  public calculateScore(metrics: PlayerMetrics): number {
    let score = this.weights.base_score;

    // Add realized PnL
    score += metrics.realizedPnL;

    // Subtract fees (already part of PnL but can be double-penalized if desired)
    // score -= metrics.totalFees * 0.5; // Optional: extra fee penalty

    // Calculate breach time penalty
    const breachTimePenalty = this.calculateBreachTimePenalty(metrics.breaches);
    score -= breachTimePenalty * this.weights.alpha;

    // Calculate VaR exceed penalty
    const varExceedPenalty = metrics.varExceeds;
    score -= varExceedPenalty * this.weights.beta;

    // Calculate drawdown penalty
    const drawdownPenalty = metrics.maxDrawdown;
    score -= drawdownPenalty * this.weights.gamma;

    return Math.max(0, Math.round(score)); // Score cannot be negative
  }

  // Calculate total breach time in seconds
  private calculateBreachTimePenalty(breaches: RiskBreach[]): number {
    let totalBreachTime = 0;

    for (const breach of breaches) {
      if (breach.severity === 'BREACH' || breach.severity === 'CRITICAL') {
        const endTime = breach.endTime || new Date();
        const breachDuration = (endTime.getTime() - breach.startTime.getTime()) / 1000; // in seconds
        
        // Apply multiplier for critical breaches
        const multiplier = breach.severity === 'CRITICAL' ? 2.0 : 1.0;
        totalBreachTime += breachDuration * multiplier;
      }
    }

    return totalBreachTime;
  }

  // Update high water mark and calculate drawdown
  public updateDrawdown(currentPortfolioValue: number): number {
    if (currentPortfolioValue > this.highWaterMark) {
      this.highWaterMark = currentPortfolioValue;
      return 0;
    }

    const drawdown = ((this.highWaterMark - currentPortfolioValue) / this.highWaterMark) * 100;
    return drawdown;
  }

  // Calculate Sharpe Ratio
  public calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const excessReturns = returns.map(r => r - riskFreeRate / 252); // Daily risk-free rate

    const variance = excessReturns.reduce((sum, r) => {
      const diff = r - avgReturn;
      return sum + diff * diff;
    }, 0) / returns.length;

    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    return ((avgReturn - riskFreeRate / 252) / stdDev) * Math.sqrt(252); // Annualized
  }

  // Calculate win rate and average win/loss
  public calculateWinStats(trades: Array<{ pnl: number }>): {
    winRate: number;
    avgWin: number;
    avgLoss: number;
  } {
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0;

    return { winRate, avgWin, avgLoss };
  }

  // Generate performance report
  public generateReport(metrics: PlayerMetrics, trades: Array<{ pnl: number }>): {
    score: number;
    breakdown: {
      basePnL: number;
      breachPenalty: number;
      varPenalty: number;
      drawdownPenalty: number;
    };
    statistics: {
      totalPnL: number;
      sharpeRatio: number;
      winRate: number;
      avgWin: number;
      avgLoss: number;
      maxDrawdown: number;
      totalFees: number;
    };
  } {
    const score = this.calculateScore(metrics);
    const breachPenalty = this.calculateBreachTimePenalty(metrics.breaches) * this.weights.alpha;
    const varPenalty = metrics.varExceeds * this.weights.beta;
    const drawdownPenalty = metrics.maxDrawdown * this.weights.gamma;

    const returns = trades.map(t => t.pnl / this.weights.base_score); // Returns as percentage of initial capital
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const winStats = this.calculateWinStats(trades);

    return {
      score,
      breakdown: {
        basePnL: metrics.realizedPnL,
        breachPenalty,
        varPenalty,
        drawdownPenalty
      },
      statistics: {
        totalPnL: metrics.realizedPnL + metrics.unrealizedPnL,
        sharpeRatio,
        winRate: winStats.winRate,
        avgWin: winStats.avgWin,
        avgLoss: winStats.avgLoss,
        maxDrawdown: metrics.maxDrawdown,
        totalFees: metrics.totalFees
      }
    };
  }

  // Update scoring weights
  public updateWeights(weights: Partial<ScoringWeights>) {
    this.weights = { ...this.weights, ...weights };
  }

  // Reset for new session
  public reset() {
    this.highWaterMark = 0;
  }
}

// Singleton instance
export const scoringEngine = new ScoringEngine();
