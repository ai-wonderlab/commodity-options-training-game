'use client';

import { AlertTriangle, Shield, TrendingUp, AlertCircle } from 'lucide-react';

interface RiskAnalysisProps {
  sessionId: string;
  playerData: any[];
}

export default function RiskAnalysis({ sessionId, playerData }: RiskAnalysisProps) {
  // Calculate risk metrics
  const breachPlayers = playerData.filter(p => p.breaches > 0);
  const highRiskPlayers = playerData.filter(p => p.var_usage > 80);
  const avgVarUsage = playerData.reduce((sum, p) => sum + p.var_usage, 0) / (playerData.length || 1);
  const maxVarUsage = Math.max(...playerData.map(p => p.var_usage));
  
  // Mock Greeks aggregation
  const aggregateGreeks = {
    delta: playerData.reduce((sum, p) => sum + (Math.random() - 0.5) * 100, 0),
    gamma: playerData.reduce((sum, p) => sum + Math.random() * 10, 0),
    vega: playerData.reduce((sum, p) => sum + (Math.random() - 0.5) * 50, 0),
    theta: playerData.reduce((sum, p) => sum - Math.random() * 20, 0),
  };

  return (
    <div className="space-y-6">
      {/* Risk Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Breaches</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600">
            {breachPlayers.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {((breachPlayers.length / playerData.length) * 100).toFixed(1)}% of players
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">High Risk</span>
            <AlertCircle className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="text-3xl font-bold text-yellow-600">
            {highRiskPlayers.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            VaR usage &gt; 80%
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Avg VaR Usage</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {avgVarUsage.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Max: {maxVarUsage.toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Risk Score</span>
            <Shield className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">
            {(100 - avgVarUsage).toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            out of 100
          </div>
        </div>
      </div>

      {/* Aggregate Greeks */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Aggregate Greeks (Session Total)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Delta (Δ)</div>
            <div className={`text-2xl font-bold ${
              Math.abs(aggregateGreeks.delta) > 200 ? 'text-yellow-600' : 'text-gray-900 dark:text-white'
            }`}>
              {aggregateGreeks.delta.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Price sensitivity</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gamma (Γ)</div>
            <div className={`text-2xl font-bold ${
              aggregateGreeks.gamma > 50 ? 'text-yellow-600' : 'text-gray-900 dark:text-white'
            }`}>
              {aggregateGreeks.gamma.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Delta sensitivity</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Vega (ν)</div>
            <div className={`text-2xl font-bold ${
              Math.abs(aggregateGreeks.vega) > 150 ? 'text-yellow-600' : 'text-gray-900 dark:text-white'
            }`}>
              {aggregateGreeks.vega.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Vol sensitivity</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Theta (Θ)</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {aggregateGreeks.theta.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Time decay</div>
          </div>
        </div>
      </div>

      {/* Risk Breach Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Risk Breach Timeline
        </h3>
        <div className="space-y-4">
          {breachPlayers.length > 0 ? (
            breachPlayers.map((player, index) => {
              const breachTime = new Date(Date.now() - Math.random() * 3600000);
              return (
                <div key={index} className="flex items-center gap-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {player.display_name}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {breachTime.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      VaR limit exceeded: {player.var_usage}% • Breaches: {player.breaches}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-2 text-green-600" />
              <p>No risk breaches during this session</p>
            </div>
          )}
        </div>
      </div>

      {/* VaR Usage Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          VaR Usage Distribution
        </h3>
        <div className="space-y-3">
          {[
            { range: '0-20%', color: 'bg-green-500', count: 0 },
            { range: '20-40%', color: 'bg-green-400', count: 0 },
            { range: '40-60%', color: 'bg-yellow-400', count: 0 },
            { range: '60-80%', color: 'bg-yellow-500', count: 0 },
            { range: '80-100%', color: 'bg-red-500', count: 0 },
          ].map(bin => {
            // Count players in each bin
            bin.count = playerData.filter(p => {
              if (bin.range === '0-20%') return p.var_usage <= 20;
              if (bin.range === '20-40%') return p.var_usage > 20 && p.var_usage <= 40;
              if (bin.range === '40-60%') return p.var_usage > 40 && p.var_usage <= 60;
              if (bin.range === '60-80%') return p.var_usage > 60 && p.var_usage <= 80;
              if (bin.range === '80-100%') return p.var_usage > 80;
              return false;
            }).length;
            
            const percentage = (bin.count / playerData.length) * 100;
            
            return (
              <div key={bin.range} className="flex items-center gap-4">
                <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                  {bin.range}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6">
                    <div
                      className={`h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${bin.color}`}
                      style={{ width: `${percentage}%` }}
                    >
                      {bin.count > 0 && bin.count}
                    </div>
                  </div>
                </div>
                <div className="w-16 text-sm text-gray-600 dark:text-gray-400 text-right">
                  {bin.count} players
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Recommendations */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
          Risk Management Recommendations
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          {avgVarUsage > 70 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Consider reducing position sizes - average VaR usage is high at {avgVarUsage.toFixed(1)}%</span>
            </li>
          )}
          {breachPlayers.length > 2 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Review risk limits - {breachPlayers.length} players breached their VaR limits</span>
            </li>
          )}
          {Math.abs(aggregateGreeks.delta) > 200 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>High directional exposure (Delta: {aggregateGreeks.delta.toFixed(1)}) - consider hedging</span>
            </li>
          )}
          {aggregateGreeks.gamma > 50 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Elevated gamma risk ({aggregateGreeks.gamma.toFixed(2)}) - monitor for rapid delta changes</span>
            </li>
          )}
          {breachPlayers.length === 0 && avgVarUsage < 50 && (
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Good risk discipline maintained throughout the session</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
