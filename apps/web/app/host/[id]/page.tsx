'use client';

import { useState } from 'react';
import { Play, Pause, Zap, Download, Users, TrendingUp } from 'lucide-react';

export default function HostPage({ params }: { params: { id: string } }) {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);

  const participants = [
    { 
      id: '1', 
      name: 'Trader Alpha', 
      pnl: 2845.50, 
      score: 3845,
      delta: 234,
      gamma: 45,
      vega: 123,
      theta: -67,
      var: 3450,
      positions: 5
    },
    { 
      id: '2', 
      name: 'Market Maker', 
      pnl: 1234.56, 
      score: 2234,
      delta: -123,
      gamma: 23,
      vega: 89,
      theta: -34,
      var: 2100,
      positions: 8
    },
    { 
      id: '3', 
      name: 'Option Pro', 
      pnl: 987.23, 
      score: 1987,
      delta: 567,
      gamma: 78,
      vega: 234,
      theta: -123,
      var: 4500,
      positions: 12
    },
  ];

  const handleShock = (type: 'price' | 'vol') => {
    const value = prompt(`Enter ${type === 'price' ? 'price shock %' : 'volatility shock points'}:`);
    if (value) {
      console.log(`Applying ${type} shock:`, value);
    }
  };

  const handleExport = (type: string) => {
    console.log(`Exporting ${type} data...`);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-brent-dark text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold">Instructor Console</h1>
            <span className="text-sm opacity-80">Session: {params.id.slice(0, 8)}</span>
            <div className="flex items-center gap-2">
              <Users size={16} />
              <span className="text-sm">{participants.length} Players</span>
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
                isPaused 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isPaused ? (
                <>
                  <Play size={16} />
                  Resume
                </>
              ) : (
                <>
                  <Pause size={16} />
                  Pause
                </>
              )}
            </button>
            
            <button
              onClick={() => handleShock('price')}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium transition-colors"
            >
              <Zap size={16} />
              Price Shock
            </button>
            
            <button
              onClick={() => handleShock('vol')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium transition-colors"
            >
              <TrendingUp size={16} />
              Vol Shock
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Participant Grid */}
        <div className="col-span-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Live Monitoring</h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('trades')}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
              >
                <Download size={12} />
                Export Trades
              </button>
              <button
                onClick={() => handleExport('greeks')}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
              >
                <Download size={12} />
                Export Greeks
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-600">
                  <th className="text-left py-2">Player</th>
                  <th className="text-center py-2">Positions</th>
                  <th className="text-right py-2">P&L</th>
                  <th className="text-right py-2">Score</th>
                  <th className="text-right py-2">Δ</th>
                  <th className="text-right py-2">Γ</th>
                  <th className="text-right py-2">ν</th>
                  <th className="text-right py-2">Θ</th>
                  <th className="text-right py-2">VaR</th>
                  <th className="text-center py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr 
                    key={p.id}
                    onClick={() => setSelectedParticipant(p.id)}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      selectedParticipant === p.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 text-center">{p.positions}</td>
                    <td className={`py-2 text-right font-medium ${p.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                    </td>
                    <td className="py-2 text-right">{p.score}</td>
                    <td className={`py-2 text-right ${Math.abs(p.delta) > 800 ? 'text-amber-600 font-medium' : ''}`}>
                      {p.delta}
                    </td>
                    <td className="py-2 text-right">{p.gamma}</td>
                    <td className="py-2 text-right">{p.vega}</td>
                    <td className="py-2 text-right">{p.theta}</td>
                    <td className={`py-2 text-right ${p.var > 4000 ? 'text-red-600 font-medium' : ''}`}>
                      ${p.var}
                    </td>
                    <td className="py-2 text-center">
                      {p.var > 4500 ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Breach</span>
                      ) : p.var > 4000 ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">Warning</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panels */}
        <div className="col-span-4 space-y-4">
          {/* Session Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Session Statistics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Volume:</span>
                <span className="font-medium">245 contracts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Fees:</span>
                <span className="font-medium">$612.50</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Score:</span>
                <span className="font-medium">2,688</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Breaches:</span>
                <span className="font-medium text-red-600">2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Session Time:</span>
                <span className="font-medium">45:23</span>
              </div>
            </div>
          </div>

          {/* Market Controls */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Market Controls</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Replay Speed</label>
                <select className="w-full px-3 py-1 text-sm border border-gray-300 rounded">
                  <option>1x (Real-time)</option>
                  <option>2x</option>
                  <option>4x</option>
                  <option>8x</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Spread Override (%)</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-1 text-sm border border-gray-300 rounded"
                  placeholder="0.02"
                  step="0.01"
                />
              </div>
              <button className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium">
                Apply Changes
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-gray-50 rounded">
                <div className="font-medium">Trader Alpha</div>
                <div className="text-gray-600">BUY 5 BUL 85C Mar @ $0.95</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="font-medium">Market Maker</div>
                <div className="text-gray-600">SELL 10 BRN @ $82.45</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="font-medium">Option Pro</div>
                <div className="text-gray-600">BUY 3 BUL 80P Mar @ $0.85</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
