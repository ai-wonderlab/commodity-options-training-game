'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ArrowUp, ArrowDown, Clock, DollarSign } from 'lucide-react';

interface Trade {
  id: string;
  timestamp: string;
  player_name: string;
  instrument: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT';
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED';
  pnl?: number;
}

interface TradeHistoryProps {
  sessionId: string;
}

export default function TradeHistory({ sessionId }: TradeHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'size' | 'pnl'>('time');

  useEffect(() => {
    loadTrades();
  }, [sessionId]);

  const loadTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, participants(display_name)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data
      const tradesData = (data || []).map(order => ({
        id: order.id,
        timestamp: order.created_at,
        player_name: order.participants?.display_name || 'Unknown',
        instrument: order.instrument,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        order_type: order.order_type,
        status: order.status,
        pnl: Math.random() * 2000 - 1000, // Mock P&L
      }));
      
      setTrades(tradesData);
    } catch (error) {
      console.error('Error loading trades:', error);
      // Use mock data
      setTrades(getMockTrades());
    } finally {
      setLoading(false);
    }
  };

  const getMockTrades = (): Trade[] => {
    const instruments = ['BRN', 'BUL-85C-30D', 'BUL-82.5C-30D', 'BUL-80P-30D', 'BUL-87.5C-60D'];
    const players = ['Alice Trader', 'Bob Investor', 'Charlie Risk', 'Diana Options', 'Eve Hedge'];
    const trades: Trade[] = [];
    
    for (let i = 0; i < 50; i++) {
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      trades.push({
        id: `trade-${i}`,
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        player_name: players[Math.floor(Math.random() * players.length)],
        instrument: instruments[Math.floor(Math.random() * instruments.length)],
        side,
        quantity: Math.floor(Math.random() * 20) + 1,
        price: 80 + Math.random() * 10,
        order_type: Math.random() > 0.3 ? 'LIMIT' : 'MARKET',
        status: 'FILLED',
        pnl: (Math.random() - 0.5) * 2000,
      });
    }
    
    return trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const filteredTrades = trades.filter(trade => {
    if (filter === 'all') return true;
    if (filter === 'buy') return trade.side === 'BUY';
    if (filter === 'sell') return trade.side === 'SELL';
    return true;
  });

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    switch (sortBy) {
      case 'time':
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      case 'size':
        return b.quantity - a.quantity;
      case 'pnl':
        return (b.pnl || 0) - (a.pnl || 0);
      default:
        return 0;
    }
  });

  // Calculate summary stats
  const totalVolume = trades.reduce((sum, t) => sum + t.quantity, 0);
  const totalTrades = trades.length;
  const buyTrades = trades.filter(t => t.side === 'BUY').length;
  const sellTrades = trades.filter(t => t.side === 'SELL').length;
  const avgPrice = trades.reduce((sum, t) => sum + t.price, 0) / (trades.length || 1);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Trades</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalTrades}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalVolume}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Buy/Sell Ratio</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {buyTrades}/{sellTrades}
              </p>
            </div>
            <div className="flex gap-1">
              <ArrowUp className="w-6 h-6 text-green-600" />
              <ArrowDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Price</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${avgPrice.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Trade Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Trade History
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Filter:</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="buy">Buy Only</option>
                  <option value="sell">Sell Only</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="time">Time</option>
                  <option value="size">Size</option>
                  <option value="pnl">P&L</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Instrument
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Side
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Price
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  P&L
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Loading trades...
                  </td>
                </tr>
              ) : sortedTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No trades found
                  </td>
                </tr>
              ) : (
                sortedTrades.slice(0, 50).map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {trade.player_name}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">
                      {trade.instrument}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        trade.side === 'BUY' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {trade.side === 'BUY' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {trade.quantity}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white font-mono">
                      ${trade.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-center">
                      <span className={`text-xs ${
                        trade.order_type === 'MARKET' ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {trade.order_type}
                      </span>
                    </td>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm text-right font-mono ${
                      (trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {trade.pnl ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(0)}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
