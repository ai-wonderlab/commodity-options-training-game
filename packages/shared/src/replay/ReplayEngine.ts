// Replay Engine for Historical Data Playback
// Provides deterministic replay of market data with speed controls

import {
  Tick,
  IvSurfaceSnapshot,
  HistoricalDay,
  DataProvider,
} from '../providers/DataProvider';

export interface ReplayConfig {
  day: string; // ISO date (YYYY-MM-DD)
  speed: number; // 1x, 2x, 4x, 8x
  startTime?: string; // ISO timestamp to start from
  symbols?: string[];
}

export interface ReplayState {
  currentTime: Date;
  currentIndex: number;
  isPaused: boolean;
  isComplete: boolean;
  totalTicks: number;
  speed: number;
}

export class ReplayEngine {
  private config: ReplayConfig;
  private dataProvider: DataProvider;
  private historicalData?: HistoricalDay;
  private state: ReplayState;
  private callbacks: Set<(tick: Tick) => void> = new Set();
  private surfaceCallbacks: Set<(surface: IvSurfaceSnapshot) => void> = new Set();
  private intervalId?: NodeJS.Timeout;
  private baseInterval: number = 1000; // Base tick interval in ms

  constructor(dataProvider: DataProvider, config: ReplayConfig) {
    this.dataProvider = dataProvider;
    this.config = config;
    this.state = {
      currentTime: new Date(),
      currentIndex: 0,
      isPaused: true,
      isComplete: false,
      totalTicks: 0,
      speed: config.speed || 1
    };
  }

  /**
   * Load historical data for the configured day
   */
  async load(): Promise<void> {
    this.historicalData = await this.dataProvider.getHistoricalDay({
      day: this.config.day,
      symbols: this.config.symbols
    });

    if (!this.historicalData || this.historicalData.ticks.length === 0) {
      throw new Error(`No historical data available for ${this.config.day}`);
    }

    // Set initial state
    this.state.totalTicks = this.historicalData.ticks.length;
    this.state.currentIndex = 0;
    this.state.currentTime = this.historicalData.ticks[0].ts;
    
    // Find starting index if startTime is specified
    if (this.config.startTime) {
      const startTime = new Date(this.config.startTime);
      const startIndex = this.historicalData.ticks.findIndex(
        tick => tick.ts >= startTime
      );
      if (startIndex > 0) {
        this.state.currentIndex = startIndex;
        this.state.currentTime = this.historicalData.ticks[startIndex].ts;
      }
    }
  }

  /**
   * Start or resume playback
   */
  async play(): Promise<void> {
    if (!this.historicalData) {
      await this.load();
    }

    if (this.state.isComplete) {
      // Reset if playback is complete
      this.reset();
    }

    this.state.isPaused = false;
    
    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Calculate actual interval based on speed
    const actualInterval = this.baseInterval / this.state.speed;

    this.intervalId = setInterval(() => {
      if (!this.state.isPaused && !this.state.isComplete) {
        this.processTick();
      }
    }, actualInterval);

    // Process first tick immediately
    this.processTick();
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.state.isPaused = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Step forward by one tick
   */
  step(): void {
    if (!this.state.isComplete) {
      this.processTick();
    }
  }

  /**
   * Change playback speed
   */
  setSpeed(speed: number): void {
    if (![1, 2, 4, 8].includes(speed)) {
      throw new Error('Speed must be 1, 2, 4, or 8');
    }

    this.state.speed = speed;
    
    // Restart interval if playing
    if (!this.state.isPaused && this.intervalId) {
      this.pause();
      this.play();
    }
  }

  /**
   * Seek to specific time or index
   */
  seek(target: Date | number): void {
    if (!this.historicalData) {
      throw new Error('Data not loaded');
    }

    if (target instanceof Date) {
      // Seek to timestamp
      const index = this.historicalData.ticks.findIndex(
        tick => tick.ts >= target
      );
      if (index >= 0) {
        this.state.currentIndex = index;
        this.state.currentTime = this.historicalData.ticks[index].ts;
      }
    } else {
      // Seek to index
      if (target >= 0 && target < this.state.totalTicks) {
        this.state.currentIndex = target;
        this.state.currentTime = this.historicalData.ticks[target].ts;
      }
    }

    this.state.isComplete = false;
    
    // Emit current tick
    this.processTick();
  }

  /**
   * Reset to beginning
   */
  reset(): void {
    this.state.currentIndex = 0;
    this.state.isComplete = false;
    
    if (this.historicalData && this.historicalData.ticks.length > 0) {
      this.state.currentTime = this.historicalData.ticks[0].ts;
    }
  }

  /**
   * Get current replay state
   */
  getState(): ReplayState {
    return { ...this.state };
  }

  /**
   * Subscribe to tick updates
   */
  onTick(callback: (tick: Tick) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Subscribe to IV surface updates
   */
  onSurface(callback: (surface: IvSurfaceSnapshot) => void): () => void {
    this.surfaceCallbacks.add(callback);
    return () => this.surfaceCallbacks.delete(callback);
  }

  /**
   * Process next tick(s) based on speed
   */
  private processTick(): void {
    if (!this.historicalData || this.state.isComplete) {
      return;
    }

    const ticksToProcess = this.state.speed; // Process multiple ticks for higher speeds
    
    for (let i = 0; i < ticksToProcess; i++) {
      if (this.state.currentIndex >= this.state.totalTicks) {
        this.state.isComplete = true;
        this.pause();
        break;
      }

      const tick = this.historicalData.ticks[this.state.currentIndex];
      
      // Emit tick to subscribers
      this.callbacks.forEach(callback => callback(tick));

      // Check if there's a surface snapshot at this time
      const surface = this.historicalData.surfaces.find(s => 
        Math.abs(s.asOf.getTime() - tick.ts.getTime()) < 1000
      );
      
      if (surface) {
        this.surfaceCallbacks.forEach(callback => callback(surface));
      }

      this.state.currentIndex++;
      this.state.currentTime = tick.ts;
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.pause();
    this.callbacks.clear();
    this.surfaceCallbacks.clear();
  }
}

/**
 * Create a replay data provider that wraps historical data
 */
export class ReplayDataProvider implements DataProvider {
  private replayEngine: ReplayEngine;
  private baseProvider: DataProvider;

  constructor(baseProvider: DataProvider, config: ReplayConfig) {
    this.baseProvider = baseProvider;
    this.replayEngine = new ReplayEngine(baseProvider, config);
  }

  async *getLiveTicks(args: {
    symbols: string[];
    since?: string;
  }): AsyncIterable<Tick> {
    // Load and start replay
    await this.replayEngine.load();
    
    const queue: Tick[] = [];
    let isActive = true;

    // Subscribe to replay ticks
    const unsubscribe = this.replayEngine.onTick(tick => {
      if (args.symbols.includes(tick.symbol)) {
        queue.push(tick);
      }
    });

    // Start playback
    await this.replayEngine.play();

    try {
      while (isActive && !this.replayEngine.getState().isComplete) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      unsubscribe();
    }
  }

  async getOptionSurface(args: {
    asOf: string;
    symbol?: string;
  }): Promise<IvSurface> {
    // In replay mode, get surface from historical data
    const state = this.replayEngine.getState();
    const historicalData = await this.baseProvider.getHistoricalDay({
      day: this.replayEngine['config'].day
    });

    // Find nearest surface to current replay time
    const targetTime = new Date(args.asOf);
    const surface = historicalData.surfaces.reduce((closest, current) => {
      const currentDiff = Math.abs(current.asOf.getTime() - targetTime.getTime());
      const closestDiff = Math.abs(closest.asOf.getTime() - targetTime.getTime());
      return currentDiff < closestDiff ? current : closest;
    });

    return surface;
  }

  async getHistoricalDay(args: {
    day: string;
    symbols?: string[];
  }): Promise<HistoricalDay> {
    return this.baseProvider.getHistoricalDay(args);
  }

  async applyShock(pricePct: number, volPts: number): Promise<void> {
    // In replay mode, shocks can be simulated
    console.log(`Replay shock: price ${pricePct}%, vol ${volPts}pts`);
    // This would modify the replay stream
  }

  async disconnect(): Promise<void> {
    this.replayEngine.dispose();
    await this.baseProvider.disconnect();
  }

  // Expose replay controls
  getReplayEngine(): ReplayEngine {
    return this.replayEngine;
  }
}
