// Mock Data Provider for Commodity Options Training Game
// Provides simulated market data for BRN futures and BUL options

export interface MarketTick {
  ts: Date;
  symbol: string;
  last: number;
  best_bid: number;
  best_ask: number;
  mid: number;
  volume?: number;
}

export interface IVSurface {
  expiry: Date;
  strikes: Map<number, number>; // strike -> IV
}

export interface HistoricalDay {
  date: Date;
  ticks: MarketTick[];
  ivSurfaces: IVSurface[];
}

export class MockDataProvider {
  private basePrice: number = 82.5;
  private volatility: number = 0.25;
  private tickInterval: number = 5000; // 5 seconds
  private callbacks: Map<string, (tick: MarketTick) => void> = new Map();
  private intervalId?: NodeJS.Timeout;

  constructor() {
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

  // Get live market data stream
  public subscribeLiveTicks(symbol: string, callback: (tick: MarketTick) => void): string {
    const subscriptionId = `${symbol}_${Date.now()}`;
    this.callbacks.set(subscriptionId, callback);

    // Start generating ticks if not already running
    if (!this.intervalId) {
      this.startLiveFeed();
    }

    // Send initial tick
    this.generateAndBroadcastTick(symbol);

    return subscriptionId;
  }

  public unsubscribeLiveTicks(subscriptionId: string) {
    this.callbacks.delete(subscriptionId);
    
    // Stop the feed if no more subscribers
    if (this.callbacks.size === 0 && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private startLiveFeed() {
    this.intervalId = setInterval(() => {
      this.basePrice = this.generateNextPrice(this.basePrice);
      
      // Broadcast to all subscribers
      for (const [id, callback] of this.callbacks) {
        const symbol = id.split('_')[0];
        this.generateAndBroadcastTick(symbol);
      }
    }, this.tickInterval);
  }

  private generateAndBroadcastTick(symbol: string) {
    const { bid, ask } = this.generateSpread(this.basePrice);
    const tick: MarketTick = {
      ts: new Date(),
      symbol,
      last: this.basePrice,
      best_bid: bid,
      best_ask: ask,
      mid: Number(((bid + ask) / 2).toFixed(2)),
      volume: Math.floor(100 + Math.random() * 900)
    };

    const callback = Array.from(this.callbacks.values()).find(cb => 
      Array.from(this.callbacks.entries()).find(([key, val]) => val === cb)?.[0].startsWith(symbol)
    );
    
    if (callback) {
      callback(tick);
    }
  }

  // Get option chain with implied volatilities
  public getOptionChain(expiry: Date): IVSurface {
    const strikes: Map<number, number> = new Map();
    const atmStrike = Math.round(this.basePrice / 2.5) * 2.5; // Round to nearest 2.5
    
    // Generate strikes around ATM
    for (let i = -5; i <= 5; i++) {
      const strike = atmStrike + i * 2.5;
      const moneyness = strike / this.basePrice;
      
      // Volatility smile: higher IV for OTM options
      const otmAdjustment = Math.abs(1 - moneyness) * 0.15;
      const iv = this.volatility + otmAdjustment;
      
      strikes.set(strike, iv);
    }

    return { expiry, strikes };
  }

  // Get historical replay data
  public async getHistoricalDay(date: Date): Promise<HistoricalDay> {
    const ticks: MarketTick[] = [];
    const ivSurfaces: IVSurface[] = [];
    
    // Generate a full trading day (6.5 hours, tick every 5 minutes)
    const startTime = new Date(date);
    startTime.setHours(9, 30, 0, 0);
    
    let currentPrice = 82.5;
    const ticksPerDay = 78; // 6.5 hours * 12 ticks/hour
    
    for (let i = 0; i < ticksPerDay; i++) {
      const tickTime = new Date(startTime.getTime() + i * 5 * 60 * 1000);
      currentPrice = this.generateNextPrice(currentPrice);
      const { bid, ask } = this.generateSpread(currentPrice);
      
      ticks.push({
        ts: tickTime,
        symbol: 'BRN',
        last: currentPrice,
        best_bid: bid,
        best_ask: ask,
        mid: Number(((bid + ask) / 2).toFixed(2)),
        volume: Math.floor(100 + Math.random() * 900)
      });
      
      // Add IV surface snapshot every hour
      if (i % 12 === 0) {
        const expiry = new Date(date);
        expiry.setMonth(expiry.getMonth() + 3); // 3-month expiry
        ivSurfaces.push(this.getOptionChain(expiry));
      }
    }

    return { date, ticks, ivSurfaces };
  }

  // Generate option prices using the IV surface
  public getOptionPrice(
    strike: number,
    expiry: Date,
    optType: 'C' | 'P',
    ivOverride?: number
  ): MarketTick {
    const timeToExpiry = (expiry.getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
    const iv = ivOverride || this.getOptionChain(expiry).strikes.get(strike) || this.volatility;
    
    // Simplified Black-76 approximation for demo
    const d1 = (Math.log(this.basePrice / strike) + 0.5 * iv * iv * timeToExpiry) / 
              (iv * Math.sqrt(timeToExpiry));
    
    // Rough approximation of option price
    let optionPrice: number;
    if (optType === 'C') {
      optionPrice = Math.max(0, this.basePrice - strike) * Math.exp(-0.02 * timeToExpiry);
      optionPrice += this.basePrice * 0.1 * Math.sqrt(timeToExpiry) * iv; // Time value
    } else {
      optionPrice = Math.max(0, strike - this.basePrice) * Math.exp(-0.02 * timeToExpiry);
      optionPrice += this.basePrice * 0.1 * Math.sqrt(timeToExpiry) * iv; // Time value
    }

    const { bid, ask } = this.generateSpread(optionPrice);
    
    return {
      ts: new Date(),
      symbol: `BUL${strike}${optType}${expiry.toISOString().slice(2, 10).replace(/-/g, '')}`,
      last: optionPrice,
      best_bid: bid,
      best_ask: ask,
      mid: Number(((bid + ask) / 2).toFixed(2)),
      volume: Math.floor(10 + Math.random() * 90)
    };
  }

  // Market shock functionality for instructor
  public applyShock(pricePct: number, volPts: number) {
    this.basePrice *= (1 + pricePct / 100);
    this.volatility += volPts / 100;
    
    // Broadcast shock to all subscribers
    for (const [id] of this.callbacks) {
      const symbol = id.split('_')[0];
      this.generateAndBroadcastTick(symbol);
    }
  }
}

// Singleton instance
export const mockDataProvider = new MockDataProvider();
