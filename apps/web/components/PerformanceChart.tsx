'use client';

import { useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface PerformanceChartProps {
  sessionId: string;
  playerData: any[];
}

export default function PerformanceChart({ sessionId, playerData }: PerformanceChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    const canvas = chartRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 400;

    // Draw mock chart
    drawPnLChart(ctx, canvas.width, canvas.height);
  }, [playerData]);

  const drawPnLChart = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Generate mock time series data
    const dataPoints = 60; // 60 minutes
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Generate cumulative P&L over time for top 3 players
    const colors = ['#10b981', '#3b82f6', '#f59e0b'];
    const players = playerData.slice(0, 3);
    
    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw grid lines
    ctx.strokeStyle = '#f3f4f6';
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw P&L lines for each player
    players.forEach((player, playerIndex) => {
      const data: number[] = [];
      let cumPnL = 0;
      
      // Generate random walk towards final P&L
      for (let i = 0; i <= dataPoints; i++) {
        const progress = i / dataPoints;
        const noise = (Math.random() - 0.5) * 1000;
        cumPnL = player.current_pnl * progress + noise;
        data.push(cumPnL);
      }
      
      // Draw line
      ctx.strokeStyle = colors[playerIndex];
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      data.forEach((value, i) => {
        const x = padding + (chartWidth / dataPoints) * i;
        const maxPnL = Math.max(...players.map(p => Math.abs(p.current_pnl))) * 1.2;
        const y = height - padding - ((value + maxPnL) / (maxPnL * 2)) * chartHeight;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw player label
      ctx.fillStyle = colors[playerIndex];
      ctx.font = '12px sans-serif';
      ctx.fillText(
        player.display_name,
        width - padding - 100,
        padding + 20 + playerIndex * 20
      );
    });
    
    // Draw zero line
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(width - padding, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  return (
    <div className="space-y-6">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Best Return</span>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            +{((playerData[0]?.current_pnl || 0) / 100000 * 100).toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {playerData[0]?.display_name}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Average Return</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {playerData.length > 0 
              ? (playerData.reduce((sum, p) => sum + p.current_pnl, 0) / playerData.length / 100000 * 100).toFixed(2)
              : '0.00'}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Across {playerData.length} players
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Worst Return</span>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">
            {((playerData[playerData.length - 1]?.current_pnl || 0) / 100000 * 100).toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {playerData[playerData.length - 1]?.display_name}
          </div>
        </div>
      </div>

      {/* P&L Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Cumulative P&L Over Time
        </h3>
        <canvas 
          ref={chartRef}
          className="w-full"
          style={{ maxHeight: '400px' }}
        />
      </div>

      {/* Performance Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Performance Distribution
        </h3>
        <div className="space-y-3">
          {playerData.map((player, index) => {
            const maxPnL = Math.max(...playerData.map(p => Math.abs(p.current_pnl)));
            const percentage = Math.abs(player.current_pnl) / maxPnL * 100;
            const isPositive = player.current_pnl >= 0;
            
            return (
              <div key={index} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-gray-900 dark:text-white truncate">
                  {player.display_name}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6">
                    <div
                      className={`h-6 rounded-full flex items-center justify-end pr-2 ${
                        isPositive ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    >
                      <span className="text-xs text-white font-medium">
                        ${player.current_pnl.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
