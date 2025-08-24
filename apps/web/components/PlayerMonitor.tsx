'use client';

import { useState } from 'react';
import { 
  User, TrendingUp, TrendingDown, AlertTriangle, 
  Activity, DollarSign, AlertCircle 
} from 'lucide-react';

interface Player {
  id: string;
  display_name: string;
  bankroll: number;
  current_pnl: number;
  var_usage: number;
  greeks: {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
  };
  positions: number;
  breaches: number;
  status: 'active' | 'inactive' | 'breached';
}

interface PlayerMonitorProps {
  players: Player[];
}

export default function PlayerMonitor({ players }: PlayerMonitorProps) {
  const [sortBy, setSortBy] = useState<'name' | 'pnl' | 'var' | 'breaches'>('pnl');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const sortedPlayers = [...players].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.display_name.localeCompare(b.display_name);
      case 'pnl':
        return b.current_pnl - a.current_pnl;
      case 'var':
        return b.var_usage - a.var_usage;
      case 'breaches':
        return b.breaches - a.breaches;
      default:
        return 0;
    }
  });

  const getStatusColor = (player: Player) => {
    if (player.status === 'breached') return 'border-red-500 bg-red-50 dark:bg-red-900/20';
    if (player.var_usage > 80) return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
    if (player.status === 'inactive') return 'border-gray-300 bg-gray-50 dark:bg-gray-800';
    return 'border-green-500 bg-green-50 dark:bg-green-900/20';
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400';
    if (pnl < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Player Monitor
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="name">Name</option>
              <option value="pnl">P&L</option>
              <option value="var">VaR Usage</option>
              <option value="breaches">Breaches</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Player
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                P&L
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                VaR
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Delta
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Gamma
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Vega
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Theta
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Pos
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Risk
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedPlayers.map((player) => (
              <tr
                key={player.id}
                onClick={() => setSelectedPlayer(player.id === selectedPlayer ? null : player.id)}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedPlayer === player.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      player.status === 'active' ? 'bg-green-500' :
                      player.status === 'breached' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {player.display_name}
                    </span>
                  </div>
                </td>
                <td className={`px-4 py-3 text-right text-sm font-mono whitespace-nowrap ${getPnLColor(player.current_pnl)}`}>
                  {player.current_pnl >= 0 ? '+' : ''}{player.current_pnl.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${
                          player.var_usage > 80 ? 'bg-red-500' :
                          player.var_usage > 60 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, player.var_usage)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {player.var_usage.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className={`px-4 py-3 text-right text-sm font-mono ${
                  Math.abs(player.greeks.delta) > 50 ? 'text-yellow-600' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {player.greeks.delta.toFixed(1)}
                </td>
                <td className={`px-4 py-3 text-right text-sm font-mono ${
                  player.greeks.gamma > 5 ? 'text-yellow-600' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {player.greeks.gamma.toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right text-sm font-mono ${
                  Math.abs(player.greeks.vega) > 30 ? 'text-yellow-600' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {player.greeks.vega.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-mono text-gray-700 dark:text-gray-300">
                  {player.greeks.theta.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                  {player.positions}
                </td>
                <td className="px-4 py-3 text-center">
                  {player.breaches > 0 ? (
                    <div className="flex items-center justify-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {player.breaches}
                      </span>
                    </div>
                  ) : player.var_usage > 80 ? (
                    <AlertCircle className="w-4 h-4 text-yellow-500 mx-auto" />
                  ) : (
                    <span className="text-xs text-green-600 dark:text-green-400">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Player Details Panel */}
      {selectedPlayer && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          {(() => {
            const player = players.find(p => p.id === selectedPlayer);
            if (!player) return null;
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Performance
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Bankroll:</span>
                      <span className="font-mono">${player.bankroll.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Current P&L:</span>
                      <span className={`font-mono ${getPnLColor(player.current_pnl)}`}>
                        {player.current_pnl >= 0 ? '+' : ''}${player.current_pnl.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Return:</span>
                      <span className={`font-mono ${getPnLColor(player.current_pnl)}`}>
                        {((player.current_pnl / player.bankroll) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Risk Metrics
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">VaR Usage:</span>
                      <span className={`font-mono ${
                        player.var_usage > 80 ? 'text-red-600' : 
                        player.var_usage > 60 ? 'text-yellow-600' : 
                        'text-green-600'
                      }`}>
                        {player.var_usage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Breaches:</span>
                      <span className={`font-mono ${player.breaches > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {player.breaches}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Positions:</span>
                      <span className="font-mono">{player.positions}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Actions
                  </h4>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                      View Positions
                    </button>
                    <button className="w-full px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700">
                      Send Warning
                    </button>
                    {player.status === 'breached' && (
                      <button className="w-full px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                        Force Close
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
