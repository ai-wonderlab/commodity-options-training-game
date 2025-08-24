'use client';

import React, { useState, useEffect } from 'react';
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
  XCircle,
  Zap,
  Shield
} from 'lucide-react';
import { cn, cardStyles, badgeStyles, formatCurrency, formatNumber } from '../lib/utils';
import { 
  supabase, 
  LeaderboardEntry, 
  Participant, 
  BreachEvent,
  Order,
  isSupabaseConfigured 
} from '../lib/supabaseClient';
import toast from 'react-hot-toast';

interface LeaderboardProps {
  sessionId: string;
  currentParticipantId?: string;
}

interface Alert {
  id: string;
  type: 'fill' | 'breach' | 'shock' | 'info';
  message: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export default function LeaderboardLive({ sessionId, currentParticipantId }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'alerts'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!isSupabaseConfigured()) {
        // Use mock data
        setLeaderboard([
          { session_id: sessionId, participant_id: '1', pnl: 5000, score: 1250, drawdown: 1000, penalties: 0, rank: 1, updated_at: new Date() },
          { session_id: sessionId, participant_id: '2', pnl: 3000, score: 950, drawdown: 2000, penalties: 100, rank: 2, updated_at: new Date() },
          { session_id: sessionId, participant_id: '3', pnl: -1000, score: 450, drawdown: 3000, penalties: 200, rank: 3, updated_at: new Date() },
        ]);
        setParticipants([
          { id: '1', session_id: sessionId, display_name: 'Alice', seat_no: 1, sso_user_id: '1', is_instructor: false, initial_bankroll: 100000, created_at: new Date() },
          { id: '2', session_id: sessionId, display_name: 'Bob', seat_no: 2, sso_user_id: '2', is_instructor: false, initial_bankroll: 100000, created_at: new Date() },
          { id: '3', session_id: sessionId, display_name: 'Charlie', seat_no: 3, sso_user_id: '3', is_instructor: false, initial_bankroll: 100000, created_at: new Date() },
        ]);
        setLoading(false);
        return;
      }

      try {
        // Load leaderboard
        const { data: leaderboardData, error: leaderboardError } = await supabase
          .from('leaderboard')
          .select('*')
          .eq('session_id', sessionId)
          .order('score', { ascending: false });

        if (leaderboardError) throw leaderboardError;
        
        // Add ranks
        const rankedLeaderboard = (leaderboardData || []).map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));
        setLeaderboard(rankedLeaderboard);

        // Load participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('participants')
          .select('*')
          .eq('session_id', sessionId);

        if (participantsError) throw participantsError;
        setParticipants(participantsData || []);

        // Load recent alerts (breach events and recent fills)
        await loadAlerts();

        setIsConnected(true);
      } catch (error) {
        console.error('Error loading leaderboard data:', error);
        toast.error('Failed to load leaderboard');
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId]);

  // Load alerts
  const loadAlerts = async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Load breach events
      const { data: breaches } = await supabase
        .from('breach_events')
        .select('*')
        .in('participant_id', participants.map(p => p.id))
        .gte('start_ts', oneHourAgo.toISOString())
        .order('start_ts', { ascending: false })
        .limit(10);

      // Load recent fills
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'FILLED')
        .gte('filled_at', oneHourAgo.toISOString())
        .order('filled_at', { ascending: false })
        .limit(10);

      const combinedAlerts: Alert[] = [];

      // Convert breaches to alerts
      breaches?.forEach((breach: BreachEvent) => {
        const participant = participants.find(p => p.id === breach.participant_id);
        combinedAlerts.push({
          id: breach.id,
          type: 'breach',
          message: `${participant?.display_name || 'Player'}: ${breach.type} limit ${breach.severity.toLowerCase()} (${formatNumber(breach.actual_value, 2)}/${formatNumber(breach.limit_value, 2)})`,
          timestamp: new Date(breach.start_ts),
          severity: breach.severity === 'CRITICAL' ? 'error' : breach.severity === 'WARNING' ? 'warning' : 'info'
        });
      });

      // Convert orders to alerts
      recentOrders?.forEach((order: Order) => {
        const participant = participants.find(p => p.id === order.participant_id);
        combinedAlerts.push({
          id: order.id,
          type: 'fill',
          message: `${participant?.display_name || 'Player'}: ${order.side} ${order.qty} ${order.symbol} @ ${formatCurrency(order.fill_price || 0)}`,
          timestamp: new Date(order.filled_at || order.created_at),
          severity: 'success'
        });
      });

      // Sort by timestamp
      combinedAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAlerts(combinedAlerts.slice(0, 20));
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isSupabaseConfigured() || !sessionId) return;

    // Subscribe to leaderboard updates
    const leaderboardChannel = supabase
      .channel(`leaderboard-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setLeaderboard(prev => {
              const updated = prev.filter(e => e.participant_id !== payload.new.participant_id);
              updated.push(payload.new as LeaderboardEntry);
              updated.sort((a, b) => b.score - a.score);
              return updated.map((entry, index) => ({ ...entry, rank: index + 1 }));
            });
          }
        }
      )
      .subscribe();

    // Subscribe to breach events
    const breachChannel = supabase
      .channel(`breaches-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'breach_events'
        },
        (payload) => {
          const breach = payload.new as BreachEvent;
          const participant = participants.find(p => p.id === breach.participant_id);
          if (participant) {
            const newAlert: Alert = {
              id: breach.id,
              type: 'breach',
              message: `${participant.display_name}: ${breach.type} limit ${breach.severity.toLowerCase()}`,
              timestamp: new Date(breach.start_ts),
              severity: breach.severity === 'CRITICAL' ? 'error' : breach.severity === 'WARNING' ? 'warning' : 'info'
            };
            setAlerts(prev => [newAlert, ...prev].slice(0, 20));
            
            // Show toast for critical breaches
            if (breach.severity === 'CRITICAL') {
              toast.error(newAlert.message);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to order fills
    const ordersChannel = supabase
      .channel(`orders-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          const order = payload.new as Order;
          if (order.status === 'FILLED') {
            const participant = participants.find(p => p.id === order.participant_id);
            const newAlert: Alert = {
              id: order.id,
              type: 'fill',
              message: `${participant?.display_name || 'Player'}: ${order.side} ${order.qty} ${order.symbol} @ ${formatCurrency(order.fill_price || 0)}`,
              timestamp: new Date(order.filled_at || order.created_at),
              severity: 'success'
            };
            setAlerts(prev => [newAlert, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    return () => {
      leaderboardChannel.unsubscribe();
      breachChannel.unsubscribe();
      ordersChannel.unsubscribe();
    };
  }, [sessionId, participants]);

  const getParticipantName = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
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

  const getAlertIcon = (alert: Alert) => {
    switch (alert.type) {
      case 'fill':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'breach':
        return alert.severity === 'error' ? 
          <XCircle className="h-4 w-4 text-destructive" /> : 
          <AlertCircle className="h-4 w-4 text-warning" />;
      case 'shock':
        return <Zap className="h-4 w-4 text-info" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const currentUserEntry = leaderboard.find(e => e.participant_id === currentParticipantId);
  const currentUserRank = currentUserEntry?.rank || 0;

  if (loading) {
    return (
      <div className={cn(cardStyles.base, "h-full flex flex-col")}>
        <div className={cardStyles.content}>
          <div className="flex items-center justify-center py-8">
            <Activity className="h-6 w-6 text-muted-foreground animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(cardStyles.base, "h-full flex flex-col")}>
      {/* Header with Tabs */}
      <div className={cardStyles.header}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-h4 font-serif font-bold text-foreground">
            Competition
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-caption text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{participants.length}/25</span>
            </div>
            {isConnected && (
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-success animate-pulse" />
                <span className="text-caption text-success">Live</span>
              </div>
            )}
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
              "flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 relative",
              activeTab === 'alerts'
                ? "bg-background shadow-soft text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="h-3 w-3" />
            Alerts
            {alerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                {alerts.length}
              </span>
            )}
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
                    Rank #{currentUserRank} of {leaderboard.length}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-small font-bold">{formatNumber(currentUserEntry.score, 0)} pts</div>
                <div className={cn(
                  "text-caption font-medium",
                  currentUserEntry.pnl >= 0 ? "text-success" : "text-destructive"
                )}>
                  {currentUserEntry.pnl >= 0 ? '+' : ''}{formatCurrency(currentUserEntry.pnl)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === 'leaderboard' ? (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = entry.participant_id === currentParticipantId;
              const rankDisplay = getRankDisplay(rank);
              
              return (
                <div
                  key={entry.participant_id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    isCurrentUser ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50",
                    rank <= 3 && `shadow-sm ${rankDisplay.glow}`
                  )}
                >
                  {/* Rank */}
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    rank <= 3 ? rankDisplay.badge : "bg-muted"
                  )}>
                    {rankDisplay.icon}
                  </div>
                  
                  {/* Player Info */}
                  <div className="flex-1">
                    <div className="text-small font-semibold text-foreground">
                      {getParticipantName(entry.participant_id)}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-primary">(You)</span>
                      )}
                    </div>
                    <div className="text-caption text-muted-foreground">
                      Score: {formatNumber(entry.score, 0)} pts
                    </div>
                  </div>
                  
                  {/* P&L */}
                  <div className="text-right">
                    <div className={cn(
                      "text-small font-bold flex items-center gap-1",
                      entry.pnl >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {entry.pnl >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {entry.pnl >= 0 ? '+' : ''}{formatCurrency(entry.pnl)}
                    </div>
                    {entry.penalties > 0 && (
                      <div className="text-caption text-warning">
                        -{formatCurrency(entry.penalties)} penalty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {leaderboard.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No players have joined yet
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-all hover:bg-muted/50",
                  alert.severity === 'error' && "bg-destructive/5 border border-destructive/20",
                  alert.severity === 'warning' && "bg-warning/5 border border-warning/20",
                  alert.severity === 'success' && "bg-success/5 border border-success/20"
                )}
              >
                {getAlertIcon(alert)}
                <div className="flex-1">
                  <div className="text-small text-foreground">
                    {alert.message}
                  </div>
                  <div className="text-caption text-muted-foreground mt-1">
                    {formatTimeAgo(alert.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {alerts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No recent alerts
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
