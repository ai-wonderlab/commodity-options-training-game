// Enhanced Fill Engine for Order Execution
// Handles order matching with sophisticated spread maps, mid-based fills, and IV overrides

import { black76Price, OptionType, PriceInput } from './black76';

export interface EnhancedOrder {
  id: string;
  participantId: string;
  sessionId: string;
  side: 'BUY' | 'SELL';
  type: 'MKT' | 'LMT';
  symbol: string;
  
  // Option specifics
  expiry?: Date;
  strike?: number;
  optType?: OptionType;
  
  // Order details
  qty: number;
  limitPrice?: number;
  ivOverride?: number; // Bounded IV override
  
  // Status tracking
  status: 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  filledQty: number;
  remainingQty: number;
  avgFillPrice?: number;
  totalFees?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
}

export interface EnhancedFillResult {
  orderId: string;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'PENDING' | 'REJECTED';
  fillPrice?: number;
  fillQty?: number;
  fees?: number;
  executionTime?: Date;
  message?: string;
  theo?: number; // Theoretical price for reference
  spread?: { bid: number; ask: number; mid: number };
}

export interface SpreadMapConfig {
  // Bucket-based spreads (by expiry and moneyness)
  futures: {
    default: number; // in basis points
    frontMonth: number;
    backMonths: number;
  };
  options: {
    atm: number; // ATM spread
    otm: number; // OTM spread (multiplier)
    deep: number; // Deep OTM spread (multiplier)
    nearExpiry: number; // Near expiry adjustment
  };
}

export interface FeeStructure {
  exchange: number; // Exchange fee per contract
  clearing: number; // Clearing fee per contract
  commission: number; // Broker commission per contract
  regulatory: number; // Regulatory fee (percentage)
  minTotal?: number;
  maxTotal?: number;
}

export interface MarketContext {
  futuresPrice: number;
  riskFreeRate: number;
  baseVolatility: number;
  timestamp: Date;
}

export class EnhancedFillEngine {
  private spreadMap: SpreadMapConfig;
  private feeStructure: FeeStructure;
  private ivBounds: { min: number; max: number };
  private contractMultiplier: number;

  constructor(
    spreadMap?: SpreadMapConfig,
    feeStructure?: FeeStructure,
    contractMultiplier: number = 1000 // 1000 bbl for Brent
  ) {
    this.spreadMap = spreadMap || this.getDefaultSpreadMap();
    this.feeStructure = feeStructure || this.getDefaultFeeStructure();
    this.ivBounds = { min: 0.05, max: 1.0 }; // 5% to 100% volatility
    this.contractMultiplier = contractMultiplier;
  }

  /**
   * Process order with mid-based fills and sophisticated spread calculation
   */
  public processOrder(
    order: EnhancedOrder,
    market: MarketContext
  ): EnhancedFillResult {
    // Validate order
    const validation = this.validateOrder(order);
    if (!validation.valid) {
      return {
        orderId: order.id,
        status: 'REJECTED',
        message: validation.message
      };
    }

    // Calculate theoretical price and spread
    let theo: number;
    let spread: { bid: number; ask: number; mid: number };

    if (order.optType) {
      // Option order
      const iv = this.getBoundedIV(
        order.ivOverride || market.baseVolatility,
        order.strike!,
        market.futuresPrice,
        order.expiry!
      );

      theo = this.calculateOptionTheo(
        market.futuresPrice,
        order.strike!,
        order.expiry!,
        iv,
        market.riskFreeRate,
        order.optType
      );

      spread = this.generateOptionSpread(
        theo,
        order.strike!,
        market.futuresPrice,
        order.expiry!,
        market.timestamp
      );
    } else {
      // Futures order
      theo = market.futuresPrice;
      spread = this.generateFuturesSpread(theo, order.expiry);
    }

    // Determine fill based on order type
    const fillResult = this.determineFill(order, spread);
    
    if (fillResult.shouldFill) {
      // Calculate fees
      const fees = this.calculateFees(
        order.qty,
        fillResult.fillPrice!,
        order.optType !== undefined
      );

      return {
        orderId: order.id,
        status: 'FILLED',
        fillPrice: fillResult.fillPrice,
        fillQty: order.qty,
        fees,
        executionTime: new Date(),
        theo,
        spread
      };
    } else {
      return {
        orderId: order.id,
        status: 'PENDING',
        message: 'Order resting in book',
        theo,
        spread
      };
    }
  }

  /**
   * Calculate theoretical option price using Black-76
   */
  private calculateOptionTheo(
    F: number,
    K: number,
    expiry: Date,
    sigma: number,
    r: number,
    optType: OptionType
  ): number {
    const now = new Date();
    const T = Math.max(
      (expiry.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000),
      1 / 365 // Minimum 1 day
    );

    return black76Price({ F, K, T, sigma, r, cp: optType });
  }

  /**
   * Generate option spread based on moneyness and time to expiry
   */
  private generateOptionSpread(
    theo: number,
    strike: number,
    futuresPrice: number,
    expiry: Date,
    currentTime: Date
  ): { bid: number; ask: number; mid: number } {
    // Calculate moneyness
    const moneyness = strike / futuresPrice;
    const isATM = Math.abs(moneyness - 1.0) < 0.05; // Within 5% of ATM
    const isOTM = moneyness > 1.05 || moneyness < 0.95;
    const isDeep = moneyness > 1.15 || moneyness < 0.85;

    // Calculate time to expiry
    const daysToExpiry = (expiry.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24);
    const isNearExpiry = daysToExpiry < 7;

    // Determine base spread
    let spreadBps: number;
    if (isDeep) {
      spreadBps = this.spreadMap.options.deep;
    } else if (isOTM) {
      spreadBps = this.spreadMap.options.otm;
    } else {
      spreadBps = this.spreadMap.options.atm;
    }

    // Adjust for near expiry
    if (isNearExpiry) {
      spreadBps *= this.spreadMap.options.nearExpiry;
    }

    // Calculate absolute spread
    const halfSpread = (theo * spreadBps) / 10000 / 2;

    // Use theo as mid price
    const mid = theo;
    const bid = Math.max(0.01, mid - halfSpread); // Ensure positive
    const ask = mid + halfSpread;

    return {
      bid: Number(bid.toFixed(2)),
      ask: Number(ask.toFixed(2)),
      mid: Number(mid.toFixed(2))
    };
  }

  /**
   * Generate futures spread
   */
  private generateFuturesSpread(
    price: number,
    expiry?: Date
  ): { bid: number; ask: number; mid: number } {
    let spreadBps: number;
    
    if (expiry) {
      const daysToExpiry = expiry 
        ? (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        : 30;
      
      spreadBps = daysToExpiry < 30 
        ? this.spreadMap.futures.frontMonth
        : this.spreadMap.futures.backMonths;
    } else {
      spreadBps = this.spreadMap.futures.default;
    }

    const halfSpread = (price * spreadBps) / 10000 / 2;
    const mid = price;

    return {
      bid: Number((mid - halfSpread).toFixed(2)),
      ask: Number((mid + halfSpread).toFixed(2)),
      mid: Number(mid.toFixed(2))
    };
  }

  /**
   * Determine if order should fill and at what price
   */
  private determineFill(
    order: EnhancedOrder,
    spread: { bid: number; ask: number; mid: number }
  ): { shouldFill: boolean; fillPrice?: number } {
    if (order.type === 'MKT') {
      // Market orders always fill at mid
      return {
        shouldFill: true,
        fillPrice: spread.mid
      };
    } else {
      // Limit orders check crossing
      const limitPrice = order.limitPrice!;
      
      if (order.side === 'BUY') {
        // Buy limit crosses if limit >= ask
        if (limitPrice >= spread.ask) {
          // Fill at better of limit or inside price
          return {
            shouldFill: true,
            fillPrice: Math.min(limitPrice, spread.ask)
          };
        }
      } else {
        // Sell limit crosses if limit <= bid
        if (limitPrice <= spread.bid) {
          // Fill at better of limit or inside price
          return {
            shouldFill: true,
            fillPrice: Math.max(limitPrice, spread.bid)
          };
        }
      }
    }

    return { shouldFill: false };
  }

  /**
   * Calculate total fees including all components
   */
  private calculateFees(
    qty: number,
    fillPrice: number,
    isOption: boolean
  ): number {
    // Per-contract fees
    let fees = (
      this.feeStructure.exchange +
      this.feeStructure.clearing +
      this.feeStructure.commission
    ) * qty;

    // Regulatory fee (percentage of notional)
    const notional = fillPrice * qty * this.contractMultiplier;
    fees += notional * this.feeStructure.regulatory;

    // Apply min/max
    if (this.feeStructure.minTotal) {
      fees = Math.max(fees, this.feeStructure.minTotal);
    }
    if (this.feeStructure.maxTotal) {
      fees = Math.min(fees, this.feeStructure.maxTotal);
    }

    return Number(fees.toFixed(2));
  }

  /**
   * Get bounded IV (ensure within acceptable range)
   */
  private getBoundedIV(
    requestedIV: number,
    strike: number,
    futuresPrice: number,
    expiry: Date
  ): number {
    // Apply bounds
    let boundedIV = Math.max(this.ivBounds.min, Math.min(this.ivBounds.max, requestedIV));

    // Additional adjustment based on moneyness
    const moneyness = strike / futuresPrice;
    if (moneyness > 1.5 || moneyness < 0.5) {
      // For extreme strikes, tighten the bounds
      boundedIV = Math.max(0.10, Math.min(0.80, boundedIV));
    }

    return boundedIV;
  }

  /**
   * Validate order parameters
   */
  private validateOrder(order: EnhancedOrder): { valid: boolean; message?: string } {
    if (order.qty <= 0) {
      return { valid: false, message: 'Invalid quantity' };
    }

    if (order.type === 'LMT' && (!order.limitPrice || order.limitPrice <= 0)) {
      return { valid: false, message: 'Invalid limit price' };
    }

    if (order.optType) {
      if (!order.strike || order.strike <= 0) {
        return { valid: false, message: 'Invalid strike price' };
      }
      if (!order.expiry || order.expiry <= new Date()) {
        return { valid: false, message: 'Invalid or expired expiry date' };
      }
      if (!['C', 'P'].includes(order.optType)) {
        return { valid: false, message: 'Invalid option type' };
      }
    }

    return { valid: true };
  }

  /**
   * Check if resting order should fill against new market
   */
  public checkRestingOrders(
    restingOrders: EnhancedOrder[],
    market: MarketContext
  ): EnhancedFillResult[] {
    const fills: EnhancedFillResult[] = [];

    for (const order of restingOrders) {
      if (order.status !== 'PENDING') continue;

      const result = this.processOrder(order, market);
      if (result.status === 'FILLED') {
        fills.push(result);
      }
    }

    return fills;
  }

  /**
   * Get default spread map configuration
   */
  private getDefaultSpreadMap(): SpreadMapConfig {
    return {
      futures: {
        default: 2, // 2 bps
        frontMonth: 1.5, // 1.5 bps for front month
        backMonths: 3 // 3 bps for back months
      },
      options: {
        atm: 5, // 5 bps for ATM
        otm: 10, // 10 bps for OTM
        deep: 20, // 20 bps for deep OTM
        nearExpiry: 1.5 // 50% wider for near expiry
      }
    };
  }

  /**
   * Get default fee structure
   */
  private getDefaultFeeStructure(): FeeStructure {
    return {
      exchange: 0.50,
      clearing: 0.25,
      commission: 1.00,
      regulatory: 0.00002, // 2 bps
      minTotal: 2.00,
      maxTotal: 100.00
    };
  }

  /**
   * Update configurations
   */
  public updateSpreadMap(spreadMap: Partial<SpreadMapConfig>): void {
    this.spreadMap = { ...this.spreadMap, ...spreadMap };
  }

  public updateFeeStructure(feeStructure: Partial<FeeStructure>): void {
    this.feeStructure = { ...this.feeStructure, ...feeStructure };
  }

  public updateIVBounds(min: number, max: number): void {
    this.ivBounds = { min, max };
  }
}

// Export singleton for convenience
export const enhancedFillEngine = new EnhancedFillEngine();
