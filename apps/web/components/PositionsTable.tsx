'use client';

import React from 'react';
import { cn, cardStyles, tableStyles, badgeStyles, formatCurrency, formatNumber } from '../lib/utils';
import { TrendingUp, TrendingDown, Package, DollarSign, AlertTriangle } from 'lucide-react';

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

  const totalUnrealized = activePositions.reduce((sum, p) => sum + calculateUnrealizedPnL(p), 0);
  const totalRealized = activePositions.reduce((sum, p) => sum + p.realized_pnl, 0);
  const totalPnL = totalUnrealized + totalRealized;

  if (activePositions.length === 0) {
    return (
      <div className={cardStyles.base}>
        <div className={cardStyles.header}>
          <h3 className="text-h4 font-serif font-bold text-foreground">
            Positions
          </h3>
        </div>
        <div className={cn(cardStyles.content, "text-center py-12")}>
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No open positions</p>
          <p className="text-caption text-muted-foreground mt-2">
            Submit an order to start trading
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cardStyles.base}>
      <div className={cardStyles.header}>
        <div className="flex items-center justify-between">
          <h3 className="text-h4 font-serif font-bold text-foreground">
            Open Positions
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-caption text-muted-foreground">Total P&L</div>
              <div className={cn(
                "text-body font-bold",
                totalPnL >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatCurrency(totalPnL)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className={tableStyles.table}>
          <thead className={tableStyles.header}>
            <tr className={tableStyles.headerRow}>
              <th className={cn(tableStyles.headerCell, "text-left")}>Symbol</th>
              <th className={cn(tableStyles.headerCell, "text-left")}>Type</th>
              <th className={cn(tableStyles.headerCell, "text-right")}>Position</th>
              <th className={cn(tableStyles.headerCell, "text-right")}>Avg Price</th>
              <th className={cn(tableStyles.headerCell, "text-right")}>Current</th>
              <th className={cn(tableStyles.headerCell, "text-right")}>Unrealized</th>
              <th className={cn(tableStyles.headerCell, "text-right")}>Realized</th>
              <th className={cn(tableStyles.headerCell, "text-right")}>Total</th>
            </tr>
          </thead>
          <tbody className={tableStyles.body}>
            {activePositions.map((position, index) => {
              const unrealizedPnL = calculateUnrealizedPnL(position);
              const currentTick = currentPrices?.find(t => t.symbol === position.symbol);
              const currentPrice = currentTick?.mid || 0;
              const positionTotal = unrealizedPnL + position.realized_pnl;
              const priceChange = currentPrice - position.avg_price;
              const priceChangePercent = (priceChange / position.avg_price) * 100;
              
              return (
                <tr
                  key={index}
                  className={cn(tableStyles.row, "group")}
                >
                  <td className={cn(tableStyles.cell, "font-medium")}>
                    <div className="flex items-center gap-2">
                      {position.symbol}
                      {position.expiry && (
                        <span className="text-caption text-muted-foreground">
                          {position.expiry}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={tableStyles.cell}>
                    <div className="flex items-center gap-2">
                      {position.opt_type ? (
                        <span className={cn(
                          badgeStyles.base,
                          position.opt_type === 'C' 
                            ? badgeStyles.variants.success 
                            : badgeStyles.variants.destructive
                        )}>
                          {position.opt_type === 'C' ? 'CALL' : 'PUT'}
                        </span>
                      ) : (
                        <span className={cn(badgeStyles.base, badgeStyles.variants.secondary)}>
                          FUTURE
                        </span>
                      )}
                      {position.strike && (
                        <span className="text-small font-mono text-muted-foreground">
                          @{position.strike}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={cn(tableStyles.cell, "text-right")}>
                    <div className={cn(
                      "inline-flex items-center gap-1 font-bold",
                      position.net_qty > 0 ? "text-success" : "text-destructive"
                    )}>
                      {position.net_qty > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span className="font-mono">
                        {position.net_qty > 0 ? '+' : ''}{position.net_qty}
                      </span>
                    </div>
                  </td>
                  <td className={cn(tableStyles.cell, "text-right font-mono")}>
                    {formatCurrency(position.avg_price)}
                  </td>
                  <td className={cn(tableStyles.cell, "text-right")}>
                    <div>
                      <div className="font-mono">{formatCurrency(currentPrice)}</div>
                      <div className={cn(
                        "text-caption",
                        priceChange >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {priceChange >= 0 ? '+' : ''}{formatCurrency(priceChange)}
                        ({formatNumber(priceChangePercent, 1)}%)
                      </div>
                    </div>
                  </td>
                  <td className={cn(
                    tableStyles.cell,
                    "text-right font-mono font-medium",
                    unrealizedPnL >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(unrealizedPnL)}
                  </td>
                  <td className={cn(
                    tableStyles.cell,
                    "text-right font-mono",
                    position.realized_pnl >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(position.realized_pnl)}
                  </td>
                  <td className={cn(
                    tableStyles.cell,
                    "text-right font-mono font-bold",
                    positionTotal >= 0 ? "text-success" : "text-destructive"
                  )}>
                    <div className="flex items-center justify-end gap-1">
                      {formatCurrency(positionTotal)}
                      {Math.abs(positionTotal) > 10000 && (
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/50 border-t-2 border-border">
            <tr>
              <td colSpan={5} className="py-3 px-4 text-right font-serif font-bold">
                Portfolio Totals:
              </td>
              <td className={cn(
                "py-3 px-4 text-right font-mono font-bold",
                totalUnrealized >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatCurrency(totalUnrealized)}
              </td>
              <td className={cn(
                "py-3 px-4 text-right font-mono font-bold",
                totalRealized >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatCurrency(totalRealized)}
              </td>
              <td className={cn(
                "py-3 px-4 text-right font-mono font-bold text-lg",
                totalPnL >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
              )}>
                <div className="flex items-center justify-end gap-2">
                  <DollarSign className="h-4 w-4" />
                  {formatCurrency(totalPnL)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}