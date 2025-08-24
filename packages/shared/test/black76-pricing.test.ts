import { describe, it, expect } from 'vitest';
import { black76Price } from '../src/black76';

describe('Black-76 Price Calculation', () => {
  // Test fixtures with known good values
  const testCases = [
    {
      name: 'ATM Call',
      F: 100, K: 100, T: 0.25, sigma: 0.2, r: 0.05, optionType: 'C' as const,
      expectedPrice: 3.987, tolerance: 0.1
    },
    {
      name: 'ATM Put', 
      F: 100, K: 100, T: 0.25, sigma: 0.2, r: 0.05, optionType: 'P' as const,
      expectedPrice: 3.987, tolerance: 0.1
    },
    {
      name: 'OTM Call',
      F: 100, K: 110, T: 0.25, sigma: 0.2, r: 0.05, optionType: 'C' as const,
      expectedPrice: 1.211, tolerance: 0.1
    },
    {
      name: 'ITM Put',
      F: 100, K: 110, T: 0.25, sigma: 0.2, r: 0.05, optionType: 'P' as const,
      expectedPrice: 11.084, tolerance: 0.1
    },
    {
      name: 'Brent $85 Call',
      F: 82.5, K: 85, T: 0.0833, sigma: 0.25, r: 0.05, optionType: 'C' as const,
      expectedPrice: 1.234, tolerance: 0.2
    }
  ];

  testCases.forEach(testCase => {
    it(`should correctly price ${testCase.name}`, () => {
      const price = black76Price(
        testCase.F, testCase.K, testCase.T, testCase.sigma, testCase.r, testCase.optionType
      );

      expect(price).toBeGreaterThan(0);
      expect(Math.abs(price - testCase.expectedPrice)).toBeLessThan(testCase.tolerance);
    });
  });

  it('should satisfy put-call parity', () => {
    const F = 100, K = 100, T = 0.25, sigma = 0.2, r = 0.05;
    
    const callPrice = black76Price(F, K, T, sigma, r, 'C');
    const putPrice = black76Price(F, K, T, sigma, r, 'P');
    const discountFactor = Math.exp(-r * T);
    
    // Put-Call Parity: C - P = DF * (F - K)
    const parity = callPrice - putPrice;
    const expected = discountFactor * (F - K);
    
    expect(parity).toBeCloseTo(expected, 3);
  });

  it('should handle edge cases', () => {
    // Zero time to expiry
    expect(black76Price(100, 100, 0, 0.2, 0.05, 'C')).toBe(0);
    
    // Zero volatility ATM
    expect(black76Price(100, 100, 0.25, 0, 0.05, 'C')).toBe(0);
    
    // Zero volatility ITM call  
    const zeroVolITM = black76Price(110, 100, 0.25, 0, 0.05, 'C');
    expect(zeroVolITM).toBeCloseTo(10 * Math.exp(-0.05 * 0.25), 2);
  });

  it('should be monotonic with key parameters', () => {
    const base = { F: 100, K: 100, T: 0.25, sigma: 0.2, r: 0.05 };
    
    // Price should increase with volatility
    const lowVol = black76Price(base.F, base.K, base.T, 0.1, base.r, 'C');
    const highVol = black76Price(base.F, base.K, base.T, 0.3, base.r, 'C');
    expect(highVol).toBeGreaterThan(lowVol);
    
    // Call price should increase with underlying price
    const lowPrice = black76Price(90, base.K, base.T, base.sigma, base.r, 'C');
    const highPrice = black76Price(110, base.K, base.T, base.sigma, base.r, 'C');
    expect(highPrice).toBeGreaterThan(lowPrice);
  });

  it('should not produce NaN or Infinity', () => {
    const testParams = [
      [100, 100, 0.25, 0.2, 0.05],
      [50, 100, 0.1, 0.5, 0.03], 
      [150, 100, 1.0, 0.1, 0.07]
    ];
    
    testParams.forEach(([F, K, T, sigma, r]) => {
      const callPrice = black76Price(F, K, T, sigma, r, 'C');
      const putPrice = black76Price(F, K, T, sigma, r, 'P');
      
      expect(Number.isFinite(callPrice)).toBe(true);
      expect(Number.isFinite(putPrice)).toBe(true);
      expect(callPrice).not.toBeNaN();
      expect(putPrice).not.toBeNaN();
    });
  });
});
