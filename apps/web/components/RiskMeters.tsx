'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface RiskMetersProps {
  participantId: string;
  limits: any;
}

interface Greeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  var_estimate: number;
}

export default function RiskMeters({ participantId, limits }: RiskMetersProps) {
  const [greeks, setGreeks] = useState<Greeks>({
    delta: 0,
    gamma: 0,
    vega: 0,
    theta: 0,
    var_estimate: 0,
  });

  useEffect(() => {
    const fetchGreeks = async () => {
      if (!participantId) return;
      
      const { data } = await supabase
        .from('greek_snapshots')
        .select('*')
        .eq('participant_id', participantId)
        .order('ts', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setGreeks({
          delta: data.delta,
          gamma: data.gamma,
          vega: data.vega,
          theta: data.theta,
          var_estimate: data.var_estimate,
        });
      }
    };

    fetchGreeks();
    const interval = setInterval(fetchGreeks, 5000);
    
    return () => clearInterval(interval);
  }, [participantId]);

  const getRiskLevel = (value: number, limit: number) => {
    const percentage = Math.abs(value / limit) * 100;
    if (percentage < 60) return 'safe';
    if (percentage < 80) return 'warning';
    return 'breach';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'safe': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'breach': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'safe': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'breach': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const riskMetrics = [
    {
      name: 'Delta (Δ)',
      value: greeks.delta,
      limit: limits?.delta || 1000,
      description: 'Price sensitivity',
      unit: '$',
    },
    {
      name: 'Gamma (Γ)',
      value: greeks.gamma,
      limit: limits?.gamma || 100,
      description: 'Delta change rate',
      unit: '',
    },
    {
      name: 'Vega (ν)',
      value: greeks.vega,
      limit: limits?.vega || 500,
      description: 'Volatility sensitivity',
      unit: '$',
    },
    {
      name: 'Theta (Θ)',
      value: greeks.theta,
      limit: limits?.theta || -200,
      description: 'Time decay',
      unit: '$/day',
      isNegative: true,
    },
    {
      name: 'VaR (95%)',
      value: greeks.var_estimate,
      limit: limits?.var || 5000,
      description: '1-day value at risk',
      unit: '$',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Risk Metrics
        </h3>
        
        <div className="space-y-3">
          {riskMetrics.map((metric) => {
            const percentage = metric.isNegative
              ? Math.abs((metric.value / metric.limit) * 100)
              : Math.abs((metric.value / Math.abs(metric.limit)) * 100);
            const level = getRiskLevel(metric.value, metric.limit);
            
            return (
              <div key={metric.name} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {metric.name}
                    </span>
                    {getRiskIcon(level)}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold mono-num">
                      {metric.unit}{Math.abs(metric.value).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Limit: {metric.unit}{Math.abs(metric.limit).toFixed(0)}
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 mb-1">{metric.description}</div>
                
                <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full transition-all duration-300 ${getRiskColor(level)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                  {percentage > 80 && (
                    <div className="absolute inset-0 animate-pulse bg-red-500 opacity-50" />
                  )}
                </div>
                
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>{percentage.toFixed(1)}%</span>
                  <span>100%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Breach Summary */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
              Risk Policy
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Breaches are allowed but penalized. Score = PnL - (breach_time × α + var_exceed × β)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
