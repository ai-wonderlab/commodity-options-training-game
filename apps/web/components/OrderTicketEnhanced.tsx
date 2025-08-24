'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { TrendingUp, TrendingDown, Info, AlertCircle } from 'lucide-react';

interface OrderTicketEnhancedProps {
  sessionId: string;
  participantId: string;
  currentPrice?: number;
  baseVolatility?: number;
  onOrderSubmitted: () => void;
}

export default function OrderTicketEnhanced({ 
  sessionId, 
  participantId, 
  currentPrice = 82.5,
  baseVolatility = 0.25,
  onOrderSubmitted 
}: OrderTicketEnhancedProps) {
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
  const [showIVOverride, setShowIVOverride] = useState(false);
  const [ivBounds, setIvBounds] = useState({ min: 5, max: 100 }); // In percentage

  // Calculate IV bounds based on moneyness (for options)
  useEffect(() => {
    if (order.symbol === 'BUL' && order.strike > 0) {
      const moneyness = order.strike / currentPrice;
      
      // Tighter bounds for extreme moneyness
      if (moneyness > 1.5 || moneyness < 0.5) {
        setIvBounds({ min: 10, max: 80 });
      } else if (moneyness > 1.2 || moneyness < 0.8) {
        setIvBounds({ min: 8, max: 90 });
      } else {
        setIvBounds({ min: 5, max: 100 });
      }
    }
  }, [order.strike, order.symbol, currentPrice]);

  const handleSubmit = async () => {
    if (!participantId) {
      toast.error('Δεν είστε συνδεδεμένοι ως συμμετέχων');
      return;
    }

    if (order.qty <= 0) {
      toast.error('Η ποσότητα πρέπει να είναι θετική');
      return;
    }

    if (order.type === 'LMT' && order.limitPrice <= 0) {
      toast.error('Απαιτείται τιμή ορίου για εντολές limit');
      return;
    }

    // Validate option parameters
    if (order.symbol === 'BUL') {
      if (!order.expiry) {
        toast.error('Απαιτείται ημερομηνία λήξης για options');
        return;
      }
      if (!order.strike || order.strike <= 0) {
        toast.error('Απαιτείται τιμή άσκησης για options');
        return;
      }
      if (!order.optType) {
        toast.error('Επιλέξτε CALL ή PUT');
        return;
      }
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
          ivOverride: order.ivOverride ? order.ivOverride / 100 : undefined, // Convert to decimal
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Αποτυχία υποβολής εντολής');
      }

      toast.success(`Εντολή ${data.status === 'FILLED' ? 'εκτελέστηκε' : 'καταχωρήθηκε'}: ${order.side} ${order.qty} ${order.symbol}`);
      
      // Reset form
      setOrder({
        ...order,
        qty: 1,
        limitPrice: 0,
        ivOverride: null,
      });
      setShowIVOverride(false);

      onOrderSubmitted();
    } catch (error: any) {
      toast.error(error.message || 'Αποτυχία υποβολής εντολής');
    } finally {
      setLoading(false);
    }
  };

  const isOption = order.symbol === 'BUL';

  // Generate strike suggestions based on current price
  const strikeSuggestions = [];
  if (currentPrice > 0) {
    const baseStrike = Math.round(currentPrice / 2.5) * 2.5;
    for (let i = -5; i <= 5; i++) {
      strikeSuggestions.push(baseStrike + i * 2.5);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Εισαγωγή Εντολής
        </h3>

        {/* Side Selection */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setOrder({ ...order, side: 'BUY' })}
            className={`py-3 px-4 rounded-lg font-medium transition-all transform ${
              order.side === 'BUY'
                ? 'bg-green-600 text-white scale-105 shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <TrendingUp className="inline-block w-4 h-4 mr-2" />
            ΑΓΟΡΑ
          </button>
          <button
            onClick={() => setOrder({ ...order, side: 'SELL' })}
            className={`py-3 px-4 rounded-lg font-medium transition-all transform ${
              order.side === 'SELL'
                ? 'bg-red-600 text-white scale-105 shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <TrendingDown className="inline-block w-4 h-4 mr-2" />
            ΠΩΛΗΣΗ
          </button>
        </div>

        {/* Instrument Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Προϊόν
          </label>
          <select
            value={order.symbol}
            onChange={(e) => setOrder({ ...order, symbol: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="BRN">BRN Futures</option>
            <option value="BUL">BUL Options</option>
          </select>
        </div>

        {/* Option Details */}
        {isOption && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Λήξη
                </label>
                <input
                  type="date"
                  value={order.expiry}
                  onChange={(e) => setOrder({ ...order, expiry: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Τιμή Άσκησης
                </label>
                <select
                  value={order.strike}
                  onChange={(e) => setOrder({ ...order, strike: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="0">Επιλέξτε...</option>
                  {strikeSuggestions.map(strike => (
                    <option key={strike} value={strike}>
                      {strike.toFixed(2)} {strike === Math.round(currentPrice / 2.5) * 2.5 ? '(ATM)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setOrder({ ...order, optType: 'C' })}
                className={`py-2 px-4 rounded-lg font-medium transition-all ${
                  order.optType === 'C'
                    ? 'bg-green-100 text-green-700 border-2 border-green-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                CALL
              </button>
              <button
                onClick={() => setOrder({ ...order, optType: 'P' })}
                className={`py-2 px-4 rounded-lg font-medium transition-all ${
                  order.optType === 'P'
                    ? 'bg-red-100 text-red-700 border-2 border-red-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                PUT
              </button>
            </div>
          </>
        )}

        {/* Order Type */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setOrder({ ...order, type: 'MKT' })}
            className={`py-2 px-4 rounded-lg font-medium transition-all ${
              order.type === 'MKT'
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            MARKET
          </button>
          <button
            onClick={() => setOrder({ ...order, type: 'LMT' })}
            className={`py-2 px-4 rounded-lg font-medium transition-all ${
              order.type === 'LMT'
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            LIMIT
          </button>
        </div>

        {/* Quantity and Price */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ποσότητα
            </label>
            <input
              type="number"
              value={order.qty}
              onChange={(e) => setOrder({ ...order, qty: parseInt(e.target.value) || 0 })}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          {order.type === 'LMT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Τιμή Ορίου
              </label>
              <input
                type="number"
                value={order.limitPrice}
                onChange={(e) => setOrder({ ...order, limitPrice: parseFloat(e.target.value) || 0 })}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}
        </div>

        {/* IV Override for Options - Enhanced with Bounded Slider */}
        {isOption && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Τροποποίηση IV
              </label>
              <button
                onClick={() => {
                  setShowIVOverride(!showIVOverride);
                  if (!showIVOverride && !order.ivOverride) {
                    setOrder({ ...order, ivOverride: baseVolatility * 100 });
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showIVOverride ? 'Απόκρυψη' : 'Εμφάνιση'}
              </button>
            </div>
            
            {showIVOverride && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Βασική IV: {(baseVolatility * 100).toFixed(1)}% | Όρια: {ivBounds.min}%-{ivBounds.max}%
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={ivBounds.min}
                    max={ivBounds.max}
                    step="0.5"
                    value={order.ivOverride || baseVolatility * 100}
                    onChange={(e) => setOrder({ ...order, ivOverride: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <div className="w-16">
                    <input
                      type="number"
                      min={ivBounds.min}
                      max={ivBounds.max}
                      step="0.5"
                      value={order.ivOverride || baseVolatility * 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (value >= ivBounds.min && value <= ivBounds.max) {
                          setOrder({ ...order, ivOverride: value });
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"
                    />
                  </div>
                  <span className="text-sm font-medium">%</span>
                </div>
                
                {order.ivOverride && Math.abs(order.ivOverride - baseVolatility * 100) > 10 && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>Σημαντική απόκλιση από την τρέχουσα IV</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !participantId}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all transform hover:scale-105 ${
            order.side === 'BUY'
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
              : 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
        >
          {loading ? 'Υποβολή...' : `${order.side === 'BUY' ? 'ΑΓΟΡΑ' : 'ΠΩΛΗΣΗ'} ${order.qty} ${order.symbol}`}
        </button>

        {/* Estimated Cost & Risk Preview */}
        <div className="mt-4 space-y-2">
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600 dark:text-gray-400">Μέγεθος Συμβολαίου:</span>
              <span className="font-medium">1,000 bbl</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600 dark:text-gray-400">Ονομαστική Αξία:</span>
              <span className="font-medium">
                ${(order.qty * 1000 * (order.type === 'LMT' && order.limitPrice > 0 ? order.limitPrice : currentPrice)).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Εκτιμώμενα Έξοδα:</span>
              <span className="font-medium">
                ${(order.qty * 1.75).toFixed(2)}
              </span>
            </div>
          </div>
          
          {isOption && order.strike > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Moneyness:</span>
                <span className="font-medium">
                  {((order.strike / currentPrice) * 100).toFixed(1)}%
                  {order.strike < currentPrice * 0.95 && ' (ITM)'}
                  {order.strike > currentPrice * 1.05 && ' (OTM)'}
                  {order.strike >= currentPrice * 0.95 && order.strike <= currentPrice * 1.05 && ' (ATM)'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
