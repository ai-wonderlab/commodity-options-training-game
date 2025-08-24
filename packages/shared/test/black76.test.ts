import { describe, it, expect } from 'vitest';
import { black76Price, black76Greeks } from '../src/black76';

function near(a: number, b: number, tolAbs = 1e-8, tolRel = 1e-6) {
  const diff = Math.abs(a - b);
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return diff <= tolAbs || diff / scale <= tolRel;
}

describe('Black-76 parity and greeks', () => {
  const F = 80;
  const K = 85;
  const T = 0.5;
  const sigma = 0.3;
  const r = 0.02;

  it('satisfies put-call parity: C - P = df*(F - K)', () => {
    const C = black76Price({ F, K, T, sigma, r, cp: 'C' });
    const P = black76Price({ F, K, T, sigma, r, cp: 'P' });
    const df = Math.exp(-r * T);
    expect(near(C - P, df * (F - K), 1e-8, 1e-7)).toBe(true);
  });

  it('delta matches FD derivative w.r.t F', () => {
    const g = black76Greeks({ F, K, T, sigma, r, cp: 'C' });
    const hF = 1e-3 * F;
    const pPlus = black76Price({ F: F + hF, K, T, sigma, r, cp: 'C' });
    const pMinus = black76Price({ F: F - hF, K, T, sigma, r, cp: 'C' });
    const dFd = (pPlus - pMinus) / (2 * hF);
    expect(near(g.delta, dFd, 1e-6, 1e-4)).toBe(true);
  });

  it('gamma matches FD second derivative w.r.t F', () => {
    const g = black76Greeks({ F, K, T, sigma, r, cp: 'P' });
    const hF = 1e-3 * F;
    const pPlus = black76Price({ F: F + hF, K, T, sigma, r, cp: 'P' });
    const p0 = black76Price({ F, K, T, sigma, r, cp: 'P' });
    const pMinus = black76Price({ F: F - hF, K, T, sigma, r, cp: 'P' });
    const gFD = (pPlus - 2 * p0 + pMinus) / (hF * hF);
    expect(near(g.gamma, gFD, 1e-6, 1e-3)).toBe(true);
  });

  it('vega matches FD derivative w.r.t sigma', () => {
    const g = black76Greeks({ F, K, T, sigma, r, cp: 'C' });
    const hS = 1e-4 * sigma;
    const pPlus = black76Price({ F, K, T, sigma: sigma + hS, r, cp: 'C' });
    const pMinus = black76Price({ F, K, T, sigma: sigma - hS, r, cp: 'C' });
    const vFD = (pPlus - pMinus) / (2 * hS);
    expect(near(g.vega, vFD, 1e-6, 1e-3)).toBe(true);
  });

  it('theta is finite and typically negative for OTM call', () => {
    const g = black76Greeks({ F: 70, K: 85, T, sigma, r, cp: 'C' });
    expect(Number.isFinite(g.theta)).toBe(true);
  });

  it('vanna and vomma are finite', () => {
    const g = black76Greeks({ F, K, T, sigma, r, cp: 'P' });
    expect(Number.isFinite(g.vanna)).toBe(true);
    expect(Number.isFinite(g.vomma)).toBe(true);
  });
});