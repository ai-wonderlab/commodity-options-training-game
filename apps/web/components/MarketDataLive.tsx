'use client';

import React, { useEffect, useState } from 'react';
import { supabase, Tick, isSupabaseConfigured } from '../lib/supabaseClient';
import { cn, cardStyles, getPriceColorClass, formatCurrency, formatNumber, formatPercent } from '../lib/utils';
import { TrendingUp, TrendingDown, Activity, BarChart3, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface MarketDataProps {
  sessionId?: string;
  symbol?: string;
}

interface MarketStats {
  volume: number;
  openInterest: number;
  high: number;
  low: number;
  open: number;
}

export default function MarketDataLive({ sessionId, symbol = 'BRN' }: MarketDataProps) {
  const [tick, setTick] = useState<Tick | null>(null);
  const [previousTick, setPreviousTick] = useState<Tick | null>(null);
  const [stats, setStats] = useState<MarketStats>({
    volume: 0,
    openInterest: 0,
    high: 0,
    low: 0,
    open: 0
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState(false);

  // Load initial tick data
  useEffect(() => {
    const loadLatestTick = async () => {
      if (!isSupabaseConfigured()) {
        // Use mock data if Supabase not configured
        setTick({
          ts: new Date(),
          symbol: 'BRN',
          last: 82.48,
          best_bid: 82.45,
          best_ask: 82.55,
          mid: 82.50
        });
        return;
      }

      try {
        // Get latest tick from database
        const { data, error } = await supabase
          .from('ticks')
          .select('*')
          .eq('symbol', symbol)
          .order('ts', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;

        if (data) {
          setTick(data);
          setLastUpdate(new Date(data.ts));
        }

        // Get today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: todayTicks, error: statsError } = await supabase
          .from('ticks')
          .select('*')
          .eq('symbol', symbol)
          .gte('ts', today.toISOString())
          .order('ts', { ascending: true });

        if (!statsError && todayTicks && todayTicks.length > 0) {
          const volumes = await supabase
            .from('orders')
            .select('qty')
            .eq('symbol', symbol)
            .eq('status', 'FILLED')
            .gte('filled_at', today.toISOString());

          const totalVolume = volumes.data?.reduce((sum, order) => sum + order.qty, 0) || 0;
          
          setStats({
            volume: totalVolume,
            openInterest: Math.floor(Math.random() * 50000 + 10000), // TODO: Calculate from positions
            high: Math.max(...todayTicks.map(t => t.last || 0)),
            low: Math.min(...todayTicks.map(t => t.last || Number.MAX_VALUE)),
            open: todayTicks[0].last || 0
          });
        }

        setIsConnected(true);
      } catch (error) {
        console.error('Error loading tick data:', error);
        toast.error('Failed to load market data');
        setIsConnected(false);
      }
    };

    loadLatestTick();
  }, [symbol]);

  // Subscribe to real-time tick updates
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`market-data-${symbol}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticks',
          filter: `symbol=eq.${symbol}`
        },
        (payload) => {
          const newTick = payload.new as Tick;
          setPreviousTick(tick);
          setTick(newTick);
          setLastUpdate(new Date(newTick.ts));
          setIsUpdating(true);
          setTimeout(() => setIsUpdating(false), 300);
          
          // Update stats
          setStats(prev => ({
            ...prev,
            high: Math.max(prev.high, newTick.last || 0),
            low: Math.min(prev.low, newTick.last || Number.MAX_VALUE)
          }));
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [symbol, tick]);

  if (!tick) {
    return (
      <div className={cn(cardStyles.base, "overflow-hidden")}>
        <div className={cardStyles.content}>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-body text-muted-foreground">No market data available</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const change = previousTick ? (tick.last || tick.mid || 0) - (previousTick.last || previousTick.mid || 0) : 0;
  const changePercent = previousTick && previousTick.mid ? (change / previousTick.mid) * 100 : 0;
  const spread = (tick.best_ask || 0) - (tick.best_bid || 0);

  return (
    <div className={cn(cardStyles.base, "overflow-hidden")}>
      <div className={cardStyles.header}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-h4 font-serif font-bold text-foreground">
              ICE Brent ({symbol})
            </h3>
            <p className="text-caption text-muted-foreground mt-1">
              Contract Size: 1,000 bbl • Tick: $0.01
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Activity 
              className={cn(
                "h-5 w-5",
                isConnected ? "text-success animate-pulse-subtle" : "text-muted-foreground"
              )} 
            />
            <span className="text-caption text-muted-foreground">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
      
      <div className={cardStyles.content}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Last Price Section */}
          <div className="space-y-4">
            <div className={cn(
              "transition-all duration-300",
              isUpdating && "animate-pulse-once"
            )}>
              <div className="text-caption text-muted-foreground uppercase tracking-wide mb-2">
                Last Price
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-h2 font-bold font-sans">
                  {formatCurrency(tick.last || tick.mid || 0)}
                </span>
                {change !== 0 && (
                  <div className={cn(
                    "flex items-center gap-1",
                    getPriceColorClass(change)
                  )}>
                    {change >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span className="text-small font-semibold">
                      {formatCurrency(Math.abs(change))}
                    </span>
                    <span className="text-small">
                      ({formatPercent(Math.abs(changePercent))})
                    </span>
                  </div>
                )}
              </div>
              <div className="text-caption text-muted-foreground mt-2">
                Updated: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>

            {/* Daily Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-caption text-muted-foreground mb-1">Volume</div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body font-medium">
                    {formatNumber(stats.volume, 0)}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-caption text-muted-foreground mb-1">Open Interest</div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body font-medium">
                    {formatNumber(stats.openInterest, 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* High/Low */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-caption text-muted-foreground mb-1">Day High</div>
                <span className="text-body font-medium text-success">
                  {formatCurrency(stats.high || tick.last || 0)}
                </span>
              </div>
              <div>
                <div className="text-caption text-muted-foreground mb-1">Day Low</div>
                <span className="text-body font-medium text-destructive">
                  {formatCurrency(stats.low || tick.last || 0)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Bid/Ask/Mid Section */}
          <div className="space-y-3">
            <div className="text-caption text-muted-foreground uppercase tracking-wide mb-3">
              Market Depth
            </div>
            
            {/* Bid */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-md bg-success/10 border border-success/20",
              "transition-all hover:bg-success/15",
              isUpdating && tick.best_bid !== previousTick?.best_bid && "animate-pulse-once"
            )}>
              <span className="text-small font-medium text-success">BID</span>
              <span className="text-body font-semibold font-mono">
                {formatCurrency(tick.best_bid || 0)}
              </span>
            </div>
            
            {/* Ask */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20",
              "transition-all hover:bg-destructive/15",
              isUpdating && tick.best_ask !== previousTick?.best_ask && "animate-pulse-once"
            )}>
              <span className="text-small font-medium text-destructive">ASK</span>
              <span className="text-body font-semibold font-mono">
                {formatCurrency(tick.best_ask || 0)}
              </span>
            </div>
            
            {/* Mid */}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted border border-border transition-all hover:bg-muted/80">
              <span className="text-small font-medium text-muted-foreground">MID</span>
              <span className="text-body font-semibold font-mono">
                {formatCurrency(tick.mid || 0)}
              </span>
            </div>

            {/* Spread */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-caption text-muted-foreground">Spread</span>
                <span className={cn(
                  "text-small font-medium",
                  spread > 0.1 ? "text-warning" : "text-success"
                )}>
                  {formatCurrency(spread)}
                </span>
              </div>
            </div>
            
            {/* Session Info */}
            {sessionId && (
              <div className="pt-3 border-t border-border">
                <div className="text-caption text-muted-foreground">
                  Session: {sessionId.slice(0, 8).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
