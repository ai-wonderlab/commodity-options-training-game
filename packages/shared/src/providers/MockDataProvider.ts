// Mock Data Provider Implementation
// Provides simulated market data for BRN futures and BUL options

import {
  DataProvider,
  DataProviderConfig,
  Tick,
  IvSurface,
  IvSurfaceSnapshot,
  HistoricalDay,
} from './DataProvider';

export class MockDataProvider implements DataProvider {
  private basePrice: number = 82.5;
  private volatility: number = 0.25;
  private tickInterval: number = 5000; // 5 seconds
  private callbacks: Map<string, (tick: Tick) => void> = new Map();
  private intervalId?: NodeJS.Timeout;
  private activeIterators: Set<AsyncIterator<Tick>> = new Set();

  constructor(config?: DataProviderConfig) {
    this.generateInitialData();
  }

  private generateInitialData() {
    // Initialize with base market data
    this.basePrice = 80 + Math.random() * 10; // Between 80-90
    this.volatility = 0.20 + Math.random() * 0.15; // Between 20-35%
  }

  // Generate realistic price movement with mean reversion
  private generateNextPrice(currentPrice: number): number {
    const dt = this.tickInterval / (252 * 24 * 60 * 60 * 1000); // Convert to years
    const drift = 0.05; // 5% annual drift
    const meanReversionSpeed = 0.1;
    const meanLevel = 82.5;
    
    // Ornstein-Uhlenbeck process for mean reversion
    const randomShock = Math.sqrt(dt) * this.volatility * (Math.random() - 0.5) * 2;
    const meanReversionComponent = meanReversionSpeed * (meanLevel - currentPrice) * dt;
    
    return currentPrice + meanReversionComponent + currentPrice * (drift * dt + randomShock);
  }

  // Generate bid-ask spread based on volatility
  private generateSpread(price: number): { bid: number; ask: number } {
    const spreadBps = 2 + this.volatility * 10; // 2-5.5 basis points
    const halfSpread = (price * spreadBps) / 10000 / 2;
    
    return {
      bid: Number((price - halfSpread).toFixed(2)),
      ask: Number((price + halfSpread).toFixed(2))
    };
  }

  /**
   * Get live tick stream as async iterable
   */
  async *getLiveTicks(args: {
    symbols: string[];
    since?: string;
  }): AsyncIterable<Tick> {
    const { symbols } = args;
    let running = true;
    const queue: Tick[] = [];
    
    // Set up tick generation
    const generateTick = () => {
      this.basePrice = this.generateNextPrice(this.basePrice);
      
      for (const symbol of symbols) {
        const { bid, ask } = this.generateSpread(this.basePrice);
        const tick: Tick = {
          ts: new Date(),
          symbol,
          last: Number(this.basePrice.toFixed(2)),
          best_bid: bid,
          best_ask: ask,
          mid: Number(((bid + ask) / 2).toFixed(2)),
          volume: Math.floor(100 + Math.random() * 900)
        };
        queue.push(tick);
      }
    };

    // Generate initial tick
    generateTick();

    // Set up interval for continuous ticks
    const intervalId = setInterval(() => {
      if (running) {
        generateTick();
      }
    }, this.tickInterval);

    try {
      while (running) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          // Wait for next tick
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      clearInterval(intervalId);
    }
  }

  /**
   * Get option implied volatility surface
   */
  async getOptionSurface(args: {
    asOf: string;
    symbol?: string;
  }): Promise<IvSurface> {
    const strikes: Map<number, number> = new Map();
    const atmStrike = Math.round(this.basePrice / 2.5) * 2.5; // Round to nearest 2.5
    
    // Generate strikes around ATM
    for (let i = -5; i <= 5; i++) {
      const strike = atmStrike + i * 2.5;
      const moneyness = strike / this.basePrice;
      
      // Volatility smile: higher IV for OTM options
      const otmAdjustment = Math.abs(1 - moneyness) * 0.15;
      const iv = this.volatility + otmAdjustment + (Math.random() - 0.5) * 0.02; // Small random variation
      
      strikes.set(strike, Number(iv.toFixed(4)));
    }

    // Generate expiry dates (monthly for next 6 months)
    const asOfDate = new Date(args.asOf);
    const expiry = new Date(asOfDate);
    expiry.setMonth(expiry.getMonth() + 3); // Default to 3-month expiry

    return {
      expiry,
      strikes,
      asOf: asOfDate
    };
  }

  /**
   * Get historical data for replay
   */
  async getHistoricalDay(args: {
    day: string;
    symbols?: string[];
  }): Promise<HistoricalDay> {
    const { day, symbols = ['BRN'] } = args;
    const ticks: Tick[] = [];
    const surfaces: IvSurfaceSnapshot[] = [];
    
    // Parse the day
    const date = new Date(day);
    
    // Generate a full trading day (6.5 hours, tick every 5 minutes)
    const startTime = new Date(date);
    startTime.setHours(9, 30, 0, 0);
    
    let currentPrice = 82.5 + (Math.random() - 0.5) * 5; // Some variation per day
    let currentVol = 0.25 + (Math.random() - 0.5) * 0.05;
    const ticksPerDay = 78; // 6.5 hours * 12 ticks/hour
    
    for (let i = 0; i < ticksPerDay; i++) {
      const tickTime = new Date(startTime.getTime() + i * 5 * 60 * 1000);
      currentPrice = this.generateNextPrice(currentPrice);
      
      for (const symbol of symbols) {
        const { bid, ask } = this.generateSpread(currentPrice);
        
        ticks.push({
          ts: tickTime,
          symbol,
          last: Number(currentPrice.toFixed(2)),
          best_bid: bid,
          best_ask: ask,
          mid: Number(((bid + ask) / 2).toFixed(2)),
          volume: Math.floor(100 + Math.random() * 900)
        });
      }
      
      // Add IV surface snapshot every hour
      if (i % 12 === 0) {
        const surface = await this.getOptionSurface({
          asOf: tickTime.toISOString(),
          symbol: 'BRN'
        });
        
        surfaces.push({
          ...surface,
          id: `surface_${day}_${i}`
        });
      }
    }

    return { day, ticks, surfaces };
  }

  /**
   * Apply market shock (instructor functionality)
   */
  async applyShock(pricePct: number, volPts: number): Promise<void> {
    this.basePrice *= (1 + pricePct / 100);
    this.volatility += volPts / 100;
    
    // Clamp values to reasonable ranges
    this.basePrice = Math.max(20, Math.min(200, this.basePrice));
    this.volatility = Math.max(0.05, Math.min(1.0, this.volatility));
    
    console.log(`Mock shock applied: price ${pricePct}%, vol ${volPts}pts`);
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.callbacks.clear();
    this.activeIterators.clear();
  }
}
