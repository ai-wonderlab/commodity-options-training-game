'use client';

import { useState } from 'react';

interface OptionChainProps {
  onSelectInstrument: (instrument: any) => void;
}

export function OptionChain({ onSelectInstrument }: OptionChainProps) {
  const [selectedExpiry, setSelectedExpiry] = useState('2024-03-15');
  const [showOnlyATM, setShowOnlyATM] = useState(false);

  const expiries = ['2024-03-15', '2024-06-15', '2024-09-15'];
  const strikes = [75, 77.5, 80, 82.5, 85, 87.5, 90, 92.5, 95];
  const atmStrike = 82.5;

  const getOptionData = (strike: number, type: 'C' | 'P') => {
    const isCall = type === 'C';
    const isITM = isCall ? strike < atmStrike : strike > atmStrike;
    const moneyness = Math.abs(strike - atmStrike) / atmStrike;
    
    // Simplified pricing
    const basePrice = Math.max(0.1, 5 - moneyness * 20);
    const iv = 0.25 + moneyness * 0.15;
    
    return {
      bid: (basePrice - 0.05).toFixed(2),
      ask: (basePrice + 0.05).toFixed(2),
      last: basePrice.toFixed(2),
      iv: (iv * 100).toFixed(1),
      volume: Math.floor(Math.random() * 1000),
      oi: Math.floor(Math.random() * 5000),
      isITM
    };
  };

  const filteredStrikes = showOnlyATM 
    ? strikes.filter(s => Math.abs(s - atmStrike) <= 5)
    : strikes;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Option Chain</h3>
        <div className="flex items-center gap-2">
          <select 
            value={selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 rounded"
          >
            {expiries.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs">
            <input 
              type="checkbox"
              checked={showOnlyATM}
              onChange={(e) => setShowOnlyATM(e.target.checked)}
              className="rounded"
            />
            ATM only
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th colSpan={5} className="py-1 text-center bg-green-50 text-green-700">CALLS</th>
              <th className="py-1 text-center bg-gray-50">Strike</th>
              <th colSpan={5} className="py-1 text-center bg-red-50 text-red-700">PUTS</th>
            </tr>
            <tr className="text-gray-600 border-b border-gray-200">
              <th className="py-1 text-left">OI</th>
              <th className="py-1 text-left">Vol</th>
              <th className="py-1 text-left">IV%</th>
              <th className="py-1 text-left">Bid</th>
              <th className="py-1 text-left">Ask</th>
              <th className="py-1 text-center font-bold">K</th>
              <th className="py-1 text-right">Bid</th>
              <th className="py-1 text-right">Ask</th>
              <th className="py-1 text-right">IV%</th>
              <th className="py-1 text-right">Vol</th>
              <th className="py-1 text-right">OI</th>
            </tr>
          </thead>
          <tbody>
            {filteredStrikes.map(strike => {
              const callData = getOptionData(strike, 'C');
              const putData = getOptionData(strike, 'P');
              const isATM = strike === atmStrike;
              
              return (
                <tr 
                  key={strike} 
                  className={`border-b border-gray-100 hover:bg-gray-50 ${isATM ? 'bg-yellow-50' : ''}`}
                >
                  {/* Call Side */}
                  <td className={`py-1 ${callData.isITM ? 'bg-green-50' : ''}`}>
                    {callData.oi}
                  </td>
                  <td className={`py-1 ${callData.isITM ? 'bg-green-50' : ''}`}>
                    {callData.volume}
                  </td>
                  <td className={`py-1 ${callData.isITM ? 'bg-green-50' : ''}`}>
                    {callData.iv}%
                  </td>
                  <td className={`py-1 ${callData.isITM ? 'bg-green-50' : ''}`}>
                    <button 
                      onClick={() => onSelectInstrument({
                        type: 'option',
                        strike,
                        expiry: selectedExpiry,
                        optType: 'C',
                        bid: callData.bid,
                        ask: callData.ask
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      {callData.bid}
                    </button>
                  </td>
                  <td className={`py-1 ${callData.isITM ? 'bg-green-50' : ''}`}>
                    <button 
                      onClick={() => onSelectInstrument({
                        type: 'option',
                        strike,
                        expiry: selectedExpiry,
                        optType: 'C',
                        bid: callData.bid,
                        ask: callData.ask
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      {callData.ask}
                    </button>
                  </td>
                  
                  {/* Strike */}
                  <td className={`py-1 text-center font-bold ${isATM ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                    {strike.toFixed(1)}
                  </td>
                  
                  {/* Put Side */}
                  <td className={`py-1 text-right ${putData.isITM ? 'bg-red-50' : ''}`}>
                    <button 
                      onClick={() => onSelectInstrument({
                        type: 'option',
                        strike,
                        expiry: selectedExpiry,
                        optType: 'P',
                        bid: putData.bid,
                        ask: putData.ask
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      {putData.bid}
                    </button>
                  </td>
                  <td className={`py-1 text-right ${putData.isITM ? 'bg-red-50' : ''}`}>
                    <button 
                      onClick={() => onSelectInstrument({
                        type: 'option',
                        strike,
                        expiry: selectedExpiry,
                        optType: 'P',
                        bid: putData.bid,
                        ask: putData.ask
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      {putData.ask}
                    </button>
                  </td>
                  <td className={`py-1 text-right ${putData.isITM ? 'bg-red-50' : ''}`}>
                    {putData.iv}%
                  </td>
                  <td className={`py-1 text-right ${putData.isITM ? 'bg-red-50' : ''}`}>
                    {putData.volume}
                  </td>
                  <td className={`py-1 text-right ${putData.isITM ? 'bg-red-50' : ''}`}>
                    {putData.oi}
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
