'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TickEvent } from '../lib/realtime';
import { TrendingUp, TrendingDown, Zap, Wifi, WifiOff } from 'lucide-react';

interface MarketDataProps {
  sessionId?: string;
  participantId?: string;
  onTickReceived?: (tick: TickEvent) => void;
  realtimeEnabled?: boolean;
}

interface MarketTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume?: number;
  timestamp: string;
  isShock?: boolean;
  isOpening?: boolean;
  previousPrice?: number;
  change?: number;
  changePercent?: number;
}

export default function MarketDataRealtime({ 
  sessionId, 
  participantId, 
  onTickReceived,
  realtimeEnabled = false 
}: MarketDataProps) {
  const [ticks, setTicks] = useState<Record<string, MarketTick>>({
    BRN: {
      symbol: 'BRN',
      price: 82.50,
      bid: 82.48,
      ask: 82.52,
      volume: 5000,
      timestamp: new Date().toISOString(),
      previousPrice: 82.50,
      change: 0,
      changePercent: 0
    }
  });

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const animationRef = useRef<{ [symbol: string]: NodeJS.Timeout }>({});
  const [animatingSymbols, setAnimatingSymbols] = useState<Set<string>>(new Set());

  // Handle incoming tick events
  const handleTickUpdate = (tickEvent: TickEvent) => {
    setTicks(prev => {
      const existingTick = prev[tickEvent.symbol];
      const previousPrice = existingTick?.price || tickEvent.price;
      
      const change = tickEvent.price - previousPrice;
      const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
      
      const updatedTick: MarketTick = {
        symbol: tickEvent.symbol,
        price: tickEvent.price,
        bid: tickEvent.bid,
        ask: tickEvent.ask,
        volume: tickEvent.volume,
        timestamp: tickEvent.timestamp,
        isShock: tickEvent.isShock,
        isOpening: tickEvent.isOpening,
        previousPrice,
        change,
        changePercent
      };

      // Trigger animation
      triggerPriceAnimation(tickEvent.symbol, change);
      
      // Call callback if provided
      if (onTickReceived) {
        onTickReceived(tickEvent);
      }
      
      setLastUpdateTime(new Date());
      
      return {
        ...prev,
        [tickEvent.symbol]: updatedTick
      };
    });
  };

  // Import realtime manager and set up connection if enabled
  useEffect(() => {
    if (!realtimeEnabled || !sessionId || !participantId) return;

    let realtimeManager: any;
    
    const setupRealtime = async () => {
      const { realtimeManager: rtm } = await import('../lib/realtime');
      realtimeManager = rtm;
      
      await realtimeManager.connect(sessionId, participantId, {
        onTick: handleTickUpdate,
        onConnectionChange: (status: string) => {
          setIsConnected(status === 'connected');
        },
        onShock: (shockEvent: any) => {
          // Handle market shock with special visual indication
          console.log('Market shock received:', shockEvent);
        }
      });
    };

    setupRealtime();

    return () => {
      if (realtimeManager) {
        realtimeManager.disconnect();
      }
    };
  }, [sessionId, participantId, realtimeEnabled]);

  // Trigger price change animation
  const triggerPriceAnimation = (symbol: string, change: number) => {
    if (Math.abs(change) < 0.01) return; // Skip tiny changes
    
    // Clear existing animation
    if (animationRef.current[symbol]) {
      clearTimeout(animationRef.current[symbol]);
    }
    
    setAnimatingSymbols(prev => new Set([...prev, symbol]));
    
    // Remove animation after duration
    animationRef.current[symbol] = setTimeout(() => {
      setAnimatingSymbols(prev => {
        const newSet = new Set(prev);
        newSet.delete(symbol);
        return newSet;
      });
    }, 1000);
  };

  // Format price with proper decimal places
  const formatPrice = (value?: number) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(2);
  };

  // Format change with color and sign
  const formatChange = (change: number) => {
    const prefix = change > 0 ? '+' : '';
    return `${prefix}${change.toFixed(2)}`;
  };

  // Get BRN tick (main instrument)
  const brnTick = ticks['BRN'];

  // Calculate time since last update
  const timeSinceUpdate = Math.floor((Date.now() - lastUpdateTime.getTime()) / 1000);

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
      {/* Header with connection status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">ICE Brent (BRN)</h3>
          {brnTick.isShock && (
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
              <Zap className="w-3 h-3" />
              SHOCK
            </div>
          )}
          {brnTick.isOpening && (
            <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              OPENING
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Contract: 1,000 bbl</span>
          {realtimeEnabled && (
            <div className="flex items-center gap-1">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Main price display */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last</div>
          <div 
            className={`text-2xl font-bold font-mono transition-all duration-300 ${
              animatingSymbols.has('BRN') 
                ? brnTick.change && brnTick.change > 0 
                  ? 'text-green-600 scale-110' 
                  : 'text-red-600 scale-110'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            ${formatPrice(brnTick.price)}
          </div>
          <div className={`text-sm flex items-center gap-1 ${
            (brnTick.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {(brnTick.change || 0) >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {formatChange(brnTick.change || 0)} ({formatChange(brnTick.changePercent || 0)}%)
          </div>
        </div>
        
        {/* Bid/Ask/Mid */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Bid</span>
            <span className={`font-mono text-green-600 ${
              animatingSymbols.has('BRN') ? 'font-bold' : ''
            }`}>
              ${formatPrice(brnTick.bid)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Ask</span>
            <span className={`font-mono text-red-600 ${
              animatingSymbols.has('BRN') ? 'font-bold' : ''
            }`}>
              ${formatPrice(brnTick.ask)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Mid</span>
            <span className={`font-mono ${
              animatingSymbols.has('BRN') ? 'font-bold' : ''
            }`}>
              ${formatPrice((brnTick.bid + brnTick.ask) / 2)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Volume and additional info */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Volume: {brnTick.volume?.toLocaleString() || '-'}</span>
          <span>Spread: ${((brnTick.ask - brnTick.bid)).toFixed(2)}</span>
        </div>
        
        {realtimeEnabled && (
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>
              Last Update: {timeSinceUpdate < 60 ? `${timeSinceUpdate}s ago` : 'Stale'}
            </span>
            <span>
              {new Date(brnTick.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
      
      {/* Educational compliance notice */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-600">
        <div className="text-xs text-gray-400 text-center">
          {realtimeEnabled ? 'Data delayed 15 minutes' : 'Simulated data'} • Education only • Not investment advice
        </div>
      </div>
    </div>
  );
}
