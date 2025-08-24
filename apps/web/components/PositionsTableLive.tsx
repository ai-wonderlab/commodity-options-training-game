'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  AlertCircle,
  Percent,
  Minus
} from 'lucide-react';
import { cn, cardStyles, formatCurrency, formatNumber, getPriceColorClass } from '../lib/utils';
import { 
  supabase, 
  Position, 
  Tick,
  isSupabaseConfigured 
} from '../lib/supabaseClient';
import { black76Greeks } from '@game/shared';
import toast from 'react-hot-toast';

interface PositionsTableLiveProps {
  participantId?: string;
  sessionId?: string;
}

interface EnhancedPosition extends Position {
  currentPrice?: number;
  unrealizedPnl?: number;
  totalPnl?: number;
  pnlPercent?: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
}

export default function PositionsTableLive({ participantId, sessionId }: PositionsTableLiveProps) {
  const [positions, setPositions] = useState<EnhancedPosition[]>([]);
  const [marketPrices, setMarketPrices] = useState<Record<string, Tick>>({});
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Load positions and market data
  useEffect(() => {
    const loadData = async () => {
      if (!participantId) {
        setLoading(false);
        return;
      }

      if (!isSupabaseConfigured()) {
        // Mock data
        setPositions([
          {
            participant_id: participantId,
            symbol: 'BRN',
            net_qty: 5,
            avg_price: 82.30,
            realized_pnl: 500,
            updated_at: new Date(),
            currentPrice: 82.50,
            unrealizedPnl: 1000,
            totalPnl: 1500,
            pnlPercent: 0.36,
            delta: 5000,
            gamma: 0,
            vega: 0,
            theta: 0
          },
          {
            participant_id: participantId,
            symbol: 'BUL-C-85-MAR',
            expiry: new Date('2024-03-01'),
            strike: 85,
            opt_type: 'C',
            net_qty: -2,
            avg_price: 2.45,
            realized_pnl: -100,
            updated_at: new Date(),
            currentPrice: 2.35,
            unrealizedPnl: 200,
            totalPnl: 100,
            pnlPercent: 2.04,
            delta: -1200,
            gamma: -40,
            vega: -180,
            theta: 45
          }
        ]);
        setLoading(false);
        return;
      }

      try {
        // Load positions
        const { data: positionsData, error: posError } = await supabase
          .from('positions')
          .select('*')
          .eq('participant_id', participantId)
          .neq('net_qty', 0);

        if (posError) throw posError;

        // Get unique symbols
        const symbols = [...new Set(positionsData?.map(p => p.symbol) || [])];

        // Load latest market prices
        const { data: ticksData, error: ticksError } = await supabase
          .from('ticks')
          .select('*')
          .in('symbol', symbols)
          .order('ts', { ascending: false });

        if (ticksError) throw ticksError;

        // Create price map (latest price for each symbol)
        const priceMap: Record<string, Tick> = {};
        ticksData?.forEach(tick => {
          if (!priceMap[tick.symbol]) {
            priceMap[tick.symbol] = tick;
          }
        });
        setMarketPrices(priceMap);

        // Enhance positions with P&L and Greeks
        const enhancedPositions = (positionsData || []).map(pos => 
          enhancePosition(pos, priceMap[pos.symbol])
        );

        setPositions(enhancedPositions);
        setIsConnected(true);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Error loading positions:', error);
        toast.error('Failed to load positions');
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [participantId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isSupabaseConfigured() || !participantId) return;

    // Subscribe to position updates
    const positionsChannel = supabase
      .channel(`positions-${participantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
          filter: `participant_id=eq.${participantId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updatedPosition = payload.new as Position;
            const tick = marketPrices[updatedPosition.symbol];
            const enhanced = enhancePosition(updatedPosition, tick);
            
            setPositions(prev => {
              const filtered = prev.filter(p => 
                !(p.symbol === updatedPosition.symbol &&
                  p.strike === updatedPosition.strike &&
                  p.expiry === updatedPosition.expiry &&
                  p.opt_type === updatedPosition.opt_type)
              );
              return updatedPosition.net_qty !== 0 
                ? [...filtered, enhanced]
                : filtered;
            });
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    // Subscribe to price updates
    const symbols = positions.map(p => p.symbol);
    const ticksChannel = supabase
      .channel(`ticks-positions`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticks'
        },
        (payload) => {
          const tick = payload.new as Tick;
          if (symbols.includes(tick.symbol)) {
            setMarketPrices(prev => ({
              ...prev,
              [tick.symbol]: tick
            }));
            
            // Re-enhance positions with new price
            setPositions(prev => 
              prev.map(pos => 
                pos.symbol === tick.symbol 
                  ? enhancePosition(pos, tick)
                  : pos
              )
            );
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      positionsChannel.unsubscribe();
      ticksChannel.unsubscribe();
    };
  }, [participantId, positions, marketPrices]);

  // Enhance position with P&L and Greeks
  const enhancePosition = (position: Position, tick?: Tick): EnhancedPosition => {
    const currentPrice = tick?.mid || tick?.last || position.avg_price;
    
    // Calculate P&L
    const contractSize = 1000; // 1000 barrels per contract
    const unrealizedPnl = position.net_qty * (currentPrice - position.avg_price) * contractSize;
    const totalPnl = unrealizedPnl + position.realized_pnl;
    const pnlPercent = position.avg_price > 0 
      ? ((currentPrice - position.avg_price) / position.avg_price) * 100 
      : 0;

    // Calculate Greeks for options
    let delta = 0, gamma = 0, vega = 0, theta = 0;
    
    if (position.opt_type) {
      // Option position
      const timeToExpiry = position.expiry 
        ? Math.max(0, (new Date(position.expiry).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000))
        : 30 / 365;
      const r = 0.05; // Risk-free rate
      const F = currentPrice;
      const K = position.strike || currentPrice;
      const sigma = 0.25; // Default IV
      const cp = position.opt_type === 'P' ? 'p' : 'c';

      const greeks = black76Greeks(F, K, timeToExpiry, sigma, r, cp);
      
      delta = greeks.delta * position.net_qty * contractSize;
      gamma = greeks.gamma * position.net_qty * contractSize;
      vega = greeks.vega * position.net_qty * contractSize / 100; // Per 1% vol
      theta = greeks.theta * position.net_qty * contractSize / 365; // Daily
    } else {
      // Futures position
      delta = position.net_qty * contractSize;
    }

    return {
      ...position,
      currentPrice,
      unrealizedPnl,
      totalPnl,
      pnlPercent,
      delta,
      gamma,
      vega,
      theta
    };
  };

  // Format position symbol
  const formatSymbol = (pos: EnhancedPosition) => {
    if (pos.opt_type) {
      const expiry = pos.expiry ? new Date(pos.expiry).toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
      return `${pos.symbol}-${pos.opt_type}-${pos.strike}-${expiry}`;
    }
    return pos.symbol;
  };

  // Calculate totals
  const totals = positions.reduce((acc, pos) => ({
    unrealizedPnl: acc.unrealizedPnl + (pos.unrealizedPnl || 0),
    realizedPnl: acc.realizedPnl + pos.realized_pnl,
    totalPnl: acc.totalPnl + (pos.totalPnl || 0),
    delta: acc.delta + (pos.delta || 0),
    gamma: acc.gamma + (pos.gamma || 0),
    vega: acc.vega + (pos.vega || 0),
    theta: acc.theta + (pos.theta || 0)
  }), {
    unrealizedPnl: 0,
    realizedPnl: 0,
    totalPnl: 0,
    delta: 0,
    gamma: 0,
    vega: 0,
    theta: 0
  });

  if (!participantId) {
    return (
      <div className={cn(cardStyles.base, "overflow-hidden")}>
        <div className={cardStyles.content}>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-body text-muted-foreground">Join session to view positions</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(cardStyles.base, "overflow-hidden")}>
        <div className={cardStyles.content}>
          <div className="flex items-center justify-center py-8">
            <Activity className="h-6 w-6 text-muted-foreground animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className={cn(cardStyles.base, "overflow-hidden")}>
        <div className={cardStyles.content}>
          <div className="text-center py-8">
            <Minus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-body text-muted-foreground">No open positions</p>
            <p className="text-caption text-muted-foreground mt-1">Place an order to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(cardStyles.base, "overflow-hidden")}>
      <div className={cardStyles.header}>
        <div className="flex items-center justify-between">
          <h3 className="text-h4 font-serif font-bold text-foreground">Positions</h3>
          <div className="flex items-center gap-3">
            <span className="text-caption text-muted-foreground">
              {positions.length} active
            </span>
            {isConnected && (
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-success animate-pulse" />
                <span className="text-caption text-success">Live</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-small">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left p-3 font-medium text-muted-foreground">Symbol</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Qty</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Avg Price</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Current</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Unreal P&L</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Real P&L</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Total P&L</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Delta</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Gamma</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Vega</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Theta</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, index) => (
              <tr 
                key={`${pos.symbol}-${pos.strike}-${pos.expiry}-${pos.opt_type}`}
                className={cn(
                  "border-b border-border transition-all hover:bg-muted/30",
                  index % 2 === 0 ? "bg-background" : "bg-muted/10"
                )}
              >
                <td className="p-3 font-medium">
                  <div>
                    <div className="text-foreground">{formatSymbol(pos)}</div>
                    {pos.opt_type && (
                      <div className="text-caption text-muted-foreground">
                        {pos.opt_type === 'C' ? 'Call' : 'Put'}
                      </div>
                    )}
                  </div>
                </td>
                <td className={cn(
                  "p-3 text-right font-mono font-semibold",
                  pos.net_qty > 0 ? "text-success" : "text-destructive"
                )}>
                  {pos.net_qty > 0 ? '+' : ''}{pos.net_qty}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatCurrency(pos.avg_price)}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatCurrency(pos.currentPrice || 0)}
                </td>
                <td className={cn(
                  "p-3 text-right font-mono font-semibold",
                  getPriceColorClass(pos.unrealizedPnl || 0)
                )}>
                  {pos.unrealizedPnl && pos.unrealizedPnl >= 0 ? '+' : ''}
                  {formatCurrency(pos.unrealizedPnl || 0)}
                </td>
                <td className={cn(
                  "p-3 text-right font-mono",
                  getPriceColorClass(pos.realized_pnl)
                )}>
                  {pos.realized_pnl >= 0 ? '+' : ''}
                  {formatCurrency(pos.realized_pnl)}
                </td>
                <td className={cn(
                  "p-3 text-right font-mono font-bold",
                  getPriceColorClass(pos.totalPnl || 0)
                )}>
                  <div className="flex items-center justify-end gap-1">
                    {pos.totalPnl && pos.totalPnl > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : pos.totalPnl && pos.totalPnl < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : null}
                    <span>
                      {pos.totalPnl && pos.totalPnl >= 0 ? '+' : ''}
                      {formatCurrency(pos.totalPnl || 0)}
                    </span>
                  </div>
                  {pos.pnlPercent !== undefined && (
                    <div className="text-caption">
                      ({pos.pnlPercent >= 0 ? '+' : ''}{formatNumber(pos.pnlPercent, 2)}%)
                    </div>
                  )}
                </td>
                <td className="p-3 text-right font-mono text-muted-foreground">
                  {formatNumber(pos.delta || 0, 0)}
                </td>
                <td className="p-3 text-right font-mono text-muted-foreground">
                  {formatNumber(pos.gamma || 0, 2)}
                </td>
                <td className="p-3 text-right font-mono text-muted-foreground">
                  {formatNumber(pos.vega || 0, 0)}
                </td>
                <td className="p-3 text-right font-mono text-muted-foreground">
                  {formatNumber(pos.theta || 0, 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/50 border-t-2 border-border">
            <tr>
              <td className="p-3 font-bold text-foreground">TOTAL</td>
              <td className="p-3"></td>
              <td className="p-3"></td>
              <td className="p-3"></td>
              <td className={cn(
                "p-3 text-right font-mono font-bold",
                getPriceColorClass(totals.unrealizedPnl)
              )}>
                {totals.unrealizedPnl >= 0 ? '+' : ''}
                {formatCurrency(totals.unrealizedPnl)}
              </td>
              <td className={cn(
                "p-3 text-right font-mono font-bold",
                getPriceColorClass(totals.realizedPnl)
              )}>
                {totals.realizedPnl >= 0 ? '+' : ''}
                {formatCurrency(totals.realizedPnl)}
              </td>
              <td className={cn(
                "p-3 text-right font-mono font-bold text-h5",
                getPriceColorClass(totals.totalPnl)
              )}>
                {totals.totalPnl >= 0 ? '+' : ''}
                {formatCurrency(totals.totalPnl)}
              </td>
              <td className="p-3 text-right font-mono font-bold">
                {formatNumber(totals.delta, 0)}
              </td>
              <td className="p-3 text-right font-mono font-bold">
                {formatNumber(totals.gamma, 2)}
              </td>
              <td className="p-3 text-right font-mono font-bold">
                {formatNumber(totals.vega, 0)}
              </td>
              <td className="p-3 text-right font-mono font-bold">
                {formatNumber(totals.theta, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="px-4 py-2 bg-muted/30 border-t border-border">
        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
          <span>Contract size: 1,000 bbl</span>
        </div>
      </div>
    </div>
  );
}
