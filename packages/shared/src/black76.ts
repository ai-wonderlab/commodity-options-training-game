import { normalPdf, normalCdf } from './math';

export type OptionType = 'C' | 'P';

export interface PriceInput {
  F: number; // futures price
  K: number; // strike
  T: number; // time to expiry in years
  sigma: number; // volatility (decimal)
  r: number; // risk-free rate (decimal)
  cp: OptionType; // 'C' or 'P'
}

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number; // per year (calendar time); negative means decay
  vanna: number; // d2P/(dF dSigma)
  vomma: number; // d2P/(dSigma^2)
}

export function black76Price({ F, K, T, sigma, r, cp }: PriceInput): number {
  if (T <= 0 || sigma <= 0) {
    // Limit cases: intrinsic discounted
    const df = Math.exp(-r * Math.max(T, 0));
    const intrinsic = cp === 'C' ? Math.max(F - K, 0) : Math.max(K - F, 0);
    return df * intrinsic;
  }
  const volSqrtT = sigma * Math.sqrt(T);
  const logFK = Math.log(F / K);
  const d1 = (logFK + 0.5 * sigma * sigma * T) / volSqrtT;
  const d2 = d1 - volSqrtT;
  const df = Math.exp(-r * T);

  if (cp === 'C') {
    return df * (F * normalCdf(d1) - K * normalCdf(d2));
  } else {
    return df * (K * normalCdf(-d2) - F * normalCdf(-d1));
  }
}

export function black76Greeks(input: PriceInput): Greeks {
  const { F, K, T, sigma, r, cp } = input;
  const price = black76Price(input);

  if (T <= 0 || sigma <= 0 || F <= 0 || K <= 0) {
    return {
      price,
      delta: 0,
      gamma: 0,
      vega: 0,
      theta: 0,
      vanna: 0,
      vomma: 0,
    };
  }

  const volSqrtT = sigma * Math.sqrt(T);
  const logFK = Math.log(F / K);
  const d1 = (logFK + 0.5 * sigma * sigma * T) / volSqrtT;
  const d2 = d1 - volSqrtT;
  const df = Math.exp(-r * T);

  const phiD1 = normalPdf(d1);
  const nd1 = normalCdf(d1);
  const nMinusD1 = normalCdf(-d1);

  const delta = cp === 'C' ? df * nd1 : -df * nMinusD1;
  const gamma = (df * phiD1) / (F * volSqrtT);
  const vega = df * F * phiD1 * Math.sqrt(T);

  // Theta via centered finite difference on T (calendar time); Theta = -dP/dT
  const hT = Math.max(1e-5, Math.min(1e-3, 0.01 * T));
  const pPlusT = black76Price({ F, K, T: T + hT, sigma, r, cp });
  const pMinusT = black76Price({ F, K, T: Math.max(T - hT, 1e-8), sigma, r, cp });
  const theta = -((pPlusT - pMinusT) / (hT * 2));

  // Vanna via cross FD on F and sigma
  const hF = Math.max(1e-4, 1e-4 * F);
  const hS = Math.max(1e-4, 1e-4 * sigma);
  const p_pp = black76Price({ F: F + hF, K, T, sigma: sigma + hS, r, cp });
  const p_pm = black76Price({ F: F + hF, K, T, sigma: sigma - hS, r, cp });
  const p_mp = black76Price({ F: F - hF, K, T, sigma: sigma + hS, r, cp });
  const p_mm = black76Price({ F: F - hF, K, T, sigma: sigma - hS, r, cp });
  const vanna = (p_pp - p_pm - p_mp + p_mm) / (4 * hF * hS);

  // Vomma via second derivative in sigma
  const p_vs = black76Price({ F, K, T, sigma: sigma + hS, r, cp });
  const p_v0 = price;
  const p_vn = black76Price({ F, K, T, sigma: sigma - hS, r, cp });
  const vomma = (p_vs - 2 * p_v0 + p_vn) / (hS * hS);

  return { price, delta, gamma, vega, theta, vanna, vomma };
}