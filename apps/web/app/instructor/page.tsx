'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { 
  Plus, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Play, 
  Pause, 
  RefreshCw,
  Activity,
  Calendar,
  DollarSign,
  Settings,
  BarChart3,
  Clock,
  Shield,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, cardStyles, buttonStyles, inputStyles, formatCurrency, formatNumber } from '../../lib/utils';

interface Session {
  id: string;
  session_id: string;
  mode: 'live' | 'replay';
  status: 'setup' | 'active' | 'paused' | 'completed';
  bankroll: number;
  var_limit: number;
  max_players: number;
  current_players: number;
  created_at: string;
}

export default function InstructorPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // New session form
  const [newSession, setNewSession] = useState({
    mode: 'live' as 'live' | 'replay',
    bankroll: 100000,
    varLimit: 5000,
    maxPlayers: 25,
    replayDay: '',
    replaySpeed: 1,
  });

  useEffect(() => {
    loadSessions();
    
    // Subscribe to session updates
    const subscription = supabase
      .channel('instructor-sessions')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sessions' 
      }, () => {
        loadSessions();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Add mock current_players count
      const sessionsWithPlayers = (data || []).map(s => ({
        ...s,
        current_players: Math.floor(Math.random() * s.max_players)
      }));
      
      setSessions(sessionsWithPlayers);
    } catch (error) {
      console.error('Error loading sessions:', error);
      // Use mock data if Supabase not configured
      setSessions([
        {
          id: '1',
          session_id: 'TEST-SESSION-' + Date.now(),
          mode: 'live',
          status: 'active',
          bankroll: 100000,
          var_limit: 5000,
          max_players: 25,
          current_players: 12,
          created_at: new Date().toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/functions/session-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          mode: newSession.mode,
          bankroll: newSession.bankroll,
          var_limit: newSession.varLimit,
          max_players: newSession.maxPlayers,
          replay_day: newSession.replayDay || undefined,
          replay_speed: newSession.replaySpeed,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      toast.success('Session created successfully!');
      setShowCreateModal(false);
      loadSessions();
      router.push(`/instructor/${data.sessionId}`);
    } catch (error) {
      toast.error((error as any).message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-success bg-success/10 border-success/20';
      case 'paused': return 'text-warning bg-warning/10 border-warning/20';
      case 'completed': return 'text-muted-foreground bg-muted border-border';
      default: return 'text-info bg-info/10 border-info/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="h-3 w-3" />;
      case 'paused': return <Pause className="h-3 w-3" />;
      case 'completed': return <Activity className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  // Calculate total statistics
  const totalPlayers = sessions.reduce((acc, s) => acc + s.current_players, 0);
  const activeSessions = sessions.filter(s => s.status === 'active').length;
  const totalBankroll = sessions.reduce((acc, s) => acc + (s.current_players * s.bankroll), 0);
  const avgBankroll = totalPlayers > 0 ? totalBankroll / totalPlayers : 0;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h2 font-serif font-bold text-foreground">
              Instructor Console
            </h1>
            <p className="text-body text-muted-foreground mt-2">
              Manage training sessions for ICE Brent Options
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              buttonStyles.base,
              buttonStyles.variants.default,
              buttonStyles.sizes.lg,
              "shadow-medium hover:shadow-hard transform hover:scale-105 transition-all"
            )}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Session
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={cn(cardStyles.base, "hover:shadow-medium transition-all")}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-caption text-muted-foreground">Active Sessions</p>
                  <p className="text-h3 font-bold text-foreground mt-1">
                    {formatNumber(activeSessions, 0)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-success/10">
                  <Activity className="h-6 w-6 text-success" />
                </div>
              </div>
            </div>
          </div>

          <div className={cn(cardStyles.base, "hover:shadow-medium transition-all")}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-caption text-muted-foreground">Total Players</p>
                  <p className="text-h3 font-bold text-foreground mt-1">
                    {formatNumber(totalPlayers, 0)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className={cn(cardStyles.base, "hover:shadow-medium transition-all")}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-caption text-muted-foreground">Avg Bankroll</p>
                  <p className="text-h3 font-bold text-foreground mt-1">
                    {formatCurrency(avgBankroll, 0)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-info/10">
                  <DollarSign className="h-6 w-6 text-info" />
                </div>
              </div>
            </div>
          </div>

          <div className={cn(cardStyles.base, "hover:shadow-medium transition-all")}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-caption text-muted-foreground">Risk Breaches</p>
                  <p className="text-h3 font-bold text-foreground mt-1">
                    {formatNumber(3, 0)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-warning/10">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className={cardStyles.base}>
          <div className={cardStyles.header}>
            <h2 className="text-h4 font-serif font-bold text-foreground">
              Active Sessions
            </h2>
          </div>
          
          <div className="overflow-auto">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No sessions found</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className={cn(
                    buttonStyles.base,
                    buttonStyles.variants.outline,
                    buttonStyles.sizes.default
                  )}
                >
                  Create your first session
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-6 hover:bg-muted/30 transition-all cursor-pointer"
                    onClick={() => router.push(`/instructor/${session.session_id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <h3 className="text-body font-bold text-foreground">
                            {session.session_id}
                          </h3>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1",
                            getStatusColor(session.status)
                          )}>
                            {getStatusIcon(session.status)}
                            {session.status.toUpperCase()}
                          </span>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium",
                            session.mode === 'live' 
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-info/10 text-info border border-info/20"
                          )}>
                            {session.mode === 'live' ? 'LIVE' : 'REPLAY'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-caption text-muted-foreground">Players</p>
                            <p className="text-small font-medium flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {session.current_players}/{session.max_players}
                            </p>
                          </div>
                          <div>
                            <p className="text-caption text-muted-foreground">Bankroll</p>
                            <p className="text-small font-medium flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(session.bankroll, 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-caption text-muted-foreground">VaR Limit</p>
                            <p className="text-small font-medium flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              {formatCurrency(session.var_limit, 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-caption text-muted-foreground">Created</p>
                            <p className="text-small font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(session.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex items-center justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/instructor/${session.session_id}`);
                              }}
                              className={cn(
                                buttonStyles.base,
                                buttonStyles.variants.default,
                                buttonStyles.sizes.sm,
                                "shadow-soft"
                              )}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Manage
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500"
                          style={{ 
                            width: `${(session.current_players / session.max_players) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className={cn(cardStyles.base, "w-full max-w-2xl mx-4 shadow-hard animate-slide-in-from-bottom")}>
            <div className={cardStyles.header}>
              <div className="flex items-center justify-between">
                <h2 className="text-h4 font-serif font-bold text-foreground">
                  Create New Session
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            
            <div className={cardStyles.content}>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-small font-medium text-muted-foreground mb-2">
                      Session Mode
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNewSession({ ...newSession, mode: 'live' })}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-md border-2 font-medium transition-all",
                          newSession.mode === 'live'
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground"
                        )}
                      >
                        <Activity className="h-4 w-4 inline mr-2" />
                        Live
                      </button>
                      <button
                        onClick={() => setNewSession({ ...newSession, mode: 'replay' })}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-md border-2 font-medium transition-all",
                          newSession.mode === 'replay'
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground"
                        )}
                      >
                        <RefreshCw className="h-4 w-4 inline mr-2" />
                        Replay
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-small font-medium text-muted-foreground mb-2">
                      Starting Bankroll
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={newSession.bankroll}
                        onChange={(e) => setNewSession({ ...newSession, bankroll: parseInt(e.target.value) })}
                        className={cn(inputStyles.base, "pl-10")}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-small font-medium text-muted-foreground mb-2">
                      VaR Limit (95% confidence)
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={newSession.varLimit}
                        onChange={(e) => setNewSession({ ...newSession, varLimit: parseInt(e.target.value) })}
                        className={cn(inputStyles.base, "pl-10")}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-small font-medium text-muted-foreground mb-2">
                      Max Players
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={newSession.maxPlayers}
                        onChange={(e) => setNewSession({ ...newSession, maxPlayers: parseInt(e.target.value) })}
                        min="1"
                        max="25"
                        className={cn(inputStyles.base, "pl-10")}
                      />
                    </div>
                  </div>
                </div>

                {newSession.mode === 'replay' && (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border animate-fade-in">
                    <div>
                      <label className="block text-small font-medium text-muted-foreground mb-2">
                        Replay Date
                      </label>
                      <input
                        type="date"
                        value={newSession.replayDay}
                        onChange={(e) => setNewSession({ ...newSession, replayDay: e.target.value })}
                        className={inputStyles.base}
                      />
                    </div>
                    <div>
                      <label className="block text-small font-medium text-muted-foreground mb-2">
                        Replay Speed
                      </label>
                      <select
                        value={newSession.replaySpeed}
                        onChange={(e) => setNewSession({ ...newSession, replaySpeed: parseInt(e.target.value) })}
                        className={inputStyles.base}
                      >
                        <option value="1">1x (Real-time)</option>
                        <option value="2">2x</option>
                        <option value="4">4x</option>
                        <option value="8">8x</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className={cn(
                      buttonStyles.base,
                      buttonStyles.variants.outline,
                      buttonStyles.sizes.default,
                      "flex-1"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createSession}
                    disabled={loading}
                    className={cn(
                      buttonStyles.base,
                      buttonStyles.variants.default,
                      buttonStyles.sizes.default,
                      "flex-1 shadow-medium",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Session
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}