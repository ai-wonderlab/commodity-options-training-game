// Drawdown Tracking
// Monitors and calculates maximum drawdown for risk-adjusted scoring

export interface EquityPoint {
  timestamp: Date;
  value: number; // Total equity (realized + unrealized P&L + initial bankroll)
  realizedPnL: number;
  unrealizedPnL: number;
}

export interface DrawdownMetrics {
  currentDrawdown: number; // Current drawdown from peak
  maxDrawdown: number; // Maximum drawdown observed
  maxDrawdownPercent: number; // Max drawdown as percentage
  currentPeak: number; // Current equity peak
  drawdownStart?: Date; // When current drawdown started
  maxDrawdownStart?: Date; // When max drawdown started
  maxDrawdownEnd?: Date; // When max drawdown ended
  recoveryTime?: number; // Time to recover from max drawdown (minutes)
  underwaterPeriods: number; // Number of distinct drawdown periods
  totalUnderwaterTime: number; // Total time in drawdown (minutes)
}

export class DrawdownTracker {
  private equityHistory: EquityPoint[] = [];
  private currentPeak: number = 0;
  private maxDrawdown: number = 0;
  private maxDrawdownPercent: number = 0;
  private initialBankroll: number;
  private drawdownStart?: Date;
  private maxDrawdownStart?: Date;
  private maxDrawdownEnd?: Date;
  private underwaterPeriods: number = 0;
  private totalUnderwaterMinutes: number = 0;
  private lastUpdateTime?: Date;
  private inDrawdown: boolean = false;

  constructor(initialBankroll: number) {
    this.initialBankroll = initialBankroll;
    this.currentPeak = initialBankroll;
  }

  /**
   * Update equity and calculate drawdown metrics
   */
  updateEquity(
    realizedPnL: number,
    unrealizedPnL: number,
    timestamp: Date = new Date()
  ): DrawdownMetrics {
    const totalEquity = this.initialBankroll + realizedPnL + unrealizedPnL;
    
    // Add to history
    this.equityHistory.push({
      timestamp,
      value: totalEquity,
      realizedPnL,
      unrealizedPnL
    });

    // Update peak
    if (totalEquity > this.currentPeak) {
      // Recovered to new peak
      if (this.inDrawdown && this.drawdownStart) {
        const drawdownMinutes = 
          (timestamp.getTime() - this.drawdownStart.getTime()) / (1000 * 60);
        this.totalUnderwaterMinutes += drawdownMinutes;
        
        // Check if this was the max drawdown recovery
        if (this.maxDrawdownEnd === undefined && 
            Math.abs(this.currentPeak - totalEquity - this.maxDrawdown) < 0.01) {
          this.maxDrawdownEnd = timestamp;
        }
      }
      
      this.currentPeak = totalEquity;
      this.drawdownStart = undefined;
      this.inDrawdown = false;
    }

    // Calculate current drawdown
    const currentDrawdown = this.currentPeak - totalEquity;
    const currentDrawdownPercent = (currentDrawdown / this.currentPeak) * 100;

    // Track drawdown periods
    if (currentDrawdown > 0) {
      if (!this.inDrawdown) {
        // Starting new drawdown period
        this.underwaterPeriods++;
        this.drawdownStart = timestamp;
        this.inDrawdown = true;
      }

      // Update time underwater
      if (this.lastUpdateTime && this.inDrawdown) {
        const minutesSinceLastUpdate = 
          (timestamp.getTime() - this.lastUpdateTime.getTime()) / (1000 * 60);
        this.totalUnderwaterMinutes += minutesSinceLastUpdate;
      }

      // Check if this is a new maximum drawdown
      if (currentDrawdown > this.maxDrawdown) {
        this.maxDrawdown = currentDrawdown;
        this.maxDrawdownPercent = currentDrawdownPercent;
        this.maxDrawdownStart = this.drawdownStart;
        this.maxDrawdownEnd = undefined; // Reset recovery time
      }
    }

    this.lastUpdateTime = timestamp;

    return this.getMetrics();
  }

  /**
   * Get current drawdown metrics
   */
  getMetrics(): DrawdownMetrics {
    const latestEquity = this.equityHistory.length > 0
      ? this.equityHistory[this.equityHistory.length - 1]
      : { value: this.initialBankroll } as EquityPoint;

    const currentDrawdown = Math.max(0, this.currentPeak - latestEquity.value);
    const currentDrawdownPercent = (currentDrawdown / this.currentPeak) * 100;

    let recoveryTime: number | undefined;
    if (this.maxDrawdownStart && this.maxDrawdownEnd) {
      recoveryTime = 
        (this.maxDrawdownEnd.getTime() - this.maxDrawdownStart.getTime()) / (1000 * 60);
    }

    return {
      currentDrawdown: Number(currentDrawdown.toFixed(2)),
      maxDrawdown: Number(this.maxDrawdown.toFixed(2)),
      maxDrawdownPercent: Number(this.maxDrawdownPercent.toFixed(2)),
      currentPeak: Number(this.currentPeak.toFixed(2)),
      drawdownStart: this.drawdownStart,
      maxDrawdownStart: this.maxDrawdownStart,
      maxDrawdownEnd: this.maxDrawdownEnd,
      recoveryTime,
      underwaterPeriods: this.underwaterPeriods,
      totalUnderwaterTime: Math.round(this.totalUnderwaterMinutes)
    };
  }

  /**
   * Get equity history for charting
   */
  getEquityHistory(): EquityPoint[] {
    return [...this.equityHistory];
  }

  /**
   * Calculate Calmar Ratio (annualized return / max drawdown)
   */
  getCalmarRatio(periodDays: number = 252): number {
    if (this.equityHistory.length < 2 || this.maxDrawdown === 0) {
      return 0;
    }

    const firstEquity = this.equityHistory[0].value;
    const lastEquity = this.equityHistory[this.equityHistory.length - 1].value;
    const totalReturn = (lastEquity - firstEquity) / firstEquity;
    
    // Annualize the return
    const timeSpanDays = 
      (this.equityHistory[this.equityHistory.length - 1].timestamp.getTime() - 
       this.equityHistory[0].timestamp.getTime()) / (1000 * 60 * 60 * 24);
    const annualizedReturn = totalReturn * (periodDays / Math.max(timeSpanDays, 1));
    
    const maxDrawdownPercent = this.maxDrawdownPercent / 100;
    const calmarRatio = annualizedReturn / Math.max(maxDrawdownPercent, 0.01);
    
    return Number(calmarRatio.toFixed(2));
  }

  /**
   * Calculate recovery factor (net profit / max drawdown)
   */
  getRecoveryFactor(): number {
    if (this.maxDrawdown === 0) return 0;
    
    const lastEquity = this.equityHistory.length > 0
      ? this.equityHistory[this.equityHistory.length - 1]
      : { value: this.initialBankroll } as EquityPoint;
    
    const netProfit = lastEquity.value - this.initialBankroll;
    const recoveryFactor = netProfit / this.maxDrawdown;
    
    return Number(recoveryFactor.toFixed(2));
  }

  /**
   * Reset tracker
   */
  reset(newBankroll?: number): void {
    this.equityHistory = [];
    this.initialBankroll = newBankroll || this.initialBankroll;
    this.currentPeak = this.initialBankroll;
    this.maxDrawdown = 0;
    this.maxDrawdownPercent = 0;
    this.drawdownStart = undefined;
    this.maxDrawdownStart = undefined;
    this.maxDrawdownEnd = undefined;
    this.underwaterPeriods = 0;
    this.totalUnderwaterMinutes = 0;
    this.lastUpdateTime = undefined;
    this.inDrawdown = false;
  }
}

/**
 * Calculate drawdown series from equity curve
 */
export function calculateDrawdownSeries(equityPoints: EquityPoint[]): number[] {
  if (equityPoints.length === 0) return [];
  
  const drawdowns: number[] = [];
  let runningPeak = equityPoints[0].value;
  
  for (const point of equityPoints) {
    if (point.value > runningPeak) {
      runningPeak = point.value;
    }
    const drawdown = runningPeak - point.value;
    drawdowns.push(drawdown);
  }
  
  return drawdowns;
}

/**
 * Find all drawdown periods in equity curve
 */
export interface DrawdownPeriod {
  start: Date;
  end?: Date;
  depth: number;
  depthPercent: number;
  duration?: number; // minutes
  recovered: boolean;
}

export function findDrawdownPeriods(equityPoints: EquityPoint[]): DrawdownPeriod[] {
  if (equityPoints.length === 0) return [];
  
  const periods: DrawdownPeriod[] = [];
  let runningPeak = equityPoints[0].value;
  let currentPeriod: DrawdownPeriod | null = null;
  
  for (let i = 0; i < equityPoints.length; i++) {
    const point = equityPoints[i];
    
    if (point.value >= runningPeak) {
      // Reached new peak or recovered
      if (currentPeriod) {
        // End current drawdown period
        currentPeriod.end = point.timestamp;
        currentPeriod.duration = 
          (currentPeriod.end.getTime() - currentPeriod.start.getTime()) / (1000 * 60);
        currentPeriod.recovered = true;
        periods.push(currentPeriod);
        currentPeriod = null;
      }
      runningPeak = point.value;
    } else {
      // In drawdown
      const drawdown = runningPeak - point.value;
      const drawdownPercent = (drawdown / runningPeak) * 100;
      
      if (!currentPeriod) {
        // Start new drawdown period
        currentPeriod = {
          start: point.timestamp,
          depth: drawdown,
          depthPercent: drawdownPercent,
          recovered: false
        };
      } else {
        // Update depth if deeper
        if (drawdown > currentPeriod.depth) {
          currentPeriod.depth = drawdown;
          currentPeriod.depthPercent = drawdownPercent;
        }
      }
    }
  }
  
  // Add unfinished period if exists
  if (currentPeriod) {
    periods.push(currentPeriod);
  }
  
  return periods;
}

/**
 * Format drawdown metrics for display
 */
export function formatDrawdownMetrics(metrics: DrawdownMetrics): Record<string, string> {
  const formatCurrency = (val: number) => `$${Math.abs(val).toLocaleString()}`;
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };
  
  return {
    'Current Drawdown': formatCurrency(metrics.currentDrawdown),
    'Max Drawdown': formatCurrency(metrics.maxDrawdown),
    'Max Drawdown %': formatPercent(metrics.maxDrawdownPercent),
    'Current Peak': formatCurrency(metrics.currentPeak),
    'Underwater Periods': metrics.underwaterPeriods.toString(),
    'Total Time Underwater': formatTime(metrics.totalUnderwaterTime),
    'Recovery Time': metrics.recoveryTime 
      ? formatTime(metrics.recoveryTime) 
      : 'Not recovered'
  };
}
