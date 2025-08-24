const SQRT_2PI = Math.sqrt(2 * Math.PI);

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

export function erf(x: number): number {
  // Abramowitz-Stegun approximation
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.5 * ax);
  const tau = t * Math.exp(
    -ax * ax -
      1.26551223 +
      1.00002368 * t +
      0.37409196 * t * t +
      0.09678418 * Math.pow(t, 3) -
      0.18628806 * Math.pow(t, 4) +
      0.27886807 * Math.pow(t, 5) -
      1.13520398 * Math.pow(t, 6) +
      1.48851587 * Math.pow(t, 7) -
      0.82215223 * Math.pow(t, 8) +
      0.17087277 * Math.pow(t, 9)
  );
  return sign * (1 - tau);
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}