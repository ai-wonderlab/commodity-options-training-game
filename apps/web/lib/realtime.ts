// Realtime Communication Manager
// Handles all real-time updates via Supabase Realtime channels

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

// Event Type Definitions (matching Cursor rules/30-realtime.mdc)
export interface TickEvent {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume?: number;
  timestamp: string;
  isShock?: boolean;
  isOpening?: boolean;
}

export interface FillEvent {
  orderId: string;
  participantId: string;
  side: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  fillPrice: number;
  fees: number;
  timestamp: string;
}

export interface RiskEvent {
  participantId: string;
  greeks: {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
  };
  var95: number;
  breaches: string[];
  timestamp: string;
}

export interface ScoreEvent {
  participantId: string;
  realizedPnL: number;
  unrealizedPnL: number;
  score: number;
  rank: number;
  timestamp: string;
}

export interface AlertEvent {
  participantId?: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'breach_open' | 'breach_close' | 'margin_call' | 'shock' | 'session_control';
  message: string;
  details?: any;
  timestamp: string;
}

export interface ShockEvent {
  sessionId: string;
  priceChange: number;
  volChange: number;
  description?: string;
  newPrice: number;
  newVol: number;
  timestamp: string;
}

export interface SessionControlEvent {
  sessionId: string;
  action: 'pause' | 'resume' | 'freeze' | 'end' | 'next_day';
  previousStatus?: string;
  timestamp: string;
  changedBy?: string;
}

export type RealtimeEventPayload = 
  | { event: 'TICK'; payload: TickEvent }
  | { event: 'FILL'; payload: FillEvent }
  | { event: 'RISK'; payload: RiskEvent }
  | { event: 'SCORE'; payload: ScoreEvent }
  | { event: 'ALERT'; payload: AlertEvent }
  | { event: 'SHOCK'; payload: ShockEvent }
  | { event: 'SESSION_CONTROL'; payload: SessionControlEvent }
  | { event: 'RISK_RECALC_REQUIRED'; payload: { sessionId: string; reason: string; timestamp: string } };

// Event Handlers
export interface RealtimeEventHandlers {
  onTick?: (payload: TickEvent) => void;
  onFill?: (payload: FillEvent) => void;
  onRisk?: (payload: RiskEvent) => void;
  onScore?: (payload: ScoreEvent) => void;
  onAlert?: (payload: AlertEvent) => void;
  onShock?: (payload: ShockEvent) => void;
  onSessionControl?: (payload: SessionControlEvent) => void;
  onRiskRecalcRequired?: (payload: { sessionId: string; reason: string; timestamp: string }) => void;
  onConnectionChange?: (status: 'connected' | 'disconnected' | 'reconnecting' | 'error') => void;
}

// Throttled Update Manager
class ThrottledUpdater {
  private updateQueue: Map<string, any> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private throttleMs: number;
  private callbacks: Map<string, (data: any) => void> = new Map();

  constructor(throttleMs: number = 100) {
    this.throttleMs = throttleMs;
  }

  registerCallback(key: string, callback: (data: any) => void) {
    this.callbacks.set(key, callback);
  }

  queueUpdate(key: string, data: any) {
    this.updateQueue.set(key, data);
    
    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => {
        this.processQueue();
      }, this.throttleMs);
    }
  }

  private processQueue() {
    if (this.updateQueue.size === 0) {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      return;
    }

    // Process all queued updates
    const updates = Array.from(this.updateQueue.entries());
    this.updateQueue.clear();

    updates.forEach(([key, data]) => {
      const callback = this.callbacks.get(key);
      if (callback) {
        callback(data);
      }
    });
  }

  dispose() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.updateQueue.clear();
    this.callbacks.clear();
  }
}

// Main Realtime Manager
export class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;
  private participantId: string | null = null;
  private handlers: RealtimeEventHandlers = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isConnected: boolean = false;
  private throttledUpdater: ThrottledUpdater;

  constructor(throttleMs: number = 100) {
    this.throttledUpdater = new ThrottledUpdater(throttleMs);
    this.setupThrottledCallbacks();
  }

  /**
   * Connect to session realtime channel
   */
  async connect(sessionId: string, participantId: string, handlers: RealtimeEventHandlers = {}) {
    // Clean up existing connection
    if (this.channel) {
      await this.disconnect();
    }

    this.sessionId = sessionId;
    this.participantId = participantId;
    this.handlers = handlers;

    const channelName = `session:${sessionId}`;
    
    this.channel = supabase
      .channel(channelName)
      .on('broadcast', { event: '*' }, (payload) => {
        this.handleEvent(payload);
      })
      .on('system', { event: '*' }, (payload) => {
        this.handleSystemEvent(payload);
      })
      .subscribe(async (status) => {
        await this.handleConnectionStatus(status);
      });

    console.log(`Connecting to realtime channel: ${channelName}`);
  }

  /**
   * Disconnect from current channel
   */
  async disconnect() {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.isConnected = false;
    this.sessionId = null;
    this.participantId = null;
    this.reconnectAttempts = 0;
    
    this.throttledUpdater.dispose();
    
    if (this.handlers.onConnectionChange) {
      this.handlers.onConnectionChange('disconnected');
    }
  }

  /**
   * Update event handlers
   */
  updateHandlers(handlers: Partial<RealtimeEventHandlers>) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; sessionId: string | null; participantId: string | null } {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId,
      participantId: this.participantId
    };
  }

  /**
   * Handle incoming realtime events
   */
  private handleEvent(payload: any) {
    try {
      const { event, payload: eventPayload } = payload;
      
      // Filter events by participant if needed
      const shouldProcess = this.shouldProcessEvent(event, eventPayload);
      if (!shouldProcess) return;

      switch (event) {
        case 'TICK':
          this.throttledUpdater.queueUpdate('marketData', eventPayload);
          break;
          
        case 'FILL':
          if (this.handlers.onFill) {
            this.handlers.onFill(eventPayload);
          }
          break;
          
        case 'RISK':
          if (eventPayload.participantId === this.participantId && this.handlers.onRisk) {
            this.throttledUpdater.queueUpdate('risk', eventPayload);
          }
          break;
          
        case 'SCORE':
          this.throttledUpdater.queueUpdate('leaderboard', eventPayload);
          break;
          
        case 'ALERT':
          if (this.handlers.onAlert) {
            this.handlers.onAlert(eventPayload);
          }
          break;
          
        case 'SHOCK':
          if (this.handlers.onShock) {
            this.handlers.onShock(eventPayload);
          }
          // Also update market data with shocked values
          if (eventPayload.newPrice) {
            this.throttledUpdater.queueUpdate('marketData', {
              symbol: 'BRN',
              price: eventPayload.newPrice,
              bid: eventPayload.newPrice - 0.01,
              ask: eventPayload.newPrice + 0.01,
              timestamp: eventPayload.timestamp,
              isShock: true
            });
          }
          break;
          
        case 'SESSION_CONTROL':
          if (this.handlers.onSessionControl) {
            this.handlers.onSessionControl(eventPayload);
          }
          break;
          
        case 'RISK_RECALC_REQUIRED':
          if (this.handlers.onRiskRecalcRequired) {
            this.handlers.onRiskRecalcRequired(eventPayload);
          }
          break;
          
        default:
          console.debug('Unhandled realtime event:', event, eventPayload);
      }
    } catch (error) {
      console.error('Error handling realtime event:', error);
    }
  }

  /**
   * Handle system events (connection status, errors, etc.)
   */
  private handleSystemEvent(payload: any) {
    console.debug('System event:', payload);
  }

  /**
   * Handle connection status changes
   */
  private async handleConnectionStatus(status: string) {
    console.log('Realtime connection status:', status);
    
    switch (status) {
      case 'SUBSCRIBED':
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (this.handlers.onConnectionChange) {
          this.handlers.onConnectionChange('connected');
        }
        break;
        
      case 'CHANNEL_ERROR':
        this.isConnected = false;
        if (this.handlers.onConnectionChange) {
          this.handlers.onConnectionChange('error');
        }
        await this.handleError();
        break;
        
      case 'TIMED_OUT':
        this.isConnected = false;
        if (this.handlers.onConnectionChange) {
          this.handlers.onConnectionChange('disconnected');
        }
        await this.reconnect();
        break;
        
      case 'CLOSED':
        this.isConnected = false;
        if (this.handlers.onConnectionChange) {
          this.handlers.onConnectionChange('disconnected');
        }
        break;
    }
  }

  /**
   * Handle connection errors
   */
  private async handleError() {
    console.error('Realtime connection error');
    await this.reconnect();
  }

  /**
   * Reconnect with exponential backoff
   */
  private async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      if (this.handlers.onConnectionChange) {
        this.handlers.onConnectionChange('error');
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    if (this.handlers.onConnectionChange) {
      this.handlers.onConnectionChange('reconnecting');
    }

    console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
      if (this.sessionId && this.participantId) {
        this.connect(this.sessionId, this.participantId, this.handlers);
      }
    }, delay);
  }

  /**
   * Determine if an event should be processed
   */
  private shouldProcessEvent(event: string, payload: any): boolean {
    // Global events (everyone receives)
    const globalEvents = ['TICK', 'SHOCK', 'SESSION_CONTROL', 'SCORE'];
    if (globalEvents.includes(event)) return true;

    // Participant-specific events
    if (event === 'ALERT') {
      return !payload.participantId || payload.participantId === this.participantId;
    }

    if (['FILL', 'RISK'].includes(event)) {
      return payload.participantId === this.participantId;
    }

    return true;
  }

  /**
   * Setup throttled update callbacks
   */
  private setupThrottledCallbacks() {
    this.throttledUpdater.registerCallback('marketData', (data: TickEvent) => {
      if (this.handlers.onTick) {
        this.handlers.onTick(data);
      }
    });

    this.throttledUpdater.registerCallback('risk', (data: RiskEvent) => {
      if (this.handlers.onRisk) {
        this.handlers.onRisk(data);
      }
    });

    this.throttledUpdater.registerCallback('leaderboard', (data: ScoreEvent) => {
      if (this.handlers.onScore) {
        this.handlers.onScore(data);
      }
    });
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();

// Utility functions for broadcasting (from server-side/Edge Functions)
export const broadcastEvents = {
  tick: (sessionId: string, tickData: TickEvent) => ({
    channel: `session:${sessionId}`,
    event: 'TICK',
    payload: tickData
  }),

  fill: (sessionId: string, fillData: FillEvent) => ({
    channel: `session:${sessionId}`,
    event: 'FILL',
    payload: fillData
  }),

  risk: (sessionId: string, riskData: RiskEvent) => ({
    channel: `session:${sessionId}`,
    event: 'RISK',
    payload: riskData
  }),

  score: (sessionId: string, scoreData: ScoreEvent) => ({
    channel: `session:${sessionId}`,
    event: 'SCORE',
    payload: scoreData
  }),

  alert: (sessionId: string, alertData: AlertEvent) => ({
    channel: `session:${sessionId}`,
    event: 'ALERT',
    payload: alertData
  }),

  shock: (sessionId: string, shockData: ShockEvent) => ({
    channel: `session:${sessionId}`,
    event: 'SHOCK',
    payload: shockData
  }),

  sessionControl: (sessionId: string, controlData: SessionControlEvent) => ({
    channel: `session:${sessionId}`,
    event: 'SESSION_CONTROL',
    payload: controlData
  })
};

// React hook for easier integration
export function useRealtime(sessionId: string, participantId: string, handlers: RealtimeEventHandlers) {
  const [connectionStatus, setConnectionStatus] = React.useState<'connected' | 'disconnected' | 'reconnecting' | 'error'>('disconnected');

  React.useEffect(() => {
    const enhancedHandlers = {
      ...handlers,
      onConnectionChange: (status: 'connected' | 'disconnected' | 'reconnecting' | 'error') => {
        setConnectionStatus(status);
        if (handlers.onConnectionChange) {
          handlers.onConnectionChange(status);
        }
      }
    };

    realtimeManager.connect(sessionId, participantId, enhancedHandlers);

    return () => {
      realtimeManager.disconnect();
    };
  }, [sessionId, participantId]);

  // Update handlers when they change
  React.useEffect(() => {
    realtimeManager.updateHandlers(handlers);
  }, [handlers]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected'
  };
}
