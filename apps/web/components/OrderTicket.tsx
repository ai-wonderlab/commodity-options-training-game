'use client';

import { useState } from 'react';

interface OrderTicketProps {
  instrument?: any;
}

export function OrderTicket({ instrument }: OrderTicketProps) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MKT' | 'LMT'>('MKT');
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState('');
  const [ivOverride, setIvOverride] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Order submitted:', {
      side,
      orderType,
      quantity,
      limitPrice,
      ivOverride,
      instrument
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Order Ticket</h3>
      
      {/* Instrument Display */}
      {instrument ? (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <div className="flex justify-between">
            <span className="font-medium">
              {instrument.optType ? `BUL ${instrument.strike} ${instrument.optType} ${instrument.expiry}` : 'BRN Futures'}
            </span>
            <span>Bid: ${instrument.bid} | Ask: ${instrument.ask}</span>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-500">
          Select an instrument from the option chain or enter manually
        </div>
      )}

      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide('BUY')}
          className={`py-2 px-4 rounded font-medium transition-colors ${
            side === 'BUY'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          BUY
        </button>
        <button
          type="button"
          onClick={() => setSide('SELL')}
          className={`py-2 px-4 rounded font-medium transition-colors ${
            side === 'SELL'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          SELL
        </button>
      </div>

      {/* Order Type */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Order Type</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOrderType('MKT')}
            className={`py-1 px-3 rounded text-sm transition-colors ${
              orderType === 'MKT'
                ? 'bg-brent-blue text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Market
          </button>
          <button
            type="button"
            onClick={() => setOrderType('LMT')}
            className={`py-1 px-3 rounded text-sm transition-colors ${
              orderType === 'LMT'
                ? 'bg-brent-blue text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Limit
          </button>
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Quantity (Contracts)</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            -
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="flex-1 px-3 py-1 text-center border border-gray-300 rounded text-sm"
            min="1"
          />
          <button
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* Limit Price (conditional) */}
      {orderType === 'LMT' && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">Limit Price</label>
          <input
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
            placeholder="0.00"
            step="0.01"
          />
        </div>
      )}

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          {showAdvanced ? '− Hide' : '+ Show'} Advanced Options
        </button>
        
        {showAdvanced && (
          <div className="mt-2 p-3 bg-gray-50 rounded space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">IV Override (%)</label>
              <input
                type="number"
                value={ivOverride}
                onChange={(e) => setIvOverride(e.target.value)}
                className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                placeholder="Auto"
                step="0.1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Estimated Cost/Proceeds */}
      <div className="p-3 bg-gray-50 rounded">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Estimated {side === 'BUY' ? 'Cost' : 'Proceeds'}:</span>
          <span className="font-medium">
            ${((instrument?.ask || 82.45) * quantity * 1000).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Fees:</span>
          <span>${(quantity * 2.50).toFixed(2)}</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className={`w-full py-2 rounded font-medium transition-colors ${
          side === 'BUY'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {side} {quantity} {instrument?.optType ? `${instrument.strike} ${instrument.optType}` : 'BRN'}
      </button>
    </form>
  );
}
