'use client';

import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';

interface LeaderboardProps {
  leaderboard: any[];
  participants: any[];
  currentParticipantId?: string;
}

export default function Leaderboard({ leaderboard, participants, currentParticipantId }: LeaderboardProps) {
  const sortedLeaderboard = [...(leaderboard || [])].sort((a, b) => b.score - a.score);

  const getParticipantName = (participantId: string) => {
    const participant = participants?.find(p => p.id === participantId);
    return participant?.display_name || 'Unknown';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-4 h-4 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-4 h-4 text-orange-600" />;
    return <span className="w-4 h-4 text-center text-xs">{rank}</span>;
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Leaderboard</h3>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
            <tr className="text-xs text-gray-600 dark:text-gray-400">
              <th className="py-2 px-2 text-left">Rank</th>
              <th className="py-2 px-2 text-left">Player</th>
              <th className="py-2 px-2 text-right">Score</th>
              <th className="py-2 px-2 text-right">PnL</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeaderboard.map((entry, index) => {
              const isCurrentUser = entry.participant_id === currentParticipantId;
              const rank = index + 1;
              
              return (
                <tr
                  key={entry.participant_id}
                  className={`
                    border-t border-gray-100 dark:border-gray-700
                    ${isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : ''}
                    hover:bg-gray-50 dark:hover:bg-gray-700
                  `}
                >
                  <td className="py-2 px-2">
                    <div className="flex items-center">
                      {getRankIcon(rank)}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="truncate">
                      {getParticipantName(entry.participant_id)}
                      {isCurrentUser && (
                        <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(You)</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right mono-num">
                    {entry.score.toFixed(0)}
                  </td>
                  <td className={`py-2 px-2 text-right mono-num ${
                    entry.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <div className="flex items-center justify-end gap-1">
                      {entry.pnl >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      ${Math.abs(entry.pnl).toFixed(2)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between mb-1">
            <span>Session Mode:</span>
            <span className="font-medium">Live</span>
          </div>
          <div className="flex justify-between">
            <span>Participants:</span>
            <span className="font-medium">{participants?.length || 0}/25</span>
          </div>
        </div>
      </div>
    </div>
  );
}
