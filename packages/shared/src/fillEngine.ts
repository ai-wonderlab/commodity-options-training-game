// Fill Engine for Order Execution
// Handles order matching, fill prices, and fee calculations

import { black76Price, black76Greeks, OptionType } from './black76';

export interface Order {
  id: string;
  participantId: string;
  side: 'BUY' | 'SELL';
  type: 'MKT' | 'LMT';
  symbol: string;
  expiry?: Date;
  strike?: number;
  optType?: OptionType;
  qty: number;
  limitPrice?: number;
  ivOverride?: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  fillPrice?: number;
  fees?: number;
  timestamp: Date;
}

export interface FillResult {
  orderId: string;
  status: 'FILLED' | 'PENDING' | 'REJECTED';
  fillPrice?: number;
  fees?: number;
  executionTime?: Date;
  message?: string;
}

export interface FeeConfig {
  per_contract: number;
  percentage: number;
  min_fee?: number;
  max_fee?: number;
}

export interface SpreadConfig {
  futures?: number;
  options?: number;
  default: number;
}

export class FillEngine {
  private spreadConfig: SpreadConfig;
  private feeConfig: FeeConfig;

  constructor(
    spreadConfig: SpreadConfig = { default: 0.02, futures: 0.01, options: 0.03 },
    feeConfig: FeeConfig = { per_contract: 2.50, percentage: 0.0001 }
  ) {
    this.spreadConfig = spreadConfig;
    this.feeConfig = feeConfig;
  }

  // Process an order and determine fill
  public processOrder(
    order: Order,
    currentMid: number,
    currentBid: number,
    currentAsk: number
  ): FillResult {
    // Validate order
    const validation = this.validateOrder(order);
    if (!validation.valid) {
      return {
        orderId: order.id,
        status: 'REJECTED',
        message: validation.message
      };
    }

    // Determine fill price based on order type
    let fillPrice: number;
    let shouldFill = false;

    if (order.type === 'MKT') {
      // Market orders always fill at mid price
      fillPrice = currentMid;
      shouldFill = true;
    } else {
      // Limit orders - check if crossable
      if (order.side === 'BUY') {
        // Buy limit order fills if limit >= ask
        if (order.limitPrice! >= currentAsk) {
          fillPrice = Math.min(order.limitPrice!, currentAsk);
          shouldFill = true;
        }
      } else {
        // Sell limit order fills if limit <= bid
        if (order.limitPrice! <= currentBid) {
          fillPrice = Math.max(order.limitPrice!, currentBid);
          shouldFill = true;
        }
      }
    }

    if (!shouldFill) {
      return {
        orderId: order.id,
        status: 'PENDING',
        message: 'Order resting in book'
      };
    }

    // Calculate fees
    const fees = this.calculateFees(order, fillPrice!);

    return {
      orderId: order.id,
      status: 'FILLED',
      fillPrice: fillPrice!,
      fees,
      executionTime: new Date()
    };
  }

  // Calculate theoretical price for options using Black-76
  public calculateTheoreticalPrice(
    F: number,  // Futures price
    K: number,  // Strike
    T: number,  // Time to expiry in years
    sigma: number, // Implied volatility
    r: number,  // Risk-free rate
    optType: OptionType
  ): number {
    return black76Price({ F, K, T, sigma, r, cp: optType });
  }

  // Generate bid-ask spread around mid price
  public generateBidAsk(
    midPrice: number,
    isOption: boolean = false
  ): { bid: number; ask: number } {
    const spreadBps = isOption 
      ? (this.spreadConfig.options || this.spreadConfig.default) * 100
      : (this.spreadConfig.futures || this.spreadConfig.default) * 100;
    
    const halfSpread = (midPrice * spreadBps) / 10000 / 2;

    return {
      bid: Number((midPrice - halfSpread).toFixed(2)),
      ask: Number((midPrice + halfSpread).toFixed(2))
    };
  }

  // Calculate fees for an order
  private calculateFees(order: Order, fillPrice: number): number {
    const notionalValue = fillPrice * order.qty * 1000; // 1000 bbl per contract
    
    // Per contract fee
    let fees = this.feeConfig.per_contract * order.qty;
    
    // Percentage fee
    fees += notionalValue * this.feeConfig.percentage;
    
    // Apply min/max if configured
    if (this.feeConfig.min_fee) {
      fees = Math.max(fees, this.feeConfig.min_fee);
    }
    if (this.feeConfig.max_fee) {
      fees = Math.min(fees, this.feeConfig.max_fee);
    }

    return Number(fees.toFixed(2));
  }

  // Validate order parameters
  private validateOrder(order: Order): { valid: boolean; message?: string } {
    // Check quantity
    if (order.qty <= 0) {
      return { valid: false, message: 'Quantity must be positive' };
    }

    // Check limit price for limit orders
    if (order.type === 'LMT' && (!order.limitPrice || order.limitPrice <= 0)) {
      return { valid: false, message: 'Limit price required for limit orders' };
    }

    // Check option parameters
    if (order.optType) {
      if (!order.strike || order.strike <= 0) {
        return { valid: false, message: 'Strike price required for options' };
      }
      if (!order.expiry) {
        return { valid: false, message: 'Expiry date required for options' };
      }
      if (!['C', 'P'].includes(order.optType)) {
        return { valid: false, message: 'Invalid option type' };
      }
    }

    return { valid: true };
  }

  // Check if a resting limit order should be filled
  public checkRestingOrder(
    order: Order,
    currentBid: number,
    currentAsk: number
  ): boolean {
    if (order.type !== 'LMT' || order.status !== 'PENDING') {
      return false;
    }

    if (order.side === 'BUY') {
      return order.limitPrice! >= currentAsk;
    } else {
      return order.limitPrice! <= currentBid;
    }
  }

  // Update spread configuration
  public updateSpreadConfig(config: Partial<SpreadConfig>) {
    this.spreadConfig = { ...this.spreadConfig, ...config };
  }

  // Update fee configuration
  public updateFeeConfig(config: Partial<FeeConfig>) {
    this.feeConfig = { ...this.feeConfig, ...config };
  }
}

// Singleton instance
export const fillEngine = new FillEngine();
