import { describe, it, expect } from 'vitest';
import { FillEngine } from '../src/fillEngine';

describe('Fill Engine', () => {
  let fillEngine: FillEngine;

  beforeEach(() => {
    fillEngine = new FillEngine({
      futuresSpread: 0.02,
      optionsSpread: 0.05,
      feePerContract: 2.50,
      feePercentage: 0.0001
    });
  });

  describe('Market Orders', () => {
    it('should fill market buy order at ask', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'BUY' as const,
        type: 'MKT' as const,
        quantity: 10,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      expect(fill.filled).toBe(true);
      expect(fill.fillPrice).toBeCloseTo(82.52, 2);
      expect(fill.fillQuantity).toBe(10);
      expect(fill.fees).toBeGreaterThan(0);
    });

    it('should fill market sell order at bid', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'SELL' as const,
        type: 'MKT' as const,
        quantity: 10,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      expect(fill.filled).toBe(true);
      expect(fill.fillPrice).toBeCloseTo(82.48, 2);
      expect(fill.fillQuantity).toBe(10);
      expect(fill.fees).toBeGreaterThan(0);
    });
  });

  describe('Limit Orders', () => {
    it('should fill limit buy when price is favorable', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'BUY' as const,
        type: 'LMT' as const,
        quantity: 10,
        limitPrice: 82.55,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      expect(fill.filled).toBe(true);
      expect(fill.fillPrice).toBeLessThanOrEqual(82.55);
    });

    it('should not fill limit buy when price is unfavorable', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'BUY' as const,
        type: 'LMT' as const,
        quantity: 10,
        limitPrice: 82.45,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      expect(fill.filled).toBe(false);
      expect(fill.fillPrice).toBeNull();
    });

    it('should fill limit sell when price is favorable', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'SELL' as const,
        type: 'LMT' as const,
        quantity: 10,
        limitPrice: 82.45,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      expect(fill.filled).toBe(true);
      expect(fill.fillPrice).toBeGreaterThanOrEqual(82.45);
    });
  });

  describe('Fee Calculation', () => {
    it('should calculate fees correctly', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'BUY' as const,
        type: 'MKT' as const,
        quantity: 10,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      // Fee = per_contract * quantity + percentage * notional
      const expectedPerContractFee = 2.50 * 10;
      const notionalValue = 82.52 * 10 * 1000; // 1000 bbl per contract
      const expectedPercentageFee = notionalValue * 0.0001;
      const expectedTotalFee = expectedPerContractFee + expectedPercentageFee;
      
      expect(fill.fees).toBeCloseTo(expectedTotalFee, 2);
    });

    it('should apply minimum fee', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'BUY' as const,
        type: 'MKT' as const,
        quantity: 1,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      // Even for 1 contract, minimum fee should apply
      expect(fill.fees).toBeGreaterThanOrEqual(2.50);
    });
  });

  describe('Spread Application', () => {
    it('should apply correct spread for futures', () => {
      const midPrice = 82.50;
      const futuresSpread = 0.02;
      const tick = fillEngine.generateBidAsk(midPrice, false, futuresSpread);
      
      expect(tick.bid).toBeCloseTo(midPrice - futuresSpread / 2, 3);
      expect(tick.ask).toBeCloseTo(midPrice + futuresSpread / 2, 3);
      expect(tick.mid).toBe(midPrice);
    });

    it('should apply correct spread for options', () => {
      const midPrice = 2.50;
      const optionsSpread = 0.05;
      const tick = fillEngine.generateBidAsk(midPrice, true, optionsSpread);
      
      expect(tick.bid).toBeCloseTo(midPrice - optionsSpread / 2, 3);
      expect(tick.ask).toBeCloseTo(midPrice + optionsSpread / 2, 3);
      expect(tick.mid).toBe(midPrice);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero quantity orders', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'BUY' as const,
        type: 'MKT' as const,
        quantity: 0,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      expect(fill.filled).toBe(false);
      expect(fill.fillQuantity).toBe(0);
    });

    it('should handle missing limit price for limit orders', () => {
      const tick = { bid: 82.48, ask: 82.52, mid: 82.50 };
      const order = {
        side: 'BUY' as const,
        type: 'LMT' as const,
        quantity: 10,
        symbol: 'BRN',
        isOption: false
      };
      
      const fill = fillEngine.processOrder(order, tick);
      
      expect(fill.filled).toBe(false);
    });
  });
});
