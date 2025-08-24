'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Target,
  AlertTriangle,
  BarChart3,
  Zap,
  RotateCcw,
  Save,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';

// Import από το Black-76 pricing engine
// import { black76Price, black76Greeks } from '../../packages/shared/src/black76';

interface Position {
  id: string;
  symbol: string;
  expiry?: string;
  strike?: number;
  opt_type?: 'C' | 'P';
  net_qty: number;
  avg_price: number;
  realized_pnl: number;
}

interface ScenarioInput {
  priceChange: number;        // % change in underlying price
  volChange: number;          // absolute change in implied vol (e.g., +5% vol)
  timeDecay: number;          // days forward to simulate
  interestRate: number;       // risk-free rate
}

interface ScenarioResult {
  newPrice: number;
  newVol: number;
  totalPnL: number;
  totalDelta: number;
  totalGamma: number;
  totalVega: number;
  totalTheta: number;
  var95: number;
  positionDetails: PositionResult[];
}

interface PositionResult {
  positionId: string;
  symbol: string;
  currentValue: number;
  newValue: number;
  pnl: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
}

interface WhatIfAnalysisProps {
  positions: Position[];
  currentPrice: number;
  currentVol: number;
  sessionId?: string;
  participantId?: string;
}

export default function WhatIfAnalysis({
  positions,
  currentPrice,
  currentVol,
  sessionId,
  participantId
}: WhatIfAnalysisProps) {
  const [scenario, setScenario] = useState<ScenarioInput>({
    priceChange: 0,
    volChange: 0,
    timeDecay: 0,
    interestRate: 0.05 // 5% default
  });

  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<{[key: string]: ScenarioInput}>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<'pnl' | 'delta' | 'gamma' | 'vega'>('pnl');

  // Predefined scenario templates
  const scenarioTemplates = {
    'bull_5': { priceChange: 5, volChange: -2, timeDecay: 0, interestRate: 0.05 },
    'bear_5': { priceChange: -5, volChange: 3, timeDecay: 0, interestRate: 0.05 },
    'vol_shock': { priceChange: 0, volChange: 10, timeDecay: 0, interestRate: 0.05 },
    'time_decay': { priceChange: 0, volChange: 0, timeDecay: 1, interestRate: 0.05 },
    'crash': { priceChange: -15, volChange: 15, timeDecay: 0, interestRate: 0.05 },
    'rally': { priceChange: 10, volChange: -5, timeDecay: 0, interestRate: 0.05 }
  };

  // Mock Black-76 calculation (replace with actual implementation)
  const calculateBlack76 = (
    futuresPrice: number, 
    strike: number, 
    timeToExpiry: number, 
    volatility: number, 
    riskFreeRate: number, 
    optionType: 'C' | 'P'
  ) => {
    // Simplified mock calculation - replace with actual Black-76
    const discountFactor = Math.exp(-riskFreeRate * timeToExpiry);
    const d1 = (Math.log(futuresPrice / strike) + 0.5 * volatility * volatility * timeToExpiry) / 
               (volatility * Math.sqrt(timeToExpiry));
    const d2 = d1 - volatility * Math.sqrt(timeToExpiry);
    
    // Mock normal CDF
    const normCDF = (x: number) => {
      return 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    };
    
    const callPrice = discountFactor * (futuresPrice * normCDF(d1) - strike * normCDF(d2));
    const putPrice = discountFactor * (strike * normCDF(-d2) - futuresPrice * normCDF(-d1));
    
    const price = optionType === 'C' ? callPrice : putPrice;
    
    // Mock Greeks (simplified)
    const delta = optionType === 'C' ? normCDF(d1) : normCDF(d1) - 1;
    const gamma = Math.exp(-d1 * d1 / 2) / (futuresPrice * volatility * Math.sqrt(2 * Math.PI * timeToExpiry));
    const vega = futuresPrice * Math.sqrt(timeToExpiry) * Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
    const theta = -(futuresPrice * volatility * gamma / (2 * Math.sqrt(timeToExpiry))) * discountFactor;
    
    return { price, delta, gamma, vega, theta };
  };

  // Calculate scenario results
  const calculateScenario = async () => {
    setIsCalculating(true);
    
    try {
      // Calculate new market conditions
      const newPrice = currentPrice * (1 + scenario.priceChange / 100);
      const newVol = Math.max(0.01, Math.min(1.0, currentVol + scenario.volChange / 100));
      
      const positionResults: PositionResult[] = [];
      let totalPnL = 0;
      let totalDelta = 0;
      let totalGamma = 0;
      let totalVega = 0;
      let totalTheta = 0;
      
      // Calculate for each position
      for (const position of positions.filter(p => p.net_qty !== 0)) {
        let currentValue = 0;
        let newValue = 0;
        let positionGreeks = { delta: 0, gamma: 0, vega: 0, theta: 0 };
        
        if (position.opt_type && position.strike && position.expiry) {
          // Options position
          const timeToExpiry = Math.max(0.001, 
            (new Date(position.expiry).getTime() - Date.now() - scenario.timeDecay * 24 * 60 * 60 * 1000) / 
            (365.25 * 24 * 60 * 60 * 1000)
          );
          
          // Current value
          const currentCalc = calculateBlack76(
            currentPrice, position.strike, timeToExpiry + scenario.timeDecay / 365.25, 
            currentVol, scenario.interestRate, position.opt_type
          );
          currentValue = currentCalc.price;
          
          // New value under scenario
          const newCalc = calculateBlack76(
            newPrice, position.strike, timeToExpiry, 
            newVol, scenario.interestRate, position.opt_type
          );
          newValue = newCalc.price;
          positionGreeks = newCalc;
          
        } else {
          // Futures position
          currentValue = currentPrice;
          newValue = newPrice;
          positionGreeks.delta = position.net_qty > 0 ? 1000 : -1000; // 1000 bbl per contract
        }
        
        const positionPnL = (newValue - currentValue) * position.net_qty * 1000;
        
        const positionResult: PositionResult = {
          positionId: position.id,
          symbol: position.symbol,
          currentValue,
          newValue,
          pnl: positionPnL,
          delta: positionGreeks.delta * position.net_qty,
          gamma: positionGreeks.gamma * position.net_qty,
          vega: positionGreeks.vega * position.net_qty,
          theta: positionGreeks.theta * position.net_qty
        };
        
        positionResults.push(positionResult);
        
        // Aggregate totals
        totalPnL += positionPnL;
        totalDelta += positionResult.delta;
        totalGamma += positionResult.gamma;
        totalVega += positionResult.vega;
        totalTheta += positionResult.theta;
      }
      
      // Mock VaR calculation (simplified)
      const var95 = Math.abs(totalPnL * 1.65); // 1.65 for 95% confidence interval
      
      const scenarioResult: ScenarioResult = {
        newPrice,
        newVol,
        totalPnL,
        totalDelta,
        totalGamma,
        totalVega,
        totalTheta,
        var95,
        positionDetails: positionResults
      };
      
      setResult(scenarioResult);
      
    } catch (error) {
      console.error('Error calculating scenario:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Auto-calculate when scenario changes
  useEffect(() => {
    if (positions.length > 0) {
      const timer = setTimeout(() => {
        calculateScenario();
      }, 500); // Debounce
      
      return () => clearTimeout(timer);
    }
  }, [scenario, positions, currentPrice, currentVol]);

  // Apply template
  const applyTemplate = (templateKey: string) => {
    const template = scenarioTemplates[templateKey as keyof typeof scenarioTemplates];
    if (template) {
      setScenario(template);
    }
  };

  // Save scenario
  const saveScenario = () => {
    const name = prompt('Όνομα σεναρίου:');
    if (name) {
      setSavedScenarios(prev => ({
        ...prev,
        [name]: { ...scenario }
      }));
    }
  };

  // Load saved scenario
  const loadScenario = (name: string) => {
    const saved = savedScenarios[name];
    if (saved) {
      setScenario(saved);
    }
  };

  // Reset to base case
  const resetScenario = () => {
    setScenario({
      priceChange: 0,
      volChange: 0,
      timeDecay: 0,
      interestRate: 0.05
    });
  };

  // Format currency
  const formatCurrency = (value: number) => {
    const prefix = value < 0 ? '-$' : '$';
    return prefix + Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Format percentage
  const formatPercent = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  };

  // Format Greek values
  const formatGreek = (value: number, decimal: number = 0) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimal,
      maximumFractionDigits: decimal,
      signDisplay: 'always'
    });
  };

  if (positions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
        <div className="text-center text-gray-500">
          <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h3 className="font-medium mb-2">What-If Analysis</h3>
          <p className="text-sm">
            Αναλύστε πώς θα επηρεάσουν οι αλλαγές στην αγορά το portfolio σας
          </p>
          <p className="text-xs mt-2">
            Χρειάζεστε ανοιχτές θέσεις για ανάλυση
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">What-If Analysis</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showAdvanced ? 'Απλή' : 'Προηγμένη'}
            </button>
            
            <button
              onClick={saveScenario}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Αποθήκευση σεναρίου"
            >
              <Save className="w-4 h-4" />
            </button>
            
            <button
              onClick={resetScenario}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Template Scenarios */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {Object.entries(scenarioTemplates).map(([key, template]) => {
            const labels: Record<string, string> = {
              'bull_5': 'Bull +5%',
              'bear_5': 'Bear -5%',
              'vol_shock': 'Vol Shock',
              'time_decay': '1 Day Θ',
              'crash': 'Crash -15%',
              'rally': 'Rally +10%'
            };
            
            return (
              <button
                key={key}
                onClick={() => applyTemplate(key)}
                className="px-3 py-2 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg transition-colors"
              >
                {labels[key]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scenario Inputs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">Παράμετροι Σεναρίου</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Price Change */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Μεταβολή Τιμής (%)
            </label>
            <div className="relative">
              <input
                type="number"
                value={scenario.priceChange}
                onChange={(e) => setScenario(prev => ({ 
                  ...prev, 
                  priceChange: parseFloat(e.target.value) || 0 
                }))}
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="absolute right-3 top-2 text-sm text-gray-500">%</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Νέα τιμή: ${(currentPrice * (1 + scenario.priceChange / 100)).toFixed(2)}
            </div>
          </div>

          {/* Vol Change */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Μεταβολή Vol (pts)
            </label>
            <div className="relative">
              <input
                type="number"
                value={scenario.volChange}
                onChange={(e) => setScenario(prev => ({ 
                  ...prev, 
                  volChange: parseFloat(e.target.value) || 0 
                }))}
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="absolute right-3 top-2 text-sm text-gray-500">pts</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Νέα IV: {((currentVol + scenario.volChange / 100) * 100).toFixed(1)}%
            </div>
          </div>

          {/* Time Decay */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Χρονική Φθορά (ημέρες)
            </label>
            <input
              type="number"
              value={scenario.timeDecay}
              onChange={(e) => setScenario(prev => ({ 
                ...prev, 
                timeDecay: parseInt(e.target.value) || 0 
              }))}
              min="0"
              max="30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Interest Rate (Advanced) */}
          {showAdvanced && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Risk-Free Rate (%)
              </label>
              <input
                type="number"
                value={scenario.interestRate * 100}
                onChange={(e) => setScenario(prev => ({ 
                  ...prev, 
                  interestRate: (parseFloat(e.target.value) || 5) / 100 
                }))}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}
        </div>

        {/* Saved Scenarios */}
        {Object.keys(savedScenarios).length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Αποθηκευμένα Σενάρια
            </h5>
            <div className="flex flex-wrap gap-2">
              {Object.keys(savedScenarios).map(name => (
                <button
                  key={name}
                  onClick={() => loadScenario(name)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">
              Αποτελέσματα Σεναρίου
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total P&L */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  {result.totalPnL >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm text-gray-500">Συνολικό P&L</span>
                </div>
                <div className={`text-lg font-bold ${
                  result.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(result.totalPnL)}
                </div>
              </div>

              {/* Total Delta */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="text-sm text-gray-500 mb-1">Συνολικό Δέλτα</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatGreek(result.totalDelta, 0)}
                </div>
              </div>

              {/* VaR 95% */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-gray-500">VaR 95%</span>
                </div>
                <div className="text-lg font-bold text-orange-600">
                  {formatCurrency(result.var95)}
                </div>
              </div>

              {/* Market Impact */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="text-sm text-gray-500 mb-1">Αγορά</div>
                <div className="text-sm">
                  <div className="text-gray-900 dark:text-white">
                    ${result.newPrice.toFixed(2)} 
                    <span className={`ml-1 ${scenario.priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ({formatPercent(scenario.priceChange)})
                    </span>
                  </div>
                  <div className="text-gray-500">
                    IV: {(result.newVol * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Greeks Summary (Advanced) */}
            {showAdvanced && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-500">Gamma</div>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {formatGreek(result.totalGamma, 2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Vega</div>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {formatGreek(result.totalVega, 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Theta</div>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {formatGreek(result.totalTheta, 0)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Position Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Ανάλυση ανά Θέση
              </h4>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Θέση</th>
                    <th className="px-4 py-3 text-right">Τρέχουσα Αξία</th>
                    <th className="px-4 py-3 text-right">Νέα Αξία</th>
                    <th className="px-4 py-3 text-right">P&L</th>
                    <th className="px-4 py-3 text-right">Δέλτα</th>
                    {showAdvanced && (
                      <>
                        <th className="px-4 py-3 text-right">Γάμμα</th>
                        <th className="px-4 py-3 text-right">Vega</th>
                        <th className="px-4 py-3 text-right">Theta</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {result.positionDetails.map((pos, index) => {
                    const position = positions.find(p => p.id === pos.positionId);
                    if (!position) return null;
                    
                    return (
                      <tr key={pos.positionId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {pos.symbol}
                            {position.opt_type && ` ${position.strike} ${position.opt_type}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            Qty: {position.net_qty}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          ${pos.currentValue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          ${pos.newValue.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${
                          pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(pos.pnl)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {formatGreek(pos.delta, 0)}
                        </td>
                        {showAdvanced && (
                          <>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {formatGreek(pos.gamma, 2)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {formatGreek(pos.vega, 0)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {formatGreek(pos.theta, 0)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isCalculating && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Υπολογισμός σεναρίου...</p>
          </div>
        </div>
      )}

      {/* Risk Warning */}
      {result && Math.abs(result.totalPnL) > 100000 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <h5 className="font-medium text-yellow-800">Προσοχή: Υψηλός Κίνδυνος</h5>
              <p className="text-sm text-yellow-700 mt-1">
                Το σενάριο δείχνει σημαντικές αλλαγές στο P&L. Εξετάστε τους κινδύνους προσεκτικά.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
