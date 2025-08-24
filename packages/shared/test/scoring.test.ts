import { describe, it, expect } from 'vitest';
import { computeScore } from '../src/scoring/computeScore';
import { DrawdownTracker } from '../src/scoring/drawdown';

describe('Scoring System', () => {
  describe('Score Computation', () => {
    it('should calculate risk-adjusted score correctly', () => {
      const metrics = {
        realizedPnL: 10000,
        unrealizedPnL: 5000,
        breachTime: 120, // 2 minutes
        breachCount: 2,
        varExcess: 2000,
        maxDrawdown: 3000,
        totalFees: 500
      };
      
      const weights = {
        breachPenaltyWeight: 10,
        varPenaltyWeight: 5,
        drawdownPenaltyWeight: 2,
        feeWeight: 1
      };
      
      const score = computeScore(metrics, weights);
      
      // Score = Total P&L - weighted penalties
      const totalPnL = metrics.realizedPnL + metrics.unrealizedPnL;
      const breachPenalty = weights.breachPenaltyWeight * metrics.breachTime;
      const varPenalty = weights.varPenaltyWeight * (metrics.varExcess / 1000);
      const drawdownPenalty = weights.drawdownPenaltyWeight * (metrics.maxDrawdown / 1000);
      const feePenalty = weights.feeWeight * metrics.totalFees;
      
      const expectedScore = totalPnL - breachPenalty - varPenalty - drawdownPenalty - feePenalty;
      
      expect(score).toBeCloseTo(expectedScore, 2);
    });

    it('should handle perfect score (no penalties)', () => {
      const metrics = {
        realizedPnL: 10000,
        unrealizedPnL: 5000,
        breachTime: 0,
        breachCount: 0,
        varExcess: 0,
        maxDrawdown: 0,
        totalFees: 100
      };
      
      const weights = {
        breachPenaltyWeight: 10,
        varPenaltyWeight: 5,
        drawdownPenaltyWeight: 2,
        feeWeight: 1
      };
      
      const score = computeScore(metrics, weights);
      
      expect(score).toBe(15000 - 100); // P&L minus fees only
    });

    it('should handle negative P&L', () => {
      const metrics = {
        realizedPnL: -5000,
        unrealizedPnL: -2000,
        breachTime: 60,
        breachCount: 1,
        varExcess: 1000,
        maxDrawdown: 7000,
        totalFees: 200
      };
      
      const weights = {
        breachPenaltyWeight: 10,
        varPenaltyWeight: 5,
        drawdownPenaltyWeight: 2,
        feeWeight: 1
      };
      
      const score = computeScore(metrics, weights);
      
      expect(score).toBeLessThan(-7000); // Negative P&L plus penalties
    });
  });

  describe('Drawdown Tracking', () => {
    let tracker: DrawdownTracker;
    
    beforeEach(() => {
      tracker = new DrawdownTracker(100000); // $100k initial
    });

    it('should track maximum drawdown correctly', () => {
      tracker.updateEquity(110000); // +$10k
      tracker.updateEquity(105000); // -$5k from peak
      tracker.updateEquity(95000);  // -$15k from peak
      tracker.updateEquity(100000); // Recover to initial
      
      const maxDrawdown = tracker.getMaxDrawdown();
      expect(maxDrawdown).toBe(15000); // Max was $15k down from $110k peak
    });

    it('should calculate drawdown percentage', () => {
      tracker.updateEquity(120000); // Peak at $120k
      tracker.updateEquity(96000);  // Drop to $96k
      
      const maxDrawdown = tracker.getMaxDrawdown();
      const drawdownPercent = tracker.getMaxDrawdownPercent();
      
      expect(maxDrawdown).toBe(24000);
      expect(drawdownPercent).toBeCloseTo(20, 1); // 20% drawdown
    });

    it('should handle continuous gains (no drawdown)', () => {
      tracker.updateEquity(101000);
      tracker.updateEquity(102000);
      tracker.updateEquity(103000);
      
      const maxDrawdown = tracker.getMaxDrawdown();
      expect(maxDrawdown).toBe(0);
    });

    it('should track current drawdown', () => {
      tracker.updateEquity(110000); // Peak
      tracker.updateEquity(105000); // Current
      
      const currentDrawdown = tracker.getCurrentDrawdown();
      expect(currentDrawdown).toBe(5000);
    });

    it('should calculate Calmar ratio', () => {
      tracker.updateEquity(120000); // +$20k gain
      tracker.updateEquity(110000); // $10k drawdown
      
      const calmarRatio = tracker.getCalmarRatio();
      // Calmar = Annual Return / Max Drawdown
      // For simplicity, assuming 20% return and 10% max drawdown
      expect(calmarRatio).toBeCloseTo(2, 1);
    });
  });

  describe('Breach Penalty Calculations', () => {
    it('should calculate breach penalties correctly', () => {
      const breaches = [
        { duration: 60, type: 'DELTA' },   // 1 minute
        { duration: 120, type: 'GAMMA' },  // 2 minutes
        { duration: 30, type: 'VEGA' }     // 30 seconds
      ];
      
      const totalBreachTime = breaches.reduce((sum, b) => sum + b.duration, 0);
      expect(totalBreachTime).toBe(210); // 3.5 minutes total
      
      const penaltyPerSecond = 1;
      const totalPenalty = totalBreachTime * penaltyPerSecond;
      expect(totalPenalty).toBe(210);
    });

    it('should apply different weights to different breach types', () => {
      const breachWeights = {
        'DELTA': 1.0,
        'GAMMA': 1.5,
        'VEGA': 1.2,
        'THETA': 0.8,
        'VAR': 2.0
      };
      
      const breaches = [
        { duration: 60, type: 'DELTA', weight: breachWeights['DELTA'] },
        { duration: 60, type: 'VAR', weight: breachWeights['VAR'] }
      ];
      
      const weightedPenalty = breaches.reduce(
        (sum, b) => sum + b.duration * b.weight, 0
      );
      
      expect(weightedPenalty).toBe(60 * 1.0 + 60 * 2.0); // 180
    });
  });

  describe('Competition vs Training Mode', () => {
    it('should apply higher penalties in competition mode', () => {
      const metrics = {
        realizedPnL: 10000,
        unrealizedPnL: 0,
        breachTime: 60,
        breachCount: 1,
        varExcess: 1000,
        maxDrawdown: 2000,
        totalFees: 100
      };
      
      const trainingWeights = {
        breachPenaltyWeight: 5,
        varPenaltyWeight: 2,
        drawdownPenaltyWeight: 1,
        feeWeight: 1
      };
      
      const competitionWeights = {
        breachPenaltyWeight: 20,
        varPenaltyWeight: 10,
        drawdownPenaltyWeight: 5,
        feeWeight: 1
      };
      
      const trainingScore = computeScore(metrics, trainingWeights);
      const competitionScore = computeScore(metrics, competitionWeights);
      
      expect(competitionScore).toBeLessThan(trainingScore);
    });
  });
});
