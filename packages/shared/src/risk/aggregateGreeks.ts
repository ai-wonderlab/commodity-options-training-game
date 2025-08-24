// Portfolio Greeks Aggregation
// Aggregates individual option Greeks to portfolio level

import { Black76 } from '../black76';

export interface OptionPosition {
  strike: number;
  expiry: Date;
  optType: 'C' | 'P';
  quantity: number; // positive for long, negative for short
  contractMultiplier: number; // Usually 1000 bbl for Brent
}

export interface PortfolioGreeks {
  delta: number; // Portfolio Delta
  gamma: number; // Portfolio Gamma  
  vega: number; // Portfolio Vega
  theta: number; // Portfolio Theta (computed via finite difference)
  vanna?: number; // dDelta/dVol (read-only)
  vomma?: number; // dVega/dVol (read-only)
  timestamp: Date;
}

export interface GreekCalculationInputs {
  futuresPrice: number;
  riskFreeRate: number;
  positions: OptionPosition[];
  ivMap: Map<string, number>; // key: "strike_expiry_type" -> IV
}

/**
 * Calculate portfolio-level Greeks by aggregating individual option Greeks
 */
export function aggregateGreeks(inputs: GreekCalculationInputs): PortfolioGreeks {
  const { futuresPrice, riskFreeRate, positions, ivMap } = inputs;
  
  let totalDelta = 0;
  let totalGamma = 0;
  let totalVega = 0;
  let totalTheta = 0;
  let totalVanna = 0;
  let totalVomma = 0;

  // Calculate Greeks for each position
  for (const position of positions) {
    const { strike, expiry, optType, quantity, contractMultiplier } = position;
    
    // Get implied volatility for this option
    const ivKey = `${strike}_${expiry.toISOString()}_${optType}`;
    const iv = ivMap.get(ivKey) || 0.25; // Default to 25% if not found
    
    // Calculate time to expiry in years
    const now = new Date();
    const timeToExpiry = Math.max(
      (expiry.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000),
      1 / 365 // Minimum 1 day
    );

    // Calculate individual Greeks using Black-76
    const black76 = new Black76(
      futuresPrice,
      strike,
      riskFreeRate,
      timeToExpiry,
      iv,
      optType
    );

    const greeks = black76.getGreeks();
    
    // Aggregate with position size and contract multiplier
    const positionMultiplier = quantity * contractMultiplier;
    
    totalDelta += greeks.delta * positionMultiplier;
    totalGamma += greeks.gamma * positionMultiplier;
    totalVega += greeks.vega * positionMultiplier;
    
    // For Vanna and Vomma (if available)
    if (greeks.vanna !== undefined) {
      totalVanna += greeks.vanna * positionMultiplier;
    }
    if (greeks.vomma !== undefined) {
      totalVomma += greeks.vomma * positionMultiplier;
    }
  }

  // Calculate Theta using finite difference method
  totalTheta = calculatePortfolioTheta(inputs);

  return {
    delta: Number(totalDelta.toFixed(2)),
    gamma: Number(totalGamma.toFixed(4)),
    vega: Number(totalVega.toFixed(2)),
    theta: Number(totalTheta.toFixed(2)),
    vanna: Number(totalVanna.toFixed(4)),
    vomma: Number(totalVomma.toFixed(4)),
    timestamp: new Date()
  };
}

/**
 * Calculate portfolio Theta using finite difference method
 * Theta = -(V(t+dt) - V(t)) / dt
 */
function calculatePortfolioTheta(inputs: GreekCalculationInputs): number {
  const dt = 1 / 365; // One day forward
  const { futuresPrice, riskFreeRate, positions, ivMap } = inputs;
  
  // Calculate current portfolio value
  const currentValue = calculatePortfolioValue(
    futuresPrice,
    riskFreeRate,
    positions,
    ivMap,
    0 // No time shift
  );
  
  // Calculate portfolio value one day forward
  const futureValue = calculatePortfolioValue(
    futuresPrice,
    riskFreeRate,
    positions,
    ivMap,
    dt // One day forward
  );
  
  // Theta is the negative of the time decay
  const theta = -(futureValue - currentValue) / dt;
  
  return theta;
}

/**
 * Calculate total portfolio value
 */
function calculatePortfolioValue(
  futuresPrice: number,
  riskFreeRate: number,
  positions: OptionPosition[],
  ivMap: Map<string, number>,
  timeShift: number = 0
): number {
  let totalValue = 0;
  
  for (const position of positions) {
    const { strike, expiry, optType, quantity, contractMultiplier } = position;
    
    // Get implied volatility
    const ivKey = `${strike}_${expiry.toISOString()}_${optType}`;
    const iv = ivMap.get(ivKey) || 0.25;
    
    // Calculate time to expiry with shift
    const now = new Date();
    const timeToExpiry = Math.max(
      (expiry.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000) - timeShift,
      0 // Can't go negative
    );
    
    if (timeToExpiry > 0) {
      // Calculate option value using Black-76
      const black76 = new Black76(
        futuresPrice,
        strike,
        riskFreeRate,
        timeToExpiry,
        iv,
        optType
      );
      
      const optionValue = black76.price();
      totalValue += optionValue * quantity * contractMultiplier;
    } else {
      // Option has expired, use intrinsic value
      const intrinsicValue = optType === 'C' 
        ? Math.max(0, futuresPrice - strike)
        : Math.max(0, strike - futuresPrice);
      totalValue += intrinsicValue * quantity * contractMultiplier;
    }
  }
  
  return totalValue;
}

/**
 * Check if any Greek exceeds its limit
 */
export interface RiskLimits {
  deltaCap: number;
  gammaCap: number;
  vegaCap: number;
  thetaCap: number;
}

export interface BreachResult {
  isBreached: boolean;
  breaches: {
    delta?: { value: number; limit: number; };
    gamma?: { value: number; limit: number; };
    vega?: { value: number; limit: number; };
    theta?: { value: number; limit: number; };
  };
}

export function checkGreekLimits(
  greeks: PortfolioGreeks,
  limits: RiskLimits
): BreachResult {
  const breaches: BreachResult['breaches'] = {};
  let isBreached = false;

  // Check each Greek against its limit
  if (Math.abs(greeks.delta) > limits.deltaCap) {
    breaches.delta = { value: greeks.delta, limit: limits.deltaCap };
    isBreached = true;
  }
  
  if (Math.abs(greeks.gamma) > limits.gammaCap) {
    breaches.gamma = { value: greeks.gamma, limit: limits.gammaCap };
    isBreached = true;
  }
  
  if (Math.abs(greeks.vega) > limits.vegaCap) {
    breaches.vega = { value: greeks.vega, limit: limits.vegaCap };
    isBreached = true;
  }
  
  if (Math.abs(greeks.theta) > limits.thetaCap) {
    breaches.theta = { value: greeks.theta, limit: limits.thetaCap };
    isBreached = true;
  }

  return { isBreached, breaches };
}

/**
 * Calculate Greeks for a proposed trade (pre-trade check)
 */
export function calculateProposedGreeks(
  currentInputs: GreekCalculationInputs,
  proposedPosition: OptionPosition
): PortfolioGreeks {
  // Add proposed position to current positions
  const newPositions = [...currentInputs.positions, proposedPosition];
  
  return aggregateGreeks({
    ...currentInputs,
    positions: newPositions
  });
}

/**
 * Format Greeks for display
 */
export function formatGreeks(greeks: PortfolioGreeks): Record<string, string> {
  return {
    'Δ (Delta)': greeks.delta.toFixed(0),
    'Γ (Gamma)': greeks.gamma.toFixed(2),
    'V (Vega)': greeks.vega.toFixed(0),
    'Θ (Theta)': greeks.theta.toFixed(0),
    'Vanna': greeks.vanna?.toFixed(2) || 'N/A',
    'Vomma': greeks.vomma?.toFixed(2) || 'N/A'
  };
}
