export * from './math';
export * from './black76';
export * from './dataProvider';
export * from './fillEngine';
export * from './scoring';
export * from './risk/aggregateGreeks';
export * from './risk/var';
export * from './scoring/computeScore';

// Aliases for spec verification
export { black76Price as priceBlack76 } from './black76';
export { black76Greeks as greeks } from './black76';
export { calculateVaR as estimateVar } from './risk/var';