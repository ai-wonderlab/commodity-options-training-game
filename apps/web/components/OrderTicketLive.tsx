'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle, 
  Activity, 
  Info,
  Check,
  X
} from 'lucide-react';
import { cn, cardStyles, buttonStyles, inputStyles, formatCurrency, formatNumber } from '../lib/utils';
import { 
  supabase, 
  isSupabaseConfigured,
  Order,
  Position,
  Tick 
} from '../lib/supabaseClient';
import { black76Price, black76Greeks } from '@game/shared';
import toast from 'react-hot-toast';

interface OrderTicketProps {
  sessionId: string;
  participantId?: string;
  onOrderSubmitted?: () => void;
}

interface Instrument {
  symbol: string;
  type: 'future' | 'option';
  expiry?: string;
  strike?: number;
  optType?: 'C' | 'P';
}

export default function OrderTicketLive({ sessionId, participantId, onOrderSubmitted }: OrderTicketProps) {
  // Order state
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MKT' | 'LMT'>('MKT');
  const [instrumentType, setInstrumentType] = useState<'future' | 'option'>('future');
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>({
    symbol: 'BRN',
    type: 'future'
  });
  const [quantity, setQuantity] = useState<number>(1);
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [ivOverride, setIvOverride] = useState<number | null>(null);
  const [showIvOverride, setShowIvOverride] = useState(false);
  
  // Market data
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [impliedVol, setImpliedVol] = useState<number>(0.25);
  const [position, setPosition] = useState<Position | null>(null);
  
  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [estimatedGreeks, setEstimatedGreeks] = useState<any>(null);

  // Available options
  const expiries = ['MAR', 'APR', 'MAY', 'JUN'];
  const strikes = [75, 77.5, 80, 82.5, 85, 87.5, 90];

  // Load current tick
  useEffect(() => {
    const loadMarketData = async () => {
      if (!isSupabaseConfigured()) {
        // Mock data fallback
        setCurrentTick({
          ts: new Date(),
          symbol: selectedInstrument.symbol,
          best_bid: 82.45,
          best_ask: 82.55,
          mid: 82.50,
          last: 82.48
        });
        return;
      }

      try {
        const { data: tick } = await supabase
          .from('ticks')
          .select('*')
          .eq('symbol', selectedInstrument.symbol)
          .order('ts', { ascending: false })
          .limit(1)
          .single();

        if (tick) {
          setCurrentTick(tick);
        }
      } catch (error) {
        console.error('Error loading market data:', error);
      }
    };

    loadMarketData();
  }, [selectedInstrument]);

  // Load current position
  useEffect(() => {
    const loadPosition = async () => {
      if (!isSupabaseConfigured() || !participantId) return;

      try {
        const { data: pos } = await supabase
          .from('positions')
          .select('*')
          .eq('participant_id', participantId)
          .eq('symbol', selectedInstrument.symbol)
          .maybeSingle();

        if (pos) {
          setPosition(pos);
        }
      } catch (error) {
        console.error('Error loading position:', error);
      }
    };

    loadPosition();
  }, [participantId, selectedInstrument]);

  // Calculate estimated cost/premium
  useEffect(() => {
    if (!currentTick) return;

    let cost = 0;
    let greeks = null;

    if (selectedInstrument.type === 'future') {
      // Futures: notional value
      cost = quantity * currentTick.mid! * 1000; // 1000 barrels per contract
    } else {
      // Options: use Black-76 pricing
      const timeToExpiry = 30 / 365; // Simplified: 30 days
      const r = 0.05; // Risk-free rate
      const F = currentTick.mid || 82.50;
      const K = selectedInstrument.strike || 82.50;
      const sigma = ivOverride !== null ? ivOverride / 100 : impliedVol;
      const cp = selectedInstrument.optType === 'P' ? 'p' : 'c';

      const premium = black76Price(F, K, timeToExpiry, sigma, r, cp);
      cost = quantity * premium * 1000; // 1000 barrels per contract

      // Calculate Greeks
      greeks = black76Greeks(F, K, timeToExpiry, sigma, r, cp);
      setEstimatedGreeks({
        delta: greeks.delta * quantity * 1000,
        gamma: greeks.gamma * quantity * 1000,
        vega: greeks.vega * quantity * 1000 / 100, // Per 1% vol move
        theta: greeks.theta * quantity * 1000 / 365 // Daily theta
      });
    }

    setEstimatedCost(cost);
  }, [currentTick, selectedInstrument, quantity, ivOverride, impliedVol]);

  // Submit order
  const handleSubmit = async () => {
    if (!participantId) {
      toast.error('Please join the session first');
      return;
    }

    if (quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    if (orderType === 'LMT' && limitPrice <= 0) {
      toast.error('Please enter a valid limit price');
      return;
    }

    setSubmitting(true);

    try {
      if (!isSupabaseConfigured()) {
        // Mock submission
        toast.success(`Order submitted: ${side} ${quantity} ${selectedInstrument.symbol}`);
        onOrderSubmitted?.();
        setSubmitting(false);
        return;
      }

      // Create order object
      const order: Partial<Order> = {
        session_id: sessionId,
        participant_id: participantId,
        ts: new Date(),
        side,
        type: orderType,
        symbol: selectedInstrument.symbol,
        qty: quantity,
        status: 'PENDING',
        created_at: new Date()
      };

      // Add option-specific fields
      if (selectedInstrument.type === 'option') {
        order.expiry = new Date(`2024-${selectedInstrument.expiry}-01`);
        order.strike = selectedInstrument.strike;
        order.opt_type = selectedInstrument.optType;
        if (ivOverride !== null) {
          order.iv_override = ivOverride / 100;
        }
      }

      // Add limit price for limit orders
      if (orderType === 'LMT') {
        order.limit_price = limitPrice;
      }

      // Call order-submit edge function
      const response = await fetch('/api/functions/order-submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(order)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit order');
      }

      // Success!
      toast.success(
        <div>
          <div className="font-semibold">Order Filled!</div>
          <div className="text-sm">
            {side} {quantity} {selectedInstrument.symbol} @ {formatCurrency(result.fillPrice || currentTick?.mid || 0)}
          </div>
        </div>
      );

      // Reset form
      setQuantity(1);
      setLimitPrice(0);
      setIvOverride(null);
      
      // Callback
      onOrderSubmitted?.();

    } catch (error: any) {
      console.error('Order submission error:', error);
      toast.error(error.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  // Format option symbol
  const formatOptionSymbol = () => {
    if (selectedInstrument.type === 'future') {
      return selectedInstrument.symbol;
    }
    return `${selectedInstrument.symbol}-${selectedInstrument.optType}-${selectedInstrument.strike}-${selectedInstrument.expiry}`;
  };

  return (
    <div className={cn(cardStyles.base, "overflow-hidden")}>
      <div className={cardStyles.header}>
        <h3 className="text-h4 font-serif font-bold text-foreground">Order Ticket</h3>
      </div>

      <div className={cardStyles.content}>
        <div className="space-y-4">
          {/* BUY/SELL Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide('BUY')}
              className={cn(
                buttonStyles.base,
                "relative overflow-hidden transition-all",
                side === 'BUY' 
                  ? "bg-success text-success-foreground border-success shadow-medium" 
                  : "bg-muted text-muted-foreground border-border hover:bg-success/10"
              )}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              BUY
            </button>
            <button
              onClick={() => setSide('SELL')}
              className={cn(
                buttonStyles.base,
                "relative overflow-hidden transition-all",
                side === 'SELL' 
                  ? "bg-destructive text-destructive-foreground border-destructive shadow-medium" 
                  : "bg-muted text-muted-foreground border-border hover:bg-destructive/10"
              )}
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              SELL
            </button>
          </div>

          {/* Instrument Type */}
          <div>
            <label className="text-caption text-muted-foreground uppercase tracking-wide mb-2 block">
              Instrument Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setInstrumentType('future');
                  setSelectedInstrument({ symbol: 'BRN', type: 'future' });
                }}
                className={cn(
                  "px-3 py-2 text-sm rounded-md border transition-all",
                  instrumentType === 'future'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
              >
                Futures
              </button>
              <button
                onClick={() => {
                  setInstrumentType('option');
                  setSelectedInstrument({
                    symbol: 'BUL',
                    type: 'option',
                    expiry: 'MAR',
                    strike: 82.5,
                    optType: 'C'
                  });
                }}
                className={cn(
                  "px-3 py-2 text-sm rounded-md border transition-all",
                  instrumentType === 'option'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
              >
                Options
              </button>
            </div>
          </div>

          {/* Option Selection (if option selected) */}
          {instrumentType === 'option' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-caption text-muted-foreground mb-1 block">Expiry</label>
                  <select
                    value={selectedInstrument.expiry}
                    onChange={(e) => setSelectedInstrument({
                      ...selectedInstrument,
                      expiry: e.target.value
                    })}
                    className={cn(inputStyles.base, "text-sm")}
                  >
                    {expiries.map(exp => (
                      <option key={exp} value={exp}>{exp}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-caption text-muted-foreground mb-1 block">Strike</label>
                  <select
                    value={selectedInstrument.strike}
                    onChange={(e) => setSelectedInstrument({
                      ...selectedInstrument,
                      strike: parseFloat(e.target.value)
                    })}
                    className={cn(inputStyles.base, "text-sm")}
                  >
                    {strikes.map(strike => (
                      <option key={strike} value={strike}>${strike}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-caption text-muted-foreground mb-1 block">Type</label>
                  <select
                    value={selectedInstrument.optType}
                    onChange={(e) => setSelectedInstrument({
                      ...selectedInstrument,
                      optType: e.target.value as 'C' | 'P'
                    })}
                    className={cn(inputStyles.base, "text-sm")}
                  >
                    <option value="C">Call</option>
                    <option value="P">Put</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Order Type */}
          <div>
            <label className="text-caption text-muted-foreground uppercase tracking-wide mb-2 block">
              Order Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOrderType('MKT')}
                className={cn(
                  "px-3 py-2 text-sm rounded-md border transition-all",
                  orderType === 'MKT'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
              >
                Market
              </button>
              <button
                onClick={() => setOrderType('LMT')}
                className={cn(
                  "px-3 py-2 text-sm rounded-md border transition-all",
                  orderType === 'LMT'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
              >
                Limit
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-caption text-muted-foreground uppercase tracking-wide mb-2 block">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              className={cn(inputStyles.base, "text-lg font-mono")}
            />
          </div>

          {/* Limit Price (if limit order) */}
          {orderType === 'LMT' && (
            <div>
              <label className="text-caption text-muted-foreground uppercase tracking-wide mb-2 block">
                Limit Price
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                placeholder={currentTick?.mid?.toFixed(2) || '0.00'}
                className={cn(inputStyles.base, "text-lg font-mono")}
              />
            </div>
          )}

          {/* IV Override (options only) */}
          {instrumentType === 'option' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-caption text-muted-foreground uppercase tracking-wide">
                  IV Override
                </label>
                <button
                  onClick={() => setShowIvOverride(!showIvOverride)}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  {showIvOverride ? 'Hide' : 'Show'}
                </button>
              </div>
              {showIvOverride && (
                <div className="space-y-2">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={ivOverride || impliedVol * 100}
                    onChange={(e) => setIvOverride(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10%</span>
                    <span className="font-mono">{(ivOverride || impliedVol * 100).toFixed(0)}%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Estimated Cost/Greeks */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-small text-muted-foreground">Estimated {instrumentType === 'future' ? 'Notional' : 'Premium'}</span>
              <span className="text-body font-bold font-mono">
                {formatCurrency(estimatedCost)}
              </span>
            </div>
            
            {/* Show Greeks for options */}
            {instrumentType === 'option' && estimatedGreeks && (
              <>
                <div className="border-t border-border pt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delta</span>
                    <span className="font-mono">{formatNumber(estimatedGreeks.delta, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gamma</span>
                    <span className="font-mono">{formatNumber(estimatedGreeks.gamma, 4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vega</span>
                    <span className="font-mono">{formatNumber(estimatedGreeks.vega, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Theta</span>
                    <span className="font-mono">{formatNumber(estimatedGreeks.theta, 2)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Current Position */}
            {position && position.net_qty !== 0 && (
              <div className="border-t border-border pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Current Position</span>
                  <span className={cn(
                    "font-mono font-semibold",
                    position.net_qty > 0 ? "text-success" : "text-destructive"
                  )}>
                    {position.net_qty > 0 ? '+' : ''}{position.net_qty} @ {formatCurrency(position.avg_price)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !participantId}
            className={cn(
              buttonStyles.base,
              buttonStyles.sizes.lg,
              "w-full font-bold uppercase tracking-wide transition-all",
              side === 'BUY' 
                ? "bg-gradient-to-r from-success to-success/80 text-success-foreground hover:shadow-hard" 
                : "bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground hover:shadow-hard",
              (submitting || !participantId) && "opacity-50 cursor-not-allowed"
            )}
          >
            {submitting ? (
              <Activity className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              <>
                {side === 'BUY' ? <TrendingUp className="h-5 w-5 mr-2" /> : <TrendingDown className="h-5 w-5 mr-2" />}
                {side} {quantity} {formatOptionSymbol()}
              </>
            )}
          </button>

          {/* Info Message */}
          {!participantId && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
              <span className="text-xs text-warning">
                Please join the session before placing orders
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
