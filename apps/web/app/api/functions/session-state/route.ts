import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id') || searchParams.get('sessionId');
  
  // Mock instruments data - multiple expiries and strikes
  const expiries = ['JAN25', 'FEB25', 'MAR25'];
  const strikes = [70, 75, 80, 85, 90, 95, 100, 105, 110];
  const instruments: any[] = [];
  
  expiries.forEach(expiry => {
    strikes.forEach(strike => {
      instruments.push(
        { symbol: `BUL-${expiry}-C-${strike}`, type: 'CALL', strike, expiry },
        { symbol: `BUL-${expiry}-P-${strike}`, type: 'PUT', strike, expiry }
      );
    });
  });

  // Mock ticks data
  const spotPrice = 82.50;
  const ticksLatest: any = {
    'BRN': { bid: spotPrice - 0.05, ask: spotPrice + 0.05, mid: spotPrice, last: spotPrice - 0.02 },
  };
  
  // Generate option prices using simple Black-Scholes approximation
  instruments.forEach(inst => {
    const moneyness = inst.strike / spotPrice;
    const timeToExpiry = inst.expiry === 'JAN25' ? 0.083 : inst.expiry === 'FEB25' ? 0.167 : 0.250;
    const iv = 0.30 + (Math.abs(1 - moneyness) * 0.10); // Smile
    
    let price = 0;
    if (inst.type === 'CALL') {
      // Simplified pricing for calls
      const intrinsic = Math.max(0, spotPrice - inst.strike);
      const timeValue = spotPrice * iv * Math.sqrt(timeToExpiry) * 0.4;
      price = intrinsic + timeValue;
    } else {
      // Simplified pricing for puts
      const intrinsic = Math.max(0, inst.strike - spotPrice);
      const timeValue = spotPrice * iv * Math.sqrt(timeToExpiry) * 0.4;
      price = intrinsic + timeValue;
    }
    
    price = Math.max(0.05, Math.round(price * 100) / 100);
    ticksLatest[inst.symbol] = {
      bid: price - 0.05,
      ask: price + 0.05,
      mid: price,
      iv: Math.round(iv * 1000) / 1000,
    };
  });
  
  // Mock session state
  return NextResponse.json({
    session: {
      id: sessionId,
      status: 'active',
      instruments,
      participants: [
        { id: '1', name: 'Player 1', pnl: 1250.50, rank: 1 },
        { id: '2', name: 'Player 2', pnl: 850.25, rank: 2 },
        { id: '3', name: 'Player 3', pnl: -150.00, rank: 3 },
      ],
    },
    ticksLatest,
    positions: [],
    orders: [],
    greeks: {
      delta: 0,
      gamma: 0,
      vega: 0,
      theta: 0,
      vanna: 0,
      vomma: 0,
    },
    pnl: {
      realized: 0,
      unrealized: 0,
      total: 0,
    },
    current_time: new Date().toISOString(),
  });
}
