'use client';

import React from 'react';
import { cn, cardStyles, getPriceColorClass, formatCurrency, formatNumber, formatPercent } from '../lib/utils';
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';

interface MarketDataProps {
  ticks?: Record<string, any>;
}

export default function MarketData({ ticks = {} }: MarketDataProps) {
  const brnTick = ticks['BRN'] || { bid: 82.45, ask: 82.55, mid: 82.50, last: 82.48 };
  
  // Mock change calculation
  const change = brnTick.last ? brnTick.last - brnTick.mid : -0.02;
  const changePercent = (change / brnTick.mid) * 100;

  const [isUpdating, setIsUpdating] = React.useState(false);

  // Simulate price updates with animation
  React.useEffect(() => {
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 300);
    return () => clearTimeout(timer);
  }, [brnTick.last]);

  return (
    <div className={cn(cardStyles.base, "overflow-hidden")}>
      <div className={cardStyles.header}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-h4 font-serif font-bold text-foreground">
              ICE Brent (BRN)
            </h3>
            <p className="text-caption text-muted-foreground mt-1">
              Contract Size: 1,000 bbl • Tick: $0.01
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground animate-pulse-subtle" />
          </div>
        </div>
      </div>
      
      <div className={cardStyles.content}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Last Price Section */}
          <div className="space-y-4">
            <div className={cn(
              "transition-all duration-300",
              isUpdating && "animate-fade-in"
            )}>
              <div className="text-caption text-muted-foreground uppercase tracking-wide mb-2">
                Last Price
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-h2 font-bold font-sans">
                  {formatCurrency(brnTick.last || brnTick.mid)}
                </span>
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
              </div>
            </div>

            {/* Volume and OI */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-caption text-muted-foreground mb-1">Volume</div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body font-medium">
                    {formatNumber(Math.floor(Math.random() * 10000 + 5000), 0)}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-caption text-muted-foreground mb-1">Open Interest</div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body font-medium">
                    {formatNumber(Math.floor(Math.random() * 50000 + 10000), 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bid/Ask/Mid Section */}
          <div className="space-y-3">
            <div className="text-caption text-muted-foreground uppercase tracking-wide mb-3">
              Market Depth
            </div>
            
            {/* Bid */}
            <div className="flex items-center justify-between p-3 rounded-md bg-success/10 border border-success/20 transition-all hover:bg-success/15">
              <span className="text-small font-medium text-success">BID</span>
              <span className="text-body font-semibold font-mono">
                {formatCurrency(brnTick.bid)}
              </span>
            </div>
            
            {/* Ask */}
            <div className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20 transition-all hover:bg-destructive/15">
              <span className="text-small font-medium text-destructive">ASK</span>
              <span className="text-body font-semibold font-mono">
                {formatCurrency(brnTick.ask)}
              </span>
            </div>
            
            {/* Mid */}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted border border-border transition-all hover:bg-muted/80">
              <span className="text-small font-medium text-muted-foreground">MID</span>
              <span className="text-body font-semibold font-mono">
                {formatCurrency(brnTick.mid)}
              </span>
            </div>

            {/* Spread */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-caption text-muted-foreground">Spread</span>
                <span className="text-small font-medium text-warning">
                  {formatCurrency(brnTick.ask - brnTick.bid)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}