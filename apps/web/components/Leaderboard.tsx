'use client';

import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';

export function Leaderboard() {
  const participants = [
    { rank: 1, name: 'Trader Alpha', pnl: 2845.50, score: 3845, change: 'up' },
    { rank: 2, name: 'You', pnl: 1234.56, score: 2234, change: 'up', isYou: true },
    { rank: 3, name: 'Market Maker', pnl: 987.23, score: 1987, change: 'down' },
    { rank: 4, name: 'Option Pro', pnl: 456.78, score: 1456, change: 'up' },
    { rank: 5, name: 'Risk Taker', pnl: -234.56, score: 765, change: 'down' },
  ];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank.toString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
          <Trophy size={16} className="text-yellow-500" />
          Leaderboard
        </h3>
        <span className="text-xs text-gray-500">Live Rankings</span>
      </div>

      <div className="space-y-2">
        {participants.map((participant) => (
          <div
            key={participant.rank}
            className={`flex items-center justify-between p-2 rounded ${
              participant.isYou ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 text-center text-sm font-bold">
                {getRankIcon(participant.rank)}
              </div>
              <div>
                <div className="text-sm font-medium">
                  {participant.name}
                  {participant.isYou && (
                    <span className="ml-1 text-xs text-blue-600">(You)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Score: {participant.score.toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className={`text-sm font-medium flex items-center gap-1 ${
                participant.pnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {participant.change === 'up' ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {participant.pnl >= 0 ? '+' : ''}${Math.abs(participant.pnl).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Total Players: 5</span>
          <span>Session Time: 32:45</span>
        </div>
      </div>
    </div>
  );
}
