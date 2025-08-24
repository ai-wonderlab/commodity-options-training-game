// Value at Risk (VaR) Calculation
// Implements 95% VaR using scenario grid methodology

import { Black76 } from '../black76';
import { OptionPosition } from './aggregateGreeks';

export interface VaRInputs {
  futuresPrice: number;
  riskFreeRate: number;
  positions: OptionPosition[];
  ivMap: Map<string, number>; // key: "strike_expiry_type" -> IV
  priceVolatility: number; // Daily price volatility (for scenario generation)
  ivShockSize: number; // IV shock size in absolute terms (e.g., 0.05 for 5%)
}

export interface VaRResult {
  var95: number; // 95% VaR (5th percentile of P&L distribution)
  scenarios: ScenarioResult[]; // All scenario outcomes
  currentValue: number; // Current portfolio value
  worstCase: number; // Worst case scenario P&L
  bestCase: number; // Best case scenario P&L
  timestamp: Date;
}

export interface ScenarioResult {
  priceDelta: number; // Price change in %
  ivDelta: number; // IV change in absolute terms
  portfolioValue: number;
  pnl: number; // P&L vs current
}

/**
 * Calculate 95% Value at Risk using scenario grid
 * Grid: dF/F ∈ {-2σ, -1σ, 0, +1σ, +2σ} × dIV ∈ {-X, 0, +X}
 */
export function calculateVaR(inputs: VaRInputs): VaRResult {
  const { 
    futuresPrice, 
    riskFreeRate, 
    positions, 
    ivMap,
    priceVolatility,
    ivShockSize 
  } = inputs;
  
  // Calculate current portfolio value
  const currentValue = calculatePortfolioValue(
    futuresPrice,
    riskFreeRate,
    positions,
    ivMap
  );

  // Define scenario grid
  const priceShocks = [-2, -1, 0, 1, 2].map(sigma => sigma * priceVolatility);
  const ivShocks = [-ivShockSize, 0, ivShockSize];
  
  const scenarios: ScenarioResult[] = [];
  
  // Run all scenarios
  for (const priceShock of priceShocks) {
    for (const ivShock of ivShocks) {
      // Calculate shocked price
      const shockedPrice = futuresPrice * (1 + priceShock);
      
      // Create shocked IV map
      const shockedIvMap = new Map<string, number>();
      for (const [key, baseIv] of ivMap) {
        const shockedIv = Math.max(0.01, baseIv + ivShock); // Ensure IV stays positive
        shockedIvMap.set(key, shockedIv);
      }
      
      // Calculate portfolio value under this scenario
      const scenarioValue = calculatePortfolioValue(
        shockedPrice,
        riskFreeRate,
        positions,
        shockedIvMap
      );
      
      const pnl = scenarioValue - currentValue;
      
      scenarios.push({
        priceDelta: priceShock,
        ivDelta: ivShock,
        portfolioValue: scenarioValue,
        pnl
      });
    }
  }
  
  // Sort scenarios by P&L (ascending)
  scenarios.sort((a, b) => a.pnl - b.pnl);
  
  // Calculate 5th percentile (95% VaR)
  const percentileIndex = Math.floor(scenarios.length * 0.05);
  const var95 = -scenarios[percentileIndex].pnl; // VaR is reported as positive number
  
  // Get worst and best cases
  const worstCase = scenarios[0].pnl;
  const bestCase = scenarios[scenarios.length - 1].pnl;
  
  return {
    var95: Number(var95.toFixed(2)),
    scenarios,
    currentValue: Number(currentValue.toFixed(2)),
    worstCase: Number(worstCase.toFixed(2)),
    bestCase: Number(bestCase.toFixed(2)),
    timestamp: new Date()
  };
}

/**
 * Calculate total portfolio value under given conditions
 */
function calculatePortfolioValue(
  futuresPrice: number,
  riskFreeRate: number,
  positions: OptionPosition[],
  ivMap: Map<string, number>
): number {
  let totalValue = 0;
  
  for (const position of positions) {
    const { strike, expiry, optType, quantity, contractMultiplier } = position;
    
    // Get implied volatility
    const ivKey = `${strike}_${expiry.toISOString()}_${optType}`;
    const iv = ivMap.get(ivKey) || 0.25;
    
    // Calculate time to expiry
    const now = new Date();
    const timeToExpiry = Math.max(
      (expiry.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000),
      1 / 365 // Minimum 1 day
    );
    
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
  }
  
  return totalValue;
}

/**
 * Calculate VaR for a proposed trade (pre-trade check)
 */
export function calculateProposedVaR(
  currentInputs: VaRInputs,
  proposedPosition: OptionPosition
): VaRResult {
  // Add proposed position to current positions
  const newPositions = [...currentInputs.positions, proposedPosition];
  
  return calculateVaR({
    ...currentInputs,
    positions: newPositions
  });
}

/**
 * Check if VaR exceeds limit
 */
export interface VaRLimit {
  varLimit: number; // Maximum allowed VaR
}

export interface VaRBreachResult {
  isBreached: boolean;
  currentVaR: number;
  limit: number;
  excessAmount?: number;
}

export function checkVaRLimit(
  varResult: VaRResult,
  limit: VaRLimit
): VaRBreachResult {
  const isBreached = varResult.var95 > limit.varLimit;
  
  return {
    isBreached,
    currentVaR: varResult.var95,
    limit: limit.varLimit,
    excessAmount: isBreached ? varResult.var95 - limit.varLimit : undefined
  };
}

/**
 * Calculate marginal VaR contribution of each position
 */
export interface MarginalVaR {
  position: OptionPosition;
  marginalVaR: number;
  percentContribution: number;
}

export function calculateMarginalVaR(inputs: VaRInputs): MarginalVaR[] {
  // Calculate base VaR with all positions
  const baseVaR = calculateVaR(inputs);
  
  const marginalResults: MarginalVaR[] = [];
  
  // Calculate VaR excluding each position
  for (let i = 0; i < inputs.positions.length; i++) {
    const positionsWithoutI = inputs.positions.filter((_, index) => index !== i);
    
    const varWithoutPosition = calculateVaR({
      ...inputs,
      positions: positionsWithoutI
    });
    
    const marginalVaR = baseVaR.var95 - varWithoutPosition.var95;
    const percentContribution = (marginalVaR / baseVaR.var95) * 100;
    
    marginalResults.push({
      position: inputs.positions[i],
      marginalVaR: Number(marginalVaR.toFixed(2)),
      percentContribution: Number(percentContribution.toFixed(1))
    });
  }
  
  return marginalResults;
}

/**
 * Generate VaR report for display
 */
export interface VaRReport {
  var95: string;
  confidence: string;
  timeHorizon: string;
  worstCase: string;
  bestCase: string;
  currentValue: string;
  numberOfScenarios: number;
}

export function generateVaRReport(varResult: VaRResult): VaRReport {
  return {
    var95: `$${varResult.var95.toLocaleString()}`,
    confidence: '95%',
    timeHorizon: '1 day',
    worstCase: `$${varResult.worstCase.toLocaleString()}`,
    bestCase: `$${varResult.bestCase.toLocaleString()}`,
    currentValue: `$${varResult.currentValue.toLocaleString()}`,
    numberOfScenarios: varResult.scenarios.length
  };
}

/**
 * Calculate stressed VaR (using higher volatility scenarios)
 */
export function calculateStressedVaR(inputs: VaRInputs): VaRResult {
  // Use 2x volatility for stressed scenarios
  const stressedInputs = {
    ...inputs,
    priceVolatility: inputs.priceVolatility * 2,
    ivShockSize: inputs.ivShockSize * 2
  };
  
  return calculateVaR(stressedInputs);
}
