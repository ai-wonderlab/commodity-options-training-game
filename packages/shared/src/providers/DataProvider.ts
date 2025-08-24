// DataProvider Interface for Commodity Options Training Game
// Unified interface for all data providers (Mock, Refinitiv, ICE)

export interface Tick {
  ts: Date;
  symbol: string;
  last: number;
  best_bid: number;
  best_ask: number;
  mid: number;
  volume?: number;
}

export interface IvSurface {
  expiry: Date;
  strikes: Map<number, number>; // strike -> IV
  asOf: Date; // Timestamp of this surface snapshot
}

export interface IvSurfaceSnapshot extends IvSurface {
  id: string; // Unique identifier for replay
}

export interface HistoricalDay {
  day: string; // ISO date format (YYYY-MM-DD)
  ticks: Tick[];
  surfaces: IvSurfaceSnapshot[];
}

export interface DataProviderConfig {
  provider: 'mock' | 'refinitiv' | 'ice';
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  region?: 'eu' | 'us';
}

/**
 * Main interface for all data providers
 * All providers must implement these methods
 */
export interface DataProvider {
  /**
   * Get live tick stream (async iterable for continuous data)
   * @param args - symbols to subscribe to and optional start time
   * @returns Async iterable of ticks
   */
  getLiveTicks(args: {
    symbols: string[];
    since?: string;
  }): AsyncIterable<Tick>;

  /**
   * Get option implied volatility surface at a specific time
   * @param args - timestamp to get surface for
   * @returns IV surface snapshot
   */
  getOptionSurface(args: {
    asOf: string;
    symbol?: string;
  }): Promise<IvSurface>;

  /**
   * Get historical data for a specific day (for replay)
   * @param args - ISO date to fetch
   * @returns Historical ticks and IV surfaces for that day
   */
  getHistoricalDay(args: {
    day: string;
    symbols?: string[];
  }): Promise<HistoricalDay>;

  /**
   * Apply market shock (instructor functionality)
   * @param pricePct - Price change percentage
   * @param volPts - Volatility change in points
   */
  applyShock(pricePct: number, volPts: number): Promise<void>;

  /**
   * Cleanup resources
   */
  disconnect(): Promise<void>;
}

/**
 * Factory function to create data provider based on config
 */
export function createDataProvider(config: DataProviderConfig): DataProvider {
  switch (config.provider) {
    case 'mock':
      // Lazy import to avoid circular dependencies
      const { MockDataProvider } = require('./MockDataProvider');
      return new MockDataProvider();
    
    case 'refinitiv':
      const { RefinitivProvider } = require('./RefinitivProvider');
      return new RefinitivProvider(config);
    
    case 'ice':
      const { IceProvider } = require('./IceProvider');
      return new IceProvider(config);
    
    default:
      throw new Error(`Unknown data provider: ${config.provider}`);
  }
}

/**
 * Get provider config from environment variables
 */
export function getProviderConfig(): DataProviderConfig {
  const provider = (process.env.DATA_PROVIDER || 'mock') as 'mock' | 'refinitiv' | 'ice';
  
  return {
    provider,
    apiKey: process.env[`${provider.toUpperCase()}_API_KEY`],
    apiSecret: process.env[`${provider.toUpperCase()}_API_SECRET`],
    endpoint: process.env[`${provider.toUpperCase()}_ENDPOINT`],
    region: (process.env.DATA_REGION || 'eu') as 'eu' | 'us',
  };
}
