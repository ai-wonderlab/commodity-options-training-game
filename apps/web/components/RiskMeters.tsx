'use client';

import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  Shield,
  Gauge,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { cn, cardStyles, formatCurrency, formatNumber } from '../lib/utils';

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

// Custom Gauge Component
function RiskGauge({ 
  value, 
  limit, 
  label, 
  description, 
  unit = '',
  isNegative = false 
}: {
  value: number;
  limit: number;
  label: string;
  description: string;
  unit?: string;
  isNegative?: boolean;
}) {
  const percentage = isNegative
    ? Math.abs((value / limit) * 100)
    : Math.abs((value / Math.abs(limit)) * 100);
  
  const getRiskLevel = () => {
    if (percentage < 60) return 'safe';
    if (percentage < 80) return 'warning';
    return 'breach';
  };

  const level = getRiskLevel();
  
  const getColors = () => {
    switch (level) {
      case 'safe': 
        return {
          bg: 'bg-success/20',
          fill: 'bg-success',
          text: 'text-success',
          icon: <CheckCircle className="h-4 w-4" />,
          pulse: false
        };
      case 'warning': 
        return {
          bg: 'bg-warning/20',
          fill: 'bg-warning',
          text: 'text-warning',
          icon: <AlertTriangle className="h-4 w-4" />,
          pulse: false
        };
      case 'breach': 
        return {
          bg: 'bg-destructive/20',
          fill: 'bg-destructive',
          text: 'text-destructive',
          icon: <XCircle className="h-4 w-4" />,
          pulse: true
        };
      default: 
        return {
          bg: 'bg-muted',
          fill: 'bg-muted-foreground',
          text: 'text-muted-foreground',
          icon: null,
          pulse: false
        };
    }
  };

  const colors = getColors();
  const displayPercentage = Math.min(percentage, 100);
  
  // Calculate gauge arc
  const radius = 60;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all duration-300",
      colors.bg,
      level === 'breach' && "ring-2 ring-destructive/20 animate-pulse-subtle"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-serif font-bold text-foreground">{label}</h4>
            <div className={colors.text}>{colors.icon}</div>
          </div>
          <p className="text-caption text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="text-right">
          <div className={cn("text-h4 font-bold font-mono", colors.text)}>
            {unit}{formatNumber(Math.abs(value), 0)}
          </div>
          <div className="text-caption text-muted-foreground">
            Limit: {unit}{formatNumber(Math.abs(limit), 0)}
          </div>
        </div>
      </div>

      {/* Circular Gauge */}
      <div className="relative flex justify-center">
        <svg height={radius * 2} width={radius * 2}>
          {/* Background circle */}
          <circle
            stroke="currentColor"
            className="text-muted"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(-90 ${radius} ${radius})`}
          />
          {/* Progress circle */}
          <circle
            stroke="currentColor"
            className={cn(colors.text, "transition-all duration-500")}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(-90 ${radius} ${radius})`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={cn("text-2xl font-bold", colors.text)}>
              {displayPercentage.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">
              Utilized
            </div>
          </div>
        </div>
      </div>

      {/* Linear Progress Bar */}
      <div className="mt-4">
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "absolute left-0 top-0 h-full transition-all duration-500",
              colors.fill,
              colors.pulse && "animate-pulse"
            )}
            style={{ width: `${displayPercentage}%` }}
          />
          {/* Threshold markers */}
          <div className="absolute top-0 h-full w-px bg-warning" style={{ left: '60%' }} />
          <div className="absolute top-0 h-full w-px bg-destructive" style={{ left: '80%' }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0%</span>
          <span>60%</span>
          <span>80%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

export default function RiskMeters({ participantId, limits }: RiskMetersProps) {
  const [greeks, setGreeks] = useState<Greeks>({
    delta: 0,
    gamma: 0,
    vega: 0,
    theta: 0,
    var_estimate: 0,
  });

  const [breachHistory, setBreachHistory] = useState<any[]>([]);

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

  const totalBreaches = breachHistory.length;
  const activeBreaches = breachHistory.filter(b => !b.resolved).length;

  return (
    <div className="space-y-4">
      {/* Main Risk Dashboard */}
      <div className={cardStyles.base}>
        <div className={cardStyles.header}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gauge className="h-6 w-6 text-primary" />
              <h3 className="text-h4 font-serif font-bold text-foreground">
                Risk Dashboard
              </h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className={cn(
                  "h-5 w-5",
                  activeBreaches > 0 ? "text-destructive animate-pulse" : "text-success"
                )} />
                <span className="text-small font-medium">
                  {activeBreaches > 0 ? `${activeBreaches} Active Breaches` : 'All Clear'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={cardStyles.content}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RiskGauge
              value={greeks.delta}
              limit={limits?.delta || 1000}
              label="Delta (Δ)"
              description="Price sensitivity - change per $1 move"
              unit="$"
            />
            
            <RiskGauge
              value={greeks.gamma}
              limit={limits?.gamma || 100}
              label="Gamma (Γ)"
              description="Delta change rate - convexity risk"
            />
            
            <RiskGauge
              value={greeks.vega}
              limit={limits?.vega || 500}
              label="Vega (ν)"
              description="Volatility sensitivity - per 1% vol change"
              unit="$"
            />
            
            <RiskGauge
              value={greeks.theta}
              limit={limits?.theta || -200}
              label="Theta (Θ)"
              description="Time decay - daily P&L from time"
              unit="$"
              isNegative={true}
            />
          </div>

          {/* VaR Special Display */}
          <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-serif font-bold text-foreground flex items-center gap-2">
                  Value at Risk (95% 1-day)
                  <Info className="h-4 w-4 text-muted-foreground" />
                </h4>
                <p className="text-caption text-muted-foreground mt-1">
                  Maximum expected loss in 95% of scenarios
                </p>
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-h3 font-bold font-mono",
                  greeks.var_estimate > (limits?.var || 5000) ? "text-destructive" : "text-primary"
                )}>
                  {formatCurrency(greeks.var_estimate)}
                </div>
                <div className="text-small text-muted-foreground">
                  Limit: {formatCurrency(limits?.var || 5000)}
                </div>
              </div>
            </div>

            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "absolute left-0 top-0 h-full transition-all duration-500",
                  greeks.var_estimate > (limits?.var || 5000) 
                    ? "bg-destructive animate-pulse" 
                    : "bg-primary"
                )}
                style={{ 
                  width: `${Math.min((greeks.var_estimate / (limits?.var || 5000)) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Risk Policy Information */}
      <div className={cn(
        cardStyles.base,
        "bg-warning/5 border-warning/20"
      )}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div className="flex-1">
              <h4 className="font-serif font-bold text-foreground">
                Risk Management Policy
              </h4>
              <p className="text-small text-muted-foreground mt-2">
                Breaches are allowed but penalized in your final score:
              </p>
              <div className="mt-3 p-3 rounded-md bg-background/50 border border-border">
                <code className="text-small text-foreground">
                  Score = PnL - (breach_time × α + var_exceed × β)
                </code>
              </div>
              <ul className="mt-3 space-y-1 text-small text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span>Greeks limits: Monitor Delta, Gamma, Vega, Theta exposure</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span>VaR limit: 95% confidence daily loss threshold</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span>Penalties increase with breach duration and magnitude</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}