'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ScoreEvent } from '../lib/realtime';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Crown, Star, AlertCircle } from 'lucide-react';

interface LeaderboardEntry {
  participant_id: string;
  display_name: string;
  pnl: number;
  score: number;
  drawdown: number;
  penalties: number;
  rank: number | null;
  updated_at: string;
  seat_no: number;
  is_instructor?: boolean;
  // Additional fields for enhanced display
  previousRank?: number;
  rankChange?: number;
  isOnline?: boolean;
}

interface LeaderboardRealtimeProps {
  sessionId: string;
  participantId: string;
  initialData?: LeaderboardEntry[];
  showInstructor?: boolean;
  compact?: boolean;
  realtimeEnabled?: boolean;
}

export default function LeaderboardRealtime({
  sessionId,
  participantId,
  initialData = [],
  showInstructor = false,
  compact = false,
  realtimeEnabled = false
}: LeaderboardRealtimeProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialData);
  const [animatingParticipants, setAnimatingParticipants] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  
  const animationTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const previousRanks = useRef<Record<string, number>>({});

  // Handle score updates from realtime
  const handleScoreUpdate = async (scoreEvent: ScoreEvent) => {
    // Update the specific participant
    setLeaderboard(prev => {
      const updated = prev.map(entry => {
        if (entry.participant_id === scoreEvent.participantId) {
          // Store previous rank for animation
          const previousRank = entry.rank || 0;
          previousRanks.current[scoreEvent.participantId] = previousRank;
          
          return {
            ...entry,
            pnl: scoreEvent.realizedPnL,
            score: scoreEvent.score,
            rank: scoreEvent.rank,
            previousRank,
            rankChange: previousRank > 0 ? previousRank - scoreEvent.rank : 0,
            updated_at: scoreEvent.timestamp
          };
        }
        return entry;
      });
      
      // Re-sort by rank
      const sorted = updated.sort((a, b) => {
        if (a.rank === null) return 1;
        if (b.rank === null) return -1;
        return a.rank - b.rank;
      });
      
      // Trigger animation for the updated participant
      triggerRankAnimation(scoreEvent.participantId);
      
      setLastUpdateTime(new Date());
      return sorted;
    });
  };

  // Set up realtime connection
  useEffect(() => {
    if (!realtimeEnabled || !sessionId) return;

    let realtimeManager: any;
    
    const setupRealtime = async () => {
      const { realtimeManager: rtm } = await import('../lib/realtime');
      realtimeManager = rtm;
      
      await realtimeManager.connect(sessionId, participantId, {
        onScore: handleScoreUpdate
      });
    };

    setupRealtime();

    return () => {
      if (realtimeManager) {
        realtimeManager.disconnect();
      }
    };
  }, [sessionId, participantId, realtimeEnabled]);

  // Trigger rank change animation
  const triggerRankAnimation = (participantId: string) => {
    setAnimatingParticipants(prev => new Set([...prev, participantId]));
    
    // Clear existing timer
    if (animationTimers.current[participantId]) {
      clearTimeout(animationTimers.current[participantId]);
    }
    
    // Remove animation after 3 seconds
    animationTimers.current[participantId] = setTimeout(() => {
      setAnimatingParticipants(prev => {
        const newSet = new Set(prev);
        newSet.delete(participantId);
        return newSet;
      });
    }, 3000);
  };

  // Filter out instructors if not showing them
  const filteredLeaderboard = leaderboard.filter(entry => 
    showInstructor || !entry.is_instructor
  );

  // Get current user's entry
  const currentUserEntry = leaderboard.find(entry => entry.participant_id === participantId);

  // Format currency
  const formatCurrency = (value: number) => {
    const prefix = value < 0 ? '-$' : '$';
    return prefix + Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Get rank icon
  const getRankIcon = (rank: number | null) => {
    if (!rank) return null;
    
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-orange-400" />;
      default:
        return null;
    }
  };

  // Get rank change indicator
  const getRankChangeIndicator = (entry: LeaderboardEntry) => {
    if (!entry.rankChange || entry.rankChange === 0) return null;
    
    const isImprovement = entry.rankChange > 0;
    return (
      <div className={`flex items-center gap-1 text-xs ${
        isImprovement ? 'text-green-600' : 'text-red-600'
      }`}>
        {isImprovement ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{Math.abs(entry.rankChange)}</span>
      </div>
    );
  };

  if (filteredLeaderboard.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <div className="text-center text-gray-500">
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Η κατάταξη θα εμφανιστεί μετά τις πρώτες συναλλαγές</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Κατάταξη
            </h3>
          </div>
          {realtimeEnabled && (
            <div className="text-xs text-gray-500">
              Ενημέρωση: {lastUpdateTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Current User Summary (if not in compact mode) */}
      {!compact && currentUserEntry && currentUserEntry.rank && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Η θέση σας
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                #{currentUserEntry.rank}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-600 dark:text-blue-400">Score</div>
              <div className={`text-xl font-bold ${
                currentUserEntry.score >= 0 
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(currentUserEntry.score)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className={compact ? 'max-h-96 overflow-y-auto' : ''}>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
            <tr className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Θέση</th>
              <th className="px-4 py-3 text-left">Παίκτης</th>
              {!compact && (
                <>
                  <th className="px-4 py-3 text-right">P&L</th>
                  <th className="px-4 py-3 text-right">Ποινές</th>
                </>
              )}
              <th className="px-4 py-3 text-right">Score</th>
              {!compact && <th className="px-4 py-3 text-center">Μεταβολή</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredLeaderboard.map((entry) => {
              const isCurrentUser = entry.participant_id === participantId;
              const isAnimating = animatingParticipants.has(entry.participant_id);
              const isTopThree = entry.rank && entry.rank <= 3;
              
              return (
                <tr
                  key={entry.participant_id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 ${
                    isCurrentUser 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' 
                      : ''
                  } ${
                    isAnimating ? 'animate-pulse bg-yellow-50 dark:bg-yellow-900/20' : ''
                  } ${
                    isTopThree ? 'font-medium' : ''
                  }`}
                >
                  {/* Rank */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getRankIcon(entry.rank)}
                      <span className={`font-mono text-lg ${
                        isTopThree ? 'font-bold' : ''
                      }`}>
                        {entry.rank || '-'}
                      </span>
                      {entry.is_instructor && (
                        <Star className="w-4 h-4 text-purple-500" title="Εκπαιδευτής" />
                      )}
                    </div>
                  </td>

                  {/* Player Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className={`font-medium ${
                          isCurrentUser 
                            ? 'text-blue-900 dark:text-blue-100' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {entry.display_name}
                          {isCurrentUser && ' (Εσείς)'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Θέση #{entry.seat_no}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* P&L (if not compact) */}
                  {!compact && (
                    <td className={`px-4 py-3 text-right font-mono ${
                      entry.pnl >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(entry.pnl)}
                    </td>
                  )}

                  {/* Penalties (if not compact) */}
                  {!compact && (
                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                      {entry.penalties > 0 ? `-${formatCurrency(entry.penalties)}` : '-'}
                    </td>
                  )}

                  {/* Score */}
                  <td className={`px-4 py-3 text-right font-mono font-bold ${
                    entry.score >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(entry.score)}
                  </td>

                  {/* Rank Change (if not compact) */}
                  {!compact && (
                    <td className="px-4 py-3 text-center">
                      {getRankChangeIndicator(entry)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer with stats */}
      {!compact && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 text-sm border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {filteredLeaderboard.length}
              </div>
              <div className="text-gray-500">Συμμετέχοντες</div>
            </div>
            <div>
              <div className={`font-medium ${
                filteredLeaderboard.filter(e => e.score > 0).length > filteredLeaderboard.length / 2
                  ? 'text-green-600' : 'text-red-600'
              }`}>
                {filteredLeaderboard.filter(e => e.score > 0).length}
              </div>
              <div className="text-gray-500">Θετικό Score</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(
                  filteredLeaderboard.reduce((sum, e) => sum + e.score, 0) / filteredLeaderboard.length
                )}
              </div>
              <div className="text-gray-500">Μέσο Score</div>
            </div>
          </div>
        </div>
      )}

      {/* Risk warning for low scores */}
      {currentUserEntry && currentUserEntry.score < -100000 && (
        <div className="p-3 bg-red-50 border-t border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              Χαμηλό score - αξιολογήστε τη στρατηγική ρίσκου σας
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
