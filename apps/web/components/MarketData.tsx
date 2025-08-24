'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function MarketData() {
  const [brnPrice, setBrnPrice] = useState(82.45);
  const [brnChange, setBrnChange] = useState(0.23);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const change = (Math.random() - 0.5) * 0.1;
      setBrnPrice(prev => {
        const newPrice = prev + change;
        setBrnChange(change);
        return newPrice;
      });
      setTick(t => t + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const isUp = brnChange >= 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Market Data</h3>
      
      <div className="space-y-3">
        {/* BRN Futures */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600">BRN Futures</p>
            <p className="text-lg font-bold">${brnPrice.toFixed(2)}</p>
          </div>
          <div className={`flex items-center gap-1 ${isUp ? 'text-green-600' : 'text-red-600'}`}>
            {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="text-sm font-medium">
              {isUp ? '+' : ''}{brnChange.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-600">Bid</p>
            <p className="text-sm font-medium">${(brnPrice - 0.05).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Ask</p>
            <p className="text-sm font-medium">${(brnPrice + 0.05).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Volume</p>
            <p className="text-sm font-medium">125,432</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Open Interest</p>
            <p className="text-sm font-medium">89,234</p>
          </div>
        </div>

        {/* Update Indicator */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Last Update</span>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${tick % 2 === 0 ? 'bg-green-500' : 'bg-green-400'} animate-pulse`} />
            <span className="text-xs text-gray-600">15-min delayed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
