'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';

interface Greeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  vanna: number;
  vomma: number;
  var: number;
}

interface RiskPanelProps {
  greeks?: Greeks;
}

export function RiskPanel({ greeks }: RiskPanelProps) {
  const defaultGreeks = {
    delta: 234.5,
    gamma: 12.3,
    vega: 89.2,
    theta: -45.6,
    vanna: 5.2,
    vomma: 3.8,
    var: 3250
  };

  const currentGreeks = greeks || defaultGreeks;

  const riskLimits = {
    delta: { max: 1000, warning: 800 },
    gamma: { max: 100, warning: 80 },
    vega: { max: 500, warning: 400 },
    theta: { max: -200, warning: -160 },
    var: { max: 5000, warning: 4000 }
  };

  const getRiskLevel = (value: number, limits: { max: number; warning: number }) => {
    const absValue = Math.abs(value);
    const absMax = Math.abs(limits.max);
    const absWarning = Math.abs(limits.warning);
    
    if (absValue > absMax) return 'breach';
    if (absValue > absWarning) return 'warning';
    return 'safe';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'breach': return 'bg-red-500';
      case 'warning': return 'bg-amber-500';
      default: return 'bg-green-500';
    }
  };

  const RiskMeter = ({ label, value, limit }: { label: string; value: number; limit: { max: number; warning: number } }) => {
    const level = getRiskLevel(value, limit);
    const percentage = Math.min(100, (Math.abs(value) / Math.abs(limit.max)) * 100);

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">{label}</span>
          <div className="flex items-center gap-1">
            <span className={`font-medium ${level === 'breach' ? 'text-red-600' : level === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
              {value.toFixed(1)}
            </span>
            <span className="text-gray-500">/ {limit.max}</span>
            {level === 'breach' && <AlertTriangle size={12} className="text-red-600" />}
            {level === 'safe' && <CheckCircle size={12} className="text-green-600" />}
          </div>
        </div>
        <div className="risk-meter">
          <div 
            className={`risk-meter-fill ${getRiskColor(level)}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Risk Metrics</h3>
      
      {/* Primary Greeks with Meters */}
      <div className="space-y-3">
        <RiskMeter label="Delta (Δ)" value={currentGreeks.delta} limit={riskLimits.delta} />
        <RiskMeter label="Gamma (Γ)" value={currentGreeks.gamma} limit={riskLimits.gamma} />
        <RiskMeter label="Vega (ν)" value={currentGreeks.vega} limit={riskLimits.vega} />
        <RiskMeter label="Theta (Θ)" value={currentGreeks.theta} limit={riskLimits.theta} />
      </div>

      {/* VaR */}
      <div className="pt-3 border-t border-gray-200">
        <RiskMeter label="VaR (95%)" value={currentGreeks.var} limit={riskLimits.var} />
      </div>

      {/* Second-Order Greeks */}
      <div className="pt-3 border-t border-gray-200">
        <h4 className="text-xs font-medium text-gray-600 mb-2">Second-Order Greeks</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-500">Vanna:</span>
            <span className="ml-2 font-medium">{currentGreeks.vanna.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Vomma:</span>
            <span className="ml-2 font-medium">{currentGreeks.vomma.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Breach Events */}
      <div className="pt-3 border-t border-gray-200">
        <h4 className="text-xs font-medium text-gray-600 mb-2">Active Breaches</h4>
        {getRiskLevel(currentGreeks.delta, riskLimits.delta) === 'breach' ||
         getRiskLevel(currentGreeks.var, riskLimits.var) === 'warning' ? (
          <div className="space-y-1">
            {getRiskLevel(currentGreeks.delta, riskLimits.delta) === 'breach' && (
              <div className="text-xs p-2 bg-red-50 border border-red-200 rounded flex items-center gap-2">
                <AlertTriangle size={12} className="text-red-600" />
                <span className="text-red-700">Delta limit breach: {currentGreeks.delta.toFixed(1)} / {riskLimits.delta.max}</span>
              </div>
            )}
            {getRiskLevel(currentGreeks.var, riskLimits.var) === 'warning' && (
              <div className="text-xs p-2 bg-amber-50 border border-amber-200 rounded flex items-center gap-2">
                <AlertTriangle size={12} className="text-amber-600" />
                <span className="text-amber-700">VaR approaching limit: ${currentGreeks.var.toFixed(0)} / ${riskLimits.var.max}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-500">No active breaches</div>
        )}
      </div>
    </div>
  );
}
