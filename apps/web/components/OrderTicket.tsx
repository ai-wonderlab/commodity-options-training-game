'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Calculator,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings2
} from 'lucide-react';
import { cn, cardStyles, buttonStyles, inputStyles, formatCurrency, formatNumber } from '../lib/utils';

interface OrderTicketProps {
  sessionId: string;
  participantId: string;
  onOrderSubmitted: () => void;
}

export default function OrderTicket({ sessionId, participantId, onOrderSubmitted }: OrderTicketProps) {
  const [order, setOrder] = useState({
    side: 'BUY' as 'BUY' | 'SELL',
    type: 'MKT' as 'MKT' | 'LMT',
    symbol: 'BRN',
    expiry: '',
    strike: 0,
    optType: '' as '' | 'C' | 'P',
    qty: 1,
    limitPrice: 0,
    ivOverride: null as number | null,
  });

  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async () => {
    if (!participantId) {
      toast.error('Not authenticated as participant');
      return;
    }

    if (order.qty <= 0) {
      toast.error('Quantity must be positive');
      return;
    }

    if (order.type === 'LMT' && order.limitPrice <= 0) {
      toast.error('Limit price required for limit orders');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/functions/order-submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          participantId,
          ...order,
          expiry: order.expiry || undefined,
          strike: order.strike || undefined,
          optType: order.optType || undefined,
          limitPrice: order.type === 'LMT' ? order.limitPrice : undefined,
          ivOverride: order.ivOverride || undefined,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }

      toast.success(`Order ${data.status.toLowerCase()}: ${order.side} ${order.qty} ${order.symbol}`);
      
      // Reset form
      setOrder({
        ...order,
        qty: 1,
        limitPrice: 0,
        ivOverride: null,
      });

      onOrderSubmitted();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit order');
    } finally {
      setLoading(false);
    }
  };

  const isOption = order.symbol !== 'BRN';
  const spotPrice = 82.50; // This would come from market data
  const estimatedPrice = order.type === 'LMT' ? order.limitPrice : spotPrice;
  const notionalValue = order.qty * 1000 * estimatedPrice;

  return (
    <div className={cardStyles.base}>
      <div className={cardStyles.header}>
        <div className="flex items-center justify-between">
          <h3 className="text-h4 font-serif font-bold text-foreground">
            Order Ticket
          </h3>
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-2 rounded-md hover:bg-muted transition-colors"
          >
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className={cardStyles.content}>
        {/* BUY/SELL Toggle - Primary Action */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => setOrder({ ...order, side: 'BUY' })}
            className={cn(
              "relative py-4 px-6 rounded-lg font-bold text-lg transition-all duration-200",
              "flex items-center justify-center gap-2",
              order.side === 'BUY' 
                ? "bg-success text-success-foreground shadow-medium ring-2 ring-success/20 scale-[1.02]" 
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            <ArrowUpCircle className="h-6 w-6" />
            BUY
            {order.side === 'BUY' && (
              <div className="absolute top-1 right-1 h-2 w-2 bg-success-foreground rounded-full animate-pulse" />
            )}
          </button>
          
          <button
            onClick={() => setOrder({ ...order, side: 'SELL' })}
            className={cn(
              "relative py-4 px-6 rounded-lg font-bold text-lg transition-all duration-200",
              "flex items-center justify-center gap-2",
              order.side === 'SELL' 
                ? "bg-destructive text-destructive-foreground shadow-medium ring-2 ring-destructive/20 scale-[1.02]" 
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            <ArrowDownCircle className="h-6 w-6" />
            SELL
            {order.side === 'SELL' && (
              <div className="absolute top-1 right-1 h-2 w-2 bg-destructive-foreground rounded-full animate-pulse" />
            )}
          </button>
        </div>

        {/* Instrument Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-small font-medium text-muted-foreground mb-2">
              Instrument
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOrder({ ...order, symbol: 'BRN', optType: '' })}
                className={cn(
                  "py-3 px-4 rounded-md border-2 font-medium transition-all",
                  order.symbol === 'BRN'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                <div className="text-sm">Futures</div>
                <div className="text-xs text-muted-foreground">BRN</div>
              </button>
              <button
                onClick={() => setOrder({ ...order, symbol: 'BUL' })}
                className={cn(
                  "py-3 px-4 rounded-md border-2 font-medium transition-all",
                  order.symbol === 'BUL'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                <div className="text-sm">Options</div>
                <div className="text-xs text-muted-foreground">BUL</div>
              </button>
            </div>
          </div>

          {/* Option Details */}
          {isOption && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border animate-fade-in-down">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrder({ ...order, optType: 'C' })}
                  className={cn(
                    "py-3 px-4 rounded-md font-medium transition-all",
                    "flex items-center justify-center gap-2",
                    order.optType === 'C'
                      ? "bg-success/20 text-success border-2 border-success"
                      : "bg-background border-2 border-border hover:border-success/50"
                  )}
                >
                  <TrendingUp className="h-4 w-4" />
                  CALL
                </button>
                <button
                  onClick={() => setOrder({ ...order, optType: 'P' })}
                  className={cn(
                    "py-3 px-4 rounded-md font-medium transition-all",
                    "flex items-center justify-center gap-2",
                    order.optType === 'P'
                      ? "bg-destructive/20 text-destructive border-2 border-destructive"
                      : "bg-background border-2 border-border hover:border-destructive/50"
                  )}
                >
                  <TrendingDown className="h-4 w-4" />
                  PUT
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-caption text-muted-foreground mb-1">
                    Expiry
                  </label>
                  <input
                    type="date"
                    value={order.expiry}
                    onChange={(e) => setOrder({ ...order, expiry: e.target.value })}
                    className={inputStyles.base}
                  />
                </div>
                <div>
                  <label className="block text-caption text-muted-foreground mb-1">
                    Strike
                  </label>
                  <input
                    type="number"
                    value={order.strike}
                    onChange={(e) => setOrder({ ...order, strike: parseFloat(e.target.value) })}
                    step="0.5"
                    className={inputStyles.base}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Order Type Tabs */}
          <div>
            <label className="block text-small font-medium text-muted-foreground mb-2">
              Order Type
            </label>
            <div className="flex p-1 bg-muted rounded-lg">
              <button
                onClick={() => setOrder({ ...order, type: 'MKT' })}
                className={cn(
                  "flex-1 py-2 px-4 rounded-md font-medium transition-all",
                  order.type === 'MKT'
                    ? "bg-background shadow-soft"
                    : "hover:bg-background/50"
                )}
              >
                MARKET
              </button>
              <button
                onClick={() => setOrder({ ...order, type: 'LMT' })}
                className={cn(
                  "flex-1 py-2 px-4 rounded-md font-medium transition-all",
                  order.type === 'LMT'
                    ? "bg-background shadow-soft"
                    : "hover:bg-background/50"
                )}
              >
                LIMIT
              </button>
            </div>
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-caption text-muted-foreground mb-1">
                Quantity
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={order.qty}
                  onChange={(e) => setOrder({ ...order, qty: parseInt(e.target.value) })}
                  min="1"
                  className={cn(inputStyles.base, "pr-12")}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  lots
                </div>
              </div>
            </div>
            
            {order.type === 'LMT' && (
              <div className="animate-fade-in">
                <label className="block text-caption text-muted-foreground mb-1">
                  Limit Price
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={order.limitPrice}
                    onChange={(e) => setOrder({ ...order, limitPrice: parseFloat(e.target.value) })}
                    step="0.01"
                    className={cn(inputStyles.base, "pl-7")}
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Options */}
          {showAdvanced && isOption && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border animate-fade-in-down">
              <label className="block text-small font-medium text-muted-foreground mb-2">
                IV Override
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={order.ivOverride ? order.ivOverride * 100 : 30}
                  onChange={(e) => setOrder({ ...order, ivOverride: parseFloat(e.target.value) / 100 })}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10%</span>
                  <span className="font-medium text-foreground">
                    {order.ivOverride ? `${(order.ivOverride * 100).toFixed(1)}%` : 'Market'}
                  </span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Card */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-start gap-2 mb-3">
            <Calculator className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-small font-medium text-foreground mb-2">Order Preview</div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-caption">
                  <span className="text-muted-foreground">Contract Size</span>
                  <span className="font-medium">1,000 bbl</span>
                </div>
                <div className="flex justify-between text-caption">
                  <span className="text-muted-foreground">Est. Price</span>
                  <span className="font-medium">{formatCurrency(estimatedPrice)}</span>
                </div>
                <div className="flex justify-between text-small pt-2 border-t border-border">
                  <span className="font-medium">Notional Value</span>
                  <span className={cn(
                    "font-bold",
                    order.side === 'BUY' ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(notionalValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {notionalValue > 100000 && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded bg-warning/10 border border-warning/20">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-xs text-warning">Large order - check risk limits</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !participantId}
          className={cn(
            "w-full py-4 px-6 rounded-lg font-bold text-lg transition-all duration-200",
            "flex items-center justify-center gap-2",
            "shadow-medium hover:shadow-hard transform hover:scale-[1.02]",
            order.side === 'BUY'
              ? "bg-success hover:bg-success/90 text-success-foreground"
              : "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          )}
        >
          {loading ? (
            <>
              <Activity className="h-5 w-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              {order.side === 'BUY' ? (
                <ArrowUpCircle className="h-5 w-5" />
              ) : (
                <ArrowDownCircle className="h-5 w-5" />
              )}
              {order.side} {order.qty} {order.symbol}
              {isOption && order.optType && ` ${order.optType}`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}