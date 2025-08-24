'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { TrendingUp, TrendingDown } from 'lucide-react';

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
    } catch (error) {
      toast.error(error.message || 'Failed to submit order');
    } finally {
      setLoading(false);
    }
  };

  const isOption = order.symbol !== 'BRN';

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Order Ticket
        </h3>

        {/* Side Selection */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setOrder({ ...order, side: 'BUY' })}
            className={`py-3 px-4 rounded-lg font-medium transition-colors ${
              order.side === 'BUY'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <TrendingUp className="inline-block w-4 h-4 mr-2" />
            BUY
          </button>
          <button
            onClick={() => setOrder({ ...order, side: 'SELL' })}
            className={`py-3 px-4 rounded-lg font-medium transition-colors ${
              order.side === 'SELL'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <TrendingDown className="inline-block w-4 h-4 mr-2" />
            SELL
          </button>
        </div>

        {/* Instrument Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Instrument
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
                  Expiry
                </label>
                <input
                  type="date"
                  value={order.expiry}
                  onChange={(e) => setOrder({ ...order, expiry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Strike
                </label>
                <input
                  type="number"
                  value={order.strike}
                  onChange={(e) => setOrder({ ...order, strike: parseFloat(e.target.value) })}
                  step="0.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setOrder({ ...order, optType: 'C' })}
                className={`py-2 px-4 rounded-lg font-medium ${
                  order.optType === 'C'
                    ? 'bg-green-100 text-green-700 border-2 border-green-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                CALL
              </button>
              <button
                onClick={() => setOrder({ ...order, optType: 'P' })}
                className={`py-2 px-4 rounded-lg font-medium ${
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
            className={`py-2 px-4 rounded-lg font-medium ${
              order.type === 'MKT'
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            MARKET
          </button>
          <button
            onClick={() => setOrder({ ...order, type: 'LMT' })}
            className={`py-2 px-4 rounded-lg font-medium ${
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
              Quantity
            </label>
            <input
              type="number"
              value={order.qty}
              onChange={(e) => setOrder({ ...order, qty: parseInt(e.target.value) })}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          {order.type === 'LMT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Limit Price
              </label>
              <input
                type="number"
                value={order.limitPrice}
                onChange={(e) => setOrder({ ...order, limitPrice: parseFloat(e.target.value) })}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}
        </div>

        {/* IV Override for Options */}
        {isOption && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              IV Override (optional)
            </label>
            <input
              type="number"
              value={order.ivOverride || ''}
              onChange={(e) => setOrder({ ...order, ivOverride: e.target.value ? parseFloat(e.target.value) / 100 : null })}
              placeholder="e.g., 25 for 25%"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !participantId}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            order.side === 'BUY'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Submitting...' : `${order.side} ${order.qty} ${order.symbol}`}
        </button>

        {/* Estimated Cost */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Contract Size:</span>
            <span className="font-medium">1,000 bbl</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Notional:</span>
            <span className="font-medium">
              ${(order.qty * 1000 * (order.type === 'LMT' ? order.limitPrice : 82.5)).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
