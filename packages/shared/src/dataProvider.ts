export interface Tick {
  ts: Date;
  symbol: string;
  last: number;
  bestBid: number;
  bestAsk: number;
  mid: number;
}

export interface IVSurface {
  expiry: string;
  strikes: Map<number, number>; // strike -> IV
}

export interface DataProvider {
  getLiveTicks(symbol: string): Promise<Tick>;
  getOptionSurface(underlying: string): Promise<IVSurface[]>;
  getHistoricalDay(date: string): Promise<Tick[]>;
}

export class MockDataProvider implements DataProvider {
  private basePrice = 82.45;
  private lastUpdate = Date.now();

  async getLiveTicks(symbol: string): Promise<Tick> {
    // Simulate 15-min delay
    const now = new Date(Date.now() - 15 * 60 * 1000);
    
    // Add some random walk
    const timeDelta = (Date.now() - this.lastUpdate) / 1000;
    const priceChange = (Math.random() - 0.5) * 0.1 * Math.sqrt(timeDelta / 60);
    this.basePrice += priceChange;
    this.lastUpdate = Date.now();

    const spread = 0.05;
    
    return {
      ts: now,
      symbol,
      last: this.basePrice,
      bestBid: this.basePrice - spread / 2,
      bestAsk: this.basePrice + spread / 2,
      mid: this.basePrice
    };
  }

  async getOptionSurface(underlying: string): Promise<IVSurface[]> {
    const expiries = ['2024-03-15', '2024-06-15', '2024-09-15'];
    const strikes = [75, 77.5, 80, 82.5, 85, 87.5, 90, 92.5, 95];
    
    return expiries.map(expiry => {
      const surface = new Map<number, number>();
      const timeToExpiry = this.getTimeToExpiry(expiry);
      
      strikes.forEach(strike => {
        // IV smile: higher IV for OTM options
        const moneyness = Math.log(strike / this.basePrice);
        const baseIV = 0.25;
        const smile = 0.1 * moneyness * moneyness;
        const termStructure = 0.05 * Math.sqrt(timeToExpiry);
        
        surface.set(strike, baseIV + smile + termStructure);
      });
      
      return { expiry, strikes: surface };
    });
  }

  async getHistoricalDay(date: string): Promise<Tick[]> {
    const ticks: Tick[] = [];
    const startTime = new Date(`${date}T09:30:00Z`);
    const endTime = new Date(`${date}T16:00:00Z`);
    
    let currentTime = startTime.getTime();
    let price = 82.00;
    
    while (currentTime <= endTime.getTime()) {
      // Generate realistic intraday price movement
      const timeOfDay = (currentTime - startTime.getTime()) / (endTime.getTime() - startTime.getTime());
      const trend = Math.sin(timeOfDay * Math.PI * 2) * 0.5; // Intraday pattern
      const noise = (Math.random() - 0.5) * 0.2;
      
      price += trend + noise;
      price = Math.max(75, Math.min(90, price)); // Keep within reasonable bounds
      
      const spread = 0.05;
      
      ticks.push({
        ts: new Date(currentTime),
        symbol: 'BRN',
        last: price,
        bestBid: price - spread / 2,
        bestAsk: price + spread / 2,
        mid: price
      });
      
      currentTime += 5 * 60 * 1000; // 5-minute intervals
    }
    
    return ticks;
  }

  private getTimeToExpiry(expiry: string): number {
    const expiryDate = new Date(expiry);
    const now = new Date();
    const msPerYear = 365 * 24 * 60 * 60 * 1000;
    return Math.max(0, (expiryDate.getTime() - now.getTime()) / msPerYear);
  }
}

// Factory function
export function createDataProvider(type: 'mock' | 'refinitiv' | 'ice' = 'mock'): DataProvider {
  switch (type) {
    case 'mock':
      return new MockDataProvider();
    // Future providers would be added here
    default:
      return new MockDataProvider();
  }
}
