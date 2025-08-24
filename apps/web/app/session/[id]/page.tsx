'use client';

import { useState, useEffect } from 'react';
import { OptionChain } from '../../../components/OptionChain';
import { OrderTicket } from '../../../components/OrderTicket';
import { Positions } from '../../../components/Positions';
import { RiskPanel } from '../../../components/RiskPanel';
import { Leaderboard } from '../../../components/Leaderboard';
import { MarketData } from '../../../components/MarketData';

export default function SessionPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<'ticket' | 'positions' | 'risk' | 'whatif'>('ticket');
  const [selectedInstrument, setSelectedInstrument] = useState<any>(null);
  const [positions, setPositions] = useState([]);
  const [greeks, setGreeks] = useState({
    delta: 0,
    gamma: 0,
    vega: 0,
    theta: 0,
    vanna: 0,
    vomma: 0,
    var: 0
  });

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-gray-900">Session: {params.id.slice(0, 8)}</h1>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">Mode: <span className="font-medium">Live</span></span>
              <span className="text-gray-600">Bankroll: <span className="font-medium">$100,000</span></span>
              <span className="text-gray-600">Players: <span className="font-medium">1/25</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
              Market Open
            </span>
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4 p-4">
          {/* Left Panel - Market Data & Option Chain */}
          <div className="col-span-4 space-y-4">
            <MarketData />
            <OptionChain onSelectInstrument={setSelectedInstrument} />
          </div>

          {/* Center Panel - Trading & Portfolio */}
          <div className="col-span-5 space-y-4">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex border-b border-gray-200">
                {['ticket', 'positions', 'risk', 'whatif'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      activeTab === tab
                        ? 'text-brent-blue border-b-2 border-brent-blue bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {tab === 'whatif' ? 'What-If' : tab}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === 'ticket' && (
                  <OrderTicket instrument={selectedInstrument} />
                )}
                {activeTab === 'positions' && (
                  <Positions positions={positions} />
                )}
                {activeTab === 'risk' && (
                  <RiskPanel greeks={greeks} />
                )}
                {activeTab === 'whatif' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">What-If Analysis</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Futures ±%</label>
                        <input
                          type="number"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Vol ±pts</label>
                        <input
                          type="number"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Days ±</label>
                        <input
                          type="number"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <button className="btn-primary text-sm">Calculate</button>
                  </div>
                )}
              </div>
            </div>

            {/* Portfolio Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Portfolio Summary</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">PnL</span>
                  <p className="font-semibold text-green-600">+$1,234.56</p>
                </div>
                <div>
                  <span className="text-gray-600">Score</span>
                  <p className="font-semibold">1,234</p>
                </div>
                <div>
                  <span className="text-gray-600">Drawdown</span>
                  <p className="font-semibold text-red-600">-$567.89</p>
                </div>
                <div>
                  <span className="text-gray-600">Fees</span>
                  <p className="font-semibold">$125.00</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Leaderboard & Alerts */}
          <div className="col-span-3 space-y-4">
            <Leaderboard />
            
            {/* Alerts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Alerts</h3>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-green-50 border border-green-200 rounded">
                  <span className="text-green-700">Order filled: BUY 10 BRN @ $82.45</span>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                  <span className="text-amber-700">VaR approaching limit: $4,500 / $5,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
