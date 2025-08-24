import { describe, it, expect } from 'vitest';
import { aggregateGreeks } from '../src/risk/aggregateGreeks';
import { calculateVaR95 } from '../src/risk/var';

describe('Risk Engine', () => {
  describe('Greeks Aggregation', () => {
    const mockPositions = [
      {
        symbol: 'BRN',
        quantity: 100,
        isOption: false,
        futuresPrice: 82.5
      },
      {
        symbol: 'BUL85C1M',
        quantity: 50,
        isOption: true,
        underlyingPrice: 82.5,
        strike: 85,
        timeToExpiry: 1/12,
        volatility: 0.25,
        optionType: 'C' as const
      },
      {
        symbol: 'BUL80P2M',
        quantity: -25,
        isOption: true,
        underlyingPrice: 82.5,
        strike: 80,
        timeToExpiry: 2/12,
        volatility: 0.30,
        optionType: 'P' as const
      }
    ];

    it('should aggregate portfolio Greeks correctly', () => {
      const greeks = aggregateGreeks(mockPositions, 82.5, 0.05);
      
      // All Greeks should be finite numbers
      expect(Number.isFinite(greeks.delta)).toBe(true);
      expect(Number.isFinite(greeks.gamma)).toBe(true);
      expect(Number.isFinite(greeks.vega)).toBe(true);
      expect(Number.isFinite(greeks.theta)).toBe(true);
      
      // Delta should include futures position
      expect(Math.abs(greeks.delta)).toBeGreaterThan(50000);
      
      // Gamma should be reasonable
      expect(Math.abs(greeks.gamma)).toBeLessThan(1000);
      
      // Vega should be positive (net long options)
      expect(greeks.vega).toBeGreaterThan(0);
      
      // Theta should be negative (time decay)
      expect(greeks.theta).toBeLessThan(0);
    });

    it('should handle empty portfolio', () => {
      const greeks = aggregateGreeks([], 82.5, 0.05);
      
      expect(greeks.delta).toBe(0);
      expect(greeks.gamma).toBe(0);
      expect(greeks.vega).toBe(0);
      expect(greeks.theta).toBe(0);
    });

    it('should handle futures-only portfolio', () => {
      const futuresOnly = [{
        symbol: 'BRN',
        quantity: 200,
        isOption: false,
        futuresPrice: 82.5
      }];
      
      const greeks = aggregateGreeks(futuresOnly, 82.5, 0.05);
      
      expect(greeks.delta).toBe(200000); // 200 * 1000 bbl
      expect(greeks.gamma).toBe(0);
      expect(greeks.vega).toBe(0);
      expect(greeks.theta).toBe(0);
    });
  });

  describe('VaR Calculation', () => {
    const testPortfolio = [
      {
        symbol: 'BRN',
        quantity: 100,
        isOption: false,
        futuresPrice: 82.5
      },
      {
        symbol: 'BUL85C1M',
        quantity: 50,
        isOption: true,
        underlyingPrice: 82.5,
        strike: 85,
        timeToExpiry: 1/12,
        volatility: 0.25,
        optionType: 'C' as const
      }
    ];

    it('should calculate VaR95 for portfolio', () => {
      const var95 = calculateVaR95(testPortfolio, 82.5, 0.25, 0.05);
      
      // VaR should be a positive number
      expect(var95).toBeGreaterThan(0);
      
      // VaR should be reasonable (not too extreme)
      expect(var95).toBeLessThan(1000000);
      
      // VaR should be proportional to position size
      const doubledPortfolio = testPortfolio.map(p => ({ ...p, quantity: p.quantity * 2 }));
      const var95Doubled = calculateVaR95(doubledPortfolio, 82.5, 0.25, 0.05);
      
      expect(var95Doubled).toBeCloseTo(var95 * 2, -1);
    });

    it('should increase with volatility', () => {
      const lowVolVar = calculateVaR95(testPortfolio, 82.5, 0.15, 0.05);
      const highVolVar = calculateVaR95(testPortfolio, 82.5, 0.35, 0.05);
      
      expect(highVolVar).toBeGreaterThan(lowVolVar);
    });

    it('should handle empty portfolio', () => {
      const var95 = calculateVaR95([], 82.5, 0.25, 0.05);
      expect(var95).toBe(0);
    });
  });

  describe('Breach Detection', () => {
    it('should detect Greek breaches', () => {
      const limits = {
        deltaCap: 10000,
        gammaCap: 100,
        vegaCap: 5000,
        thetaCap: 1000
      };
      
      const currentGreeks = {
        delta: 15000, // Breach
        gamma: 50,    // OK
        vega: 6000,   // Breach
        theta: -500   // OK
      };
      
      const breaches = [];
      if (Math.abs(currentGreeks.delta) > limits.deltaCap) breaches.push('DELTA');
      if (Math.abs(currentGreeks.gamma) > limits.gammaCap) breaches.push('GAMMA');
      if (Math.abs(currentGreeks.vega) > limits.vegaCap) breaches.push('VEGA');
      if (Math.abs(currentGreeks.theta) > limits.thetaCap) breaches.push('THETA');
      
      expect(breaches).toContain('DELTA');
      expect(breaches).toContain('VEGA');
      expect(breaches).not.toContain('GAMMA');
      expect(breaches).not.toContain('THETA');
    });

    it('should calculate breach duration', () => {
      const breachStart = new Date('2024-01-01T10:00:00');
      const breachEnd = new Date('2024-01-01T10:05:30');
      
      const durationSeconds = (breachEnd.getTime() - breachStart.getTime()) / 1000;
      
      expect(durationSeconds).toBe(330); // 5 minutes 30 seconds
    });
  });
});
