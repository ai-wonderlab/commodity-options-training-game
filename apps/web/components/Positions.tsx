'use client';

interface Position {
  id: string;
  symbol: string;
  expiry?: string;
  strike?: number;
  optType?: 'C' | 'P';
  netQty: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

interface PositionsProps {
  positions: Position[];
}

export function Positions({ positions = [] }: PositionsProps) {
  // Mock data for demonstration
  const mockPositions: Position[] = [
    {
      id: '1',
      symbol: 'BRN',
      netQty: 10,
      avgPrice: 82.30,
      currentPrice: 82.45,
      pnl: 150
    },
    {
      id: '2',
      symbol: 'BUL',
      expiry: '2024-03-15',
      strike: 85,
      optType: 'C',
      netQty: -5,
      avgPrice: 1.25,
      currentPrice: 1.15,
      pnl: 50
    },
    {
      id: '3',
      symbol: 'BUL',
      expiry: '2024-03-15',
      strike: 80,
      optType: 'P',
      netQty: 3,
      avgPrice: 0.85,
      currentPrice: 0.95,
      pnl: 30
    }
  ];

  const displayPositions = positions.length > 0 ? positions : mockPositions;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Open Positions</h3>
      
      {displayPositions.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-8">
          No open positions
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-600">
                <th className="text-left py-2">Symbol</th>
                <th className="text-left py-2">Qty</th>
                <th className="text-left py-2">Avg Price</th>
                <th className="text-left py-2">Current</th>
                <th className="text-left py-2">P&L</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayPositions.map((position) => (
                <tr key={position.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2">
                    <div>
                      <span className="font-medium">
                        {position.symbol}
                        {position.optType && (
                          <span className="ml-1 text-xs">
                            {position.strike} {position.optType}
                          </span>
                        )}
                      </span>
                      {position.expiry && (
                        <div className="text-xs text-gray-500">{position.expiry}</div>
                      )}
                    </div>
                  </td>
                  <td className={`py-2 font-medium ${position.netQty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {position.netQty > 0 ? '+' : ''}{position.netQty}
                  </td>
                  <td className="py-2">${position.avgPrice.toFixed(2)}</td>
                  <td className="py-2">${position.currentPrice.toFixed(2)}</td>
                  <td className={`py-2 font-medium ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                  </td>
                  <td className="py-2">
                    <button className="text-xs text-blue-600 hover:text-blue-700">
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td colSpan={4} className="py-2 text-right">Total P&L:</td>
                <td className="py-2 text-green-600">
                  +${displayPositions.reduce((sum, p) => sum + p.pnl, 0).toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
