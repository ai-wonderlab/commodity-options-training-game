import { describe, it, expect } from 'vitest';
import { black76Greeks, black76Price } from '../src/black76';

describe('Black-76 Greeks Calculation', () => {
  const testGreeks = [
    {
      name: 'ATM Call Greeks',
      F: 100, K: 100, T: 0.25, sigma: 0.2, r: 0.05, optionType: 'C' as const,
      expectedDelta: 0.512, expectedGamma: 0.0199, expectedVega: 9.95, expectedTheta: -7.96,
      tolerance: 0.1
    },
    {
      name: 'OTM Put Greeks',
      F: 100, K: 110, T: 0.25, sigma: 0.2, r: 0.05, optionType: 'P' as const,
      expectedDelta: -0.883, expectedGamma: 0.0117, expectedVega: 5.85, expectedTheta: -2.93,
      tolerance: 0.2
    }
  ];

  testGreeks.forEach(testCase => {
    it(`should correctly calculate ${testCase.name}`, () => {
      const greeks = black76Greeks(
        testCase.F, testCase.K, testCase.T, testCase.sigma, testCase.r, testCase.optionType
      );

      // Delta tests
      expect(greeks.delta).toBeCloseTo(testCase.expectedDelta, 1);
      
      // Gamma tests (always positive)
      expect(greeks.gamma).toBeGreaterThan(0);
      expect(greeks.gamma).toBeCloseTo(testCase.expectedGamma, 1);
      
      // Vega tests (always positive for long options)
      expect(greeks.vega).toBeGreaterThan(0);
      expect(greeks.vega).toBeCloseTo(testCase.expectedVega, 0);
      
      // Theta tests (usually negative for long options)
      expect(greeks.theta).toBeLessThan(0);
    });
  });

  it('should satisfy Delta bounds', () => {
    // Call delta should be between 0 and 1
    const callGreeks = black76Greeks(100, 100, 0.25, 0.2, 0.05, 'C');
    expect(callGreeks.delta).toBeGreaterThan(0);
    expect(callGreeks.delta).toBeLessThan(1);

    // Put delta should be between -1 and 0
    const putGreeks = black76Greeks(100, 100, 0.25, 0.2, 0.05, 'P');
    expect(putGreeks.delta).toBeGreaterThan(-1);
    expect(putGreeks.delta).toBeLessThan(0);
    
    // Deep ITM call delta should approach 1
    const deepITMCall = black76Greeks(120, 100, 0.25, 0.2, 0.05, 'C');
    expect(deepITMCall.delta).toBeGreaterThan(0.8);
    
    // Deep OTM call delta should approach 0
    const deepOTMCall = black76Greeks(80, 100, 0.25, 0.2, 0.05, 'C');
    expect(deepOTMCall.delta).toBeLessThan(0.2);
  });

  it('should have consistent Gamma for calls and puts', () => {
    const callGreeks = black76Greeks(100, 100, 0.25, 0.2, 0.05, 'C');
    const putGreeks = black76Greeks(100, 100, 0.25, 0.2, 0.05, 'P');
    
    // Gamma should be identical for calls and puts with same parameters
    expect(callGreeks.gamma).toBeCloseTo(putGreeks.gamma, 4);
  });

  it('should verify Greeks via finite difference', () => {
    const base = { F: 100, K: 100, T: 0.25, sigma: 0.2, r: 0.05 };
    const greeks = black76Greeks(base.F, base.K, base.T, base.sigma, base.r, 'C');

    // Test Delta via finite difference
    const h = 0.01;
    const priceUp = black76Price(base.F + h, base.K, base.T, base.sigma, base.r, 'C');
    const priceDown = black76Price(base.F - h, base.K, base.T, base.sigma, base.r, 'C');
    const finiteDifferenceDelta = (priceUp - priceDown) / (2 * h);
    
    expect(greeks.delta).toBeCloseTo(finiteDifferenceDelta, 2);

    // Test Vega via finite difference  
    const volUp = black76Price(base.F, base.K, base.T, base.sigma + h, base.r, 'C');
    const volDown = black76Price(base.F, base.K, base.T, base.sigma - h, base.r, 'C');
    const finiteDifferenceVega = (volUp - volDown) / (2 * h);
    
    expect(greeks.vega / 100).toBeCloseTo(finiteDifferenceVega, 1);
  });
});
