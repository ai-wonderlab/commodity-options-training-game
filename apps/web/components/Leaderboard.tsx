'use client';

import React, { useState } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Award,
  Crown,
  Medal,
  Star,
  Activity,
  Bell,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn, cardStyles, badgeStyles, formatCurrency, formatNumber } from '../lib/utils';

interface LeaderboardProps {
  leaderboard: any[];
  participants: any[];
  currentParticipantId?: string;
}

// Mock alerts for demonstration
const mockAlerts = [
  { id: 1, type: 'fill', message: 'Order filled: BUY 5 BRN @ $82.45', time: '2m ago', icon: CheckCircle2, color: 'text-success' },
  { id: 2, type: 'breach', message: 'Delta limit approaching (78%)', time: '5m ago', icon: AlertCircle, color: 'text-warning' },
  { id: 3, type: 'shock', message: 'Market shock applied: Spot +2%', time: '10m ago', icon: Activity, color: 'text-info' },
  { id: 4, type: 'fill', message: 'Order filled: SELL 2 BUL-C-85 @ $1.23', time: '15m ago', icon: CheckCircle2, color: 'text-success' },
  { id: 5, type: 'breach', message: 'VaR limit breached!', time: '20m ago', icon: XCircle, color: 'text-destructive' },
];

export default function Leaderboard({ leaderboard, participants, currentParticipantId }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'alerts'>('leaderboard');
  const sortedLeaderboard = [...(leaderboard || [])].sort((a, b) => b.score - a.score);

  const getParticipantName = (participantId: string) => {
    const participant = participants?.find(p => p.id === participantId);
    return participant?.display_name || 'Unknown';
  };

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          icon: <Crown className="h-5 w-5 text-yellow-500" />,
          badge: 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white',
          glow: 'shadow-yellow-500/20'
        };
      case 2:
        return {
          icon: <Medal className="h-5 w-5 text-gray-400" />,
          badge: 'bg-gradient-to-r from-gray-300 to-gray-500 text-white',
          glow: 'shadow-gray-500/20'
        };
      case 3:
        return {
          icon: <Star className="h-5 w-5 text-orange-600" />,
          badge: 'bg-gradient-to-r from-orange-400 to-orange-600 text-white',
          glow: 'shadow-orange-500/20'
        };
      default:
        return {
          icon: <span className="h-5 w-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>,
          badge: 'bg-muted text-muted-foreground',
          glow: ''
        };
    }
  };

  const currentUserRank = sortedLeaderboard.findIndex(e => e.participant_id === currentParticipantId) + 1;
  const currentUserEntry = sortedLeaderboard.find(e => e.participant_id === currentParticipantId);

  return (
    <div className={cn(cardStyles.base, "h-full flex flex-col")}>
      {/* Header with Tabs */}
      <div className={cardStyles.header}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-h4 font-serif font-bold text-foreground">
            Competition
          </h3>
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{participants?.length || 0}/25</span>
          </div>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={cn(
              "flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
              activeTab === 'leaderboard'
                ? "bg-background shadow-soft text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy className="h-3 w-3" />
            Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={cn(
              "flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
              activeTab === 'alerts'
                ? "bg-background shadow-soft text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="h-3 w-3" />
            Alerts
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
              5
            </span>
          </button>
        </div>
      </div>

      {/* Current User Stats (if in leaderboard tab) */}
      {activeTab === 'leaderboard' && currentUserEntry && (
        <div className="px-6 pb-3">
          <div className={cn(
            "p-3 rounded-lg border-2",
            currentUserRank <= 3 ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-border"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  getRankDisplay(currentUserRank).badge
                )}>
                  {getRankDisplay(currentUserRank).icon}
                </div>
                <div>
                  <div className="text-small font-bold text-foreground">Your Position</div>
                  <div className="text-caption text-muted-foreground">
                    Rank #{currentUserRank} of {sortedLeaderboard.length}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-small font-bold">{formatNumber(currentUserEntry.score, 0)} pts</div>
                <div className={cn(
                  "text-caption font-medium",
                  currentUserEntry.pnl >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(currentUserEntry.pnl)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-auto px-2">
        {activeTab === 'leaderboard' ? (
          <div className="space-y-1 pb-4">
            {sortedLeaderboard.map((entry, index) => {
              const isCurrentUser = entry.participant_id === currentParticipantId;
              const rank = index + 1;
              const rankDisplay = getRankDisplay(rank);
              
              return (
                <div
                  key={entry.participant_id}
                  className={cn(
                    "px-4 py-3 rounded-lg transition-all duration-200",
                    isCurrentUser 
                      ? "bg-primary/10 border-2 border-primary/20 shadow-soft" 
                      : "hover:bg-muted/50",
                    rank <= 3 && `shadow-sm ${rankDisplay.glow}`
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center",
                        rank <= 3 ? rankDisplay.badge : "bg-muted"
                      )}>
                        {rankDisplay.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-small font-medium",
                            isCurrentUser && "text-primary"
                          )}>
                            {getParticipantName(entry.participant_id)}
                          </span>
                          {isCurrentUser && (
                            <span className={cn(
                              badgeStyles.base,
                              "py-0 px-2 text-xs",
                              badgeStyles.variants.default
                            )}>
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-caption text-muted-foreground">
                            Score: <span className="font-medium text-foreground">{formatNumber(entry.score, 0)}</span>
                          </span>
                          <span className={cn(
                            "text-caption font-medium flex items-center gap-1",
                            entry.pnl >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {entry.pnl >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatCurrency(Math.abs(entry.pnl))}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {entry.penalties > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/10">
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        <span className="text-xs font-medium text-destructive">
                          -{formatNumber(entry.penalties, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Alerts Tab
          <div className="space-y-2 pb-4">
            {mockAlerts.map((alert) => {
              const Icon = alert.icon;
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-lg border bg-card animate-fade-in-down",
                    alert.type === 'breach' && "border-warning/20 bg-warning/5",
                    alert.type === 'shock' && "border-info/20 bg-info/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={cn("h-4 w-4 mt-0.5", alert.color)} />
                    <div className="flex-1">
                      <p className="text-small text-foreground">
                        {alert.message}
                      </p>
                      <p className="text-caption text-muted-foreground mt-1">
                        {alert.time}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={cn(cardStyles.footer, "border-t border-border bg-muted/30")}>
        <div className="w-full space-y-2">
          <div className="flex justify-between text-caption">
            <span className="text-muted-foreground">Session Status</span>
            <span className="font-medium text-success flex items-center gap-1">
              <Activity className="h-3 w-3" />
              LIVE
            </span>
          </div>
          <div className="flex justify-between text-caption">
            <span className="text-muted-foreground">Time Remaining</span>
            <span className="font-medium font-mono">24:35</span>
          </div>
        </div>
      </div>
    </div>
  );
}