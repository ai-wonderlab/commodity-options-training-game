'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';

interface OptionChainProps {
  instruments: any[];
  ticks: any[];
}

export default function OptionChain({ instruments, ticks }: OptionChainProps) {
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [showIV, setShowIV] = useState(true);

  const optionInstrument = instruments?.find(i => i.type === 'OPTION');
  const expiries = optionInstrument?.expiries || [];
  
  const currentExpiry = selectedExpiry || expiries[0]?.date;
  const strikes = expiries.find(e => e.date === currentExpiry)?.strikes || [];

  // Get current BRN price for ATM marker
  const brnPrice = ticks?.find(t => t.symbol === 'BRN')?.mid || 82.5;
  const atmStrike = strikes.reduce((prev, curr) => 
    Math.abs(curr - brnPrice) < Math.abs(prev - brnPrice) ? curr : prev
  , strikes[0]);

  const formatPrice = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(2);
  };

  const formatIV = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return (value * 100).toFixed(1) + '%';
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Option Chain</h3>
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={showIV}
              onChange={(e) => setShowIV(e.target.checked)}
              className="mr-2"
            />
            Show IV
          </label>
        </div>
        <select
          value={currentExpiry}
          onChange={(e) => setSelectedExpiry(e.target.value)}
          className="w-full px-3 py-1 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
        >
          {expiries.map((exp: any) => (
            <option key={exp.date} value={exp.date}>
              {format(new Date(exp.date), 'MMM dd, yyyy')}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto option-chain-container">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
            <tr className="text-xs text-gray-600 dark:text-gray-400">
              <th className="py-2 px-2 text-center" colSpan={showIV ? 5 : 4}>CALLS</th>
              <th className="py-2 px-2 text-center bg-gray-100 dark:bg-gray-600">STRIKE</th>
              <th className="py-2 px-2 text-center" colSpan={showIV ? 5 : 4}>PUTS</th>
            </tr>
            <tr className="text-xs text-gray-500 dark:text-gray-400">
              {/* Calls */}
              <th className="py-1 px-1">Bid</th>
              <th className="py-1 px-1">Ask</th>
              <th className="py-1 px-1">Last</th>
              {showIV && <th className="py-1 px-1">IV</th>}
              <th className="py-1 px-1">Vol</th>
              
              {/* Strike */}
              <th className="py-1 px-2 bg-gray-100 dark:bg-gray-600"></th>
              
              {/* Puts */}
              <th className="py-1 px-1">Bid</th>
              <th className="py-1 px-1">Ask</th>
              <th className="py-1 px-1">Last</th>
              {showIV && <th className="py-1 px-1">IV</th>}
              <th className="py-1 px-1">Vol</th>
            </tr>
          </thead>
          <tbody>
            {strikes.map((strike: number) => {
              const isATM = strike === atmStrike;
              const callSymbol = `BUL${strike}C${currentExpiry.slice(2)}`;
              const putSymbol = `BUL${strike}P${currentExpiry.slice(2)}`;
              
              const callTick = ticks?.find(t => t.symbol === callSymbol);
              const putTick = ticks?.find(t => t.symbol === putSymbol);

              return (
                <tr 
                  key={strike}
                  className={`
                    hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700
                    ${isATM ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : ''}
                  `}
                >
                  {/* Calls */}
                  <td className="py-1 px-1 text-right mono-num text-green-600">
                    {formatPrice(callTick?.best_bid)}
                  </td>
                  <td className="py-1 px-1 text-right mono-num text-green-600">
                    {formatPrice(callTick?.best_ask)}
                  </td>
                  <td className="py-1 px-1 text-right mono-num">
                    {formatPrice(callTick?.last)}
                  </td>
                  {showIV && (
                    <td className="py-1 px-1 text-right mono-num text-gray-500">
                      {formatIV(0.25)}
                    </td>
                  )}
                  <td className="py-1 px-1 text-right mono-num text-gray-500">
                    {Math.floor(Math.random() * 100)}
                  </td>
                  
                  {/* Strike */}
                  <td className={`
                    py-1 px-2 text-center mono-num font-bold bg-gray-100 dark:bg-gray-600
                    ${isATM ? 'text-blue-600 dark:text-blue-400' : ''}
                  `}>
                    {strike.toFixed(1)}
                  </td>
                  
                  {/* Puts */}
                  <td className="py-1 px-1 text-right mono-num text-red-600">
                    {formatPrice(putTick?.best_bid)}
                  </td>
                  <td className="py-1 px-1 text-right mono-num text-red-600">
                    {formatPrice(putTick?.best_ask)}
                  </td>
                  <td className="py-1 px-1 text-right mono-num">
                    {formatPrice(putTick?.last)}
                  </td>
                  {showIV && (
                    <td className="py-1 px-1 text-right mono-num text-gray-500">
                      {formatIV(0.28)}
                    </td>
                  )}
                  <td className="py-1 px-1 text-right mono-num text-gray-500">
                    {Math.floor(Math.random() * 100)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
