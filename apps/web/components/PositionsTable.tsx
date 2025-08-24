'use client';

interface Position {
  participant_id: string;
  symbol: string;
  expiry?: string;
  strike?: number;
  opt_type?: string;
  net_qty: number;
  avg_price: number;
  realized_pnl: number;
}

interface PositionsTableProps {
  positions: Position[];
  currentPrices: any[];
}

export default function PositionsTable({ positions, currentPrices }: PositionsTableProps) {
  const calculateUnrealizedPnL = (position: Position) => {
    const currentTick = currentPrices?.find(t => t.symbol === position.symbol);
    if (!currentTick) return 0;
    
    const currentPrice = currentTick.mid;
    const unrealizedPnL = position.net_qty * (currentPrice - position.avg_price) * 1000; // 1000 bbl per contract
    return unrealizedPnL;
  };

  const activePositions = positions?.filter(p => p.net_qty !== 0) || [];

  if (activePositions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No open positions
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr className="text-xs text-gray-600 dark:text-gray-400">
            <th className="py-2 px-3 text-left">Symbol</th>
            <th className="py-2 px-3 text-left">Type</th>
            <th className="py-2 px-3 text-right">Qty</th>
            <th className="py-2 px-3 text-right">Avg Price</th>
            <th className="py-2 px-3 text-right">Current</th>
            <th className="py-2 px-3 text-right">Unrealized PnL</th>
            <th className="py-2 px-3 text-right">Realized PnL</th>
          </tr>
        </thead>
        <tbody>
          {activePositions.map((position, index) => {
            const unrealizedPnL = calculateUnrealizedPnL(position);
            const currentTick = currentPrices?.find(t => t.symbol === position.symbol);
            const currentPrice = currentTick?.mid || 0;
            
            return (
              <tr
                key={index}
                className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="py-2 px-3 font-medium">
                  {position.symbol}
                </td>
                <td className="py-2 px-3">
                  {position.opt_type ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      position.opt_type === 'C' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {position.opt_type === 'C' ? 'CALL' : 'PUT'}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      FUTURE
                    </span>
                  )}
                  {position.strike && (
                    <span className="ml-2 text-xs text-gray-500">
                      {position.strike}
                    </span>
                  )}
                </td>
                <td className={`py-2 px-3 text-right mono-num font-medium ${
                  position.net_qty > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {position.net_qty > 0 ? '+' : ''}{position.net_qty}
                </td>
                <td className="py-2 px-3 text-right mono-num">
                  ${position.avg_price.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right mono-num">
                  ${currentPrice.toFixed(2)}
                </td>
                <td className={`py-2 px-3 text-right mono-num font-medium ${
                  unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${unrealizedPnL.toFixed(2)}
                </td>
                <td className={`py-2 px-3 text-right mono-num ${
                  position.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${position.realized_pnl.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
          <tr>
            <td colSpan={5} className="py-2 px-3 text-right">
              Total:
            </td>
            <td className={`py-2 px-3 text-right mono-num ${
              activePositions.reduce((sum, p) => sum + calculateUnrealizedPnL(p), 0) >= 0
                ? 'text-green-600' : 'text-red-600'
            }`}>
              ${activePositions.reduce((sum, p) => sum + calculateUnrealizedPnL(p), 0).toFixed(2)}
            </td>
            <td className={`py-2 px-3 text-right mono-num ${
              activePositions.reduce((sum, p) => sum + p.realized_pnl, 0) >= 0
                ? 'text-green-600' : 'text-red-600'
            }`}>
              ${activePositions.reduce((sum, p) => sum + p.realized_pnl, 0).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
