'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FillEvent, TickEvent } from '../lib/realtime';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';

interface Position {
  id: string;
  participant_id: string;
  symbol: string;
  expiry?: string;
  strike?: number;
  opt_type?: 'C' | 'P';
  net_qty: number;
  avg_price: number;
  realized_pnl: number;
  updated_at: string;
}

interface EnrichedPosition extends Position {
  currentPrice: number;
  unrealizedPnL: number;
  totalPnL: number;
  priceChange: number;
  priceChangePercent: number;
  isUpdating?: boolean;
}

interface PositionsTableRealtimeProps {
  sessionId?: string;
  participantId?: string;
  initialPositions?: Position[];
  onPositionsUpdate?: (positions: EnrichedPosition[]) => void;
  realtimeEnabled?: boolean;
}

export default function PositionsTableRealtime({
  sessionId,
  participantId,
  initialPositions = [],
  onPositionsUpdate,
  realtimeEnabled = false
}: PositionsTableRealtimeProps) {
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({ BRN: 82.50 });
  const [enrichedPositions, setEnrichedPositions] = useState<EnrichedPosition[]>([]);
  const [updatingPositions, setUpdatingPositions] = useState<Set<string>>(new Set());
  
  const animationTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Handle fill events to update positions
  const handleFillEvent = async (fillEvent: FillEvent) => {
    if (fillEvent.participantId !== participantId) return;

    // Fetch updated positions from server
    try {
      const response = await fetch(`/api/positions/${sessionId}/${participantId}`);
      if (response.ok) {
        const updatedPositions = await response.json();
        setPositions(updatedPositions);
        
        // Animate the updated position
        const positionKey = `${fillEvent.symbol}_${fillEvent.side}`;
        triggerUpdateAnimation(positionKey);
      }
    } catch (error) {
      console.error('Failed to fetch updated positions:', error);
    }
  };

  // Handle tick events to update prices
  const handleTickEvent = (tickEvent: TickEvent) => {
    setCurrentPrices(prev => ({
      ...prev,
      [tickEvent.symbol]: tickEvent.price
    }));
  };

  // Set up realtime connection
  useEffect(() => {
    if (!realtimeEnabled || !sessionId || !participantId) return;

    let realtimeManager: any;
    
    const setupRealtime = async () => {
      const { realtimeManager: rtm } = await import('../lib/realtime');
      realtimeManager = rtm;
      
      await realtimeManager.connect(sessionId, participantId, {
        onFill: handleFillEvent,
        onTick: handleTickEvent
      });
    };

    setupRealtime();

    return () => {
      if (realtimeManager) {
        realtimeManager.disconnect();
      }
    };
  }, [sessionId, participantId, realtimeEnabled]);

  // Trigger animation for position updates
  const triggerUpdateAnimation = (positionKey: string) => {
    setUpdatingPositions(prev => new Set([...prev, positionKey]));
    
    // Clear existing timer
    if (animationTimers.current[positionKey]) {
      clearTimeout(animationTimers.current[positionKey]);
    }
    
    // Remove animation after 2 seconds
    animationTimers.current[positionKey] = setTimeout(() => {
      setUpdatingPositions(prev => {
        const newSet = new Set(prev);
        newSet.delete(positionKey);
        return newSet;
      });
    }, 2000);
  };

  // Calculate enriched positions with current prices
  useEffect(() => {
    const enriched = positions
      .filter(p => p.net_qty !== 0)
      .map(position => {
        const currentPrice = currentPrices[position.symbol] || position.avg_price;
        const priceDiff = currentPrice - position.avg_price;
        const unrealizedPnL = position.net_qty * priceDiff * 1000; // 1000 bbl per contract
        const totalPnL = position.realized_pnl + unrealizedPnL;
        const priceChange = currentPrice - position.avg_price;
        const priceChangePercent = position.avg_price > 0 
          ? (priceChange / position.avg_price) * 100 
          : 0;

        return {
          ...position,
          currentPrice,
          unrealizedPnL,
          totalPnL,
          priceChange,
          priceChangePercent
        };
      });

    setEnrichedPositions(enriched);
    
    if (onPositionsUpdate) {
      onPositionsUpdate(enriched);
    }
  }, [positions, currentPrices, onPositionsUpdate]);

  // Format currency
  const formatCurrency = (value: number) => {
    const prefix = value < 0 ? '-$' : '$';
    return prefix + Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Format percentage
  const formatPercent = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  };

  // Get position key for animations
  const getPositionKey = (position: Position) => {
    return position.opt_type 
      ? `${position.symbol}_${position.strike}_${position.opt_type}_${position.expiry}`
      : position.symbol;
  };

  if (enrichedPositions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h3 className="font-medium mb-1">Δεν υπάρχουν ανοιχτές θέσεις</h3>
          <p className="text-sm">Οι θέσεις σας θα εμφανιστούν εδώ μετά την εκτέλεση εντολών</p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalUnrealized = enrichedPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalRealized = enrichedPositions.reduce((sum, p) => sum + p.realized_pnl, 0);
  const totalPnL = totalUnrealized + totalRealized;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Ανοιχτές Θέσεις</h3>
          <div className="text-sm text-gray-500">
            {enrichedPositions.length} θέσ{enrichedPositions.length === 1 ? 'η' : 'εις'}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Προϊόν</th>
              <th className="px-4 py-3 text-left">Τύπος</th>
              <th className="px-4 py-3 text-right">Ποσότητα</th>
              <th className="px-4 py-3 text-right">Μέση Τιμή</th>
              <th className="px-4 py-3 text-right">Τρέχουσα</th>
              <th className="px-4 py-3 text-right">Μεταβολή</th>
              <th className="px-4 py-3 text-right">Μη Υλοπ. P&L</th>
              <th className="px-4 py-3 text-right">Υλοπ. P&L</th>
              <th className="px-4 py-3 text-right">Συνολικό P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {enrichedPositions.map((position) => {
              const positionKey = getPositionKey(position);
              const isAnimating = updatingPositions.has(positionKey);
              
              return (
                <tr
                  key={positionKey}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isAnimating ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  {/* Symbol */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {position.symbol}
                    </div>
                    {position.expiry && (
                      <div className="text-xs text-gray-500">
                        Exp: {new Date(position.expiry).toLocaleDateString()}
                      </div>
                    )}
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {position.opt_type ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          position.opt_type === 'C' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {position.opt_type === 'C' ? 'CALL' : 'PUT'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                          FUTURES
                        </span>
                      )}
                      {position.strike && (
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                          ${position.strike.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono font-medium ${
                      position.net_qty > 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {position.net_qty > 0 ? '+' : ''}{position.net_qty}
                    </span>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {Math.abs(position.net_qty * 1000).toLocaleString()} bbl
                    </div>
                  </td>

                  {/* Average Price */}
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                    ${position.avg_price.toFixed(2)}
                  </td>

                  {/* Current Price */}
                  <td className={`px-4 py-3 text-right font-mono font-medium ${
                    isAnimating ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                  } transition-colors`}>
                    ${position.currentPrice.toFixed(2)}
                  </td>

                  {/* Price Change */}
                  <td className="px-4 py-3 text-right">
                    <div className={`flex items-center justify-end gap-1 ${
                      position.priceChange >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {position.priceChange >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <div className="font-mono text-sm">
                        ${Math.abs(position.priceChange).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatPercent(position.priceChangePercent)}
                    </div>
                  </td>

                  {/* Unrealized P&L */}
                  <td className={`px-4 py-3 text-right font-mono font-medium ${
                    position.unrealizedPnL >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(position.unrealizedPnL)}
                  </td>

                  {/* Realized P&L */}
                  <td className={`px-4 py-3 text-right font-mono ${
                    position.realized_pnl >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(position.realized_pnl)}
                  </td>

                  {/* Total P&L */}
                  <td className={`px-4 py-3 text-right font-mono font-bold ${
                    position.totalPnL >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(position.totalPnL)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer with totals */}
          <tfoot className="bg-gray-50 dark:bg-gray-900">
            <tr className="font-semibold">
              <td colSpan={6} className="px-4 py-3 text-right text-gray-900 dark:text-white">
                Σύνολα:
              </td>
              <td className={`px-4 py-3 text-right font-mono ${
                totalUnrealized >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(totalUnrealized)}
              </td>
              <td className={`px-4 py-3 text-right font-mono ${
                totalRealized >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(totalRealized)}
              </td>
              <td className={`px-4 py-3 text-right font-mono font-bold text-lg ${
                totalPnL >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(totalPnL)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Risk Warning */}
      {Math.abs(totalPnL) > 50000 && (
        <div className="p-3 bg-yellow-50 border-t border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              Υψηλό P&L: Παρακολουθήστε τους κινδύνους σας προσεκτικά
            </span>
          </div>
        </div>
      )}

      {/* Educational Notice */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 text-center border-t border-gray-200 dark:border-gray-700">
        Εκπαιδευτικοί σκοποί μόνο • Δεν αποτελεί επενδυτική συμβουλή
      </div>
    </div>
  );
}
