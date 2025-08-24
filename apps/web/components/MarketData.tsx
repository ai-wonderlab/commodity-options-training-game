'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MarketDataProps {
  ticks: any[];
}

export default function MarketData({ ticks }: MarketDataProps) {
  const brnTick = ticks?.find(t => t.symbol === 'BRN');
  
  if (!brnTick) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="text-center text-gray-500">No market data available</div>
      </div>
    );
  }

  const change = Math.random() * 2 - 1; // Mock change
  const changePercent = (change / brnTick.mid) * 100;
  const isUp = change > 0;
  const isDown = change < 0;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg">ICE Brent (BRN)</h3>
        <span className="text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded">
          15min delayed
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold mono-num">
              ${brnTick.mid.toFixed(2)}
            </span>
            {isUp && <TrendingUp className="w-5 h-5 text-green-600" />}
            {isDown && <TrendingDown className="w-5 h-5 text-red-600" />}
            {!isUp && !isDown && <Minus className="w-5 h-5 text-gray-400" />}
          </div>
          <div className={`text-sm ${isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-600'}`}>
            {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePercent.toFixed(2)}%)
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Bid</div>
            <div className="font-medium mono-num">${brnTick.best_bid.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Ask</div>
            <div className="font-medium mono-num">${brnTick.best_ask.toFixed(2)}</div>
          </div>
        </div>
      </div>
      
      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <div>Contract: 1,000 bbl</div>
        <div>Tick: $0.01/bbl</div>
        <div>Time: {new Date(brnTick.ts).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
