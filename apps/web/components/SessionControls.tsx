'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { 
  Play, 
  Pause, 
  Square,
  Snowflake,
  Users,
  Clock,
  BarChart3,
  Zap,
  Download,
  Settings,
  AlertCircle,
  CheckCircle,
  Calendar,
  ArrowRight
} from 'lucide-react';

interface SessionInfo {
  id: string;
  session_name: string;
  status: string;
  mode: string;
  max_participants: number;
  duration_minutes: number;
  start_at?: string;
  end_at?: string;
  is_multi_day: boolean;
  trading_days: number;
  current_day: number;
  data_config: any;
  risk_config: any;
  scoring_weights: any;
}

interface Participant {
  id: string;
  display_name: string;
  seat_no: number;
  is_instructor: boolean;
  current_score?: number;
  active_breaches?: number;
}

interface ShockConfig {
  priceChange: number;
  volChange: number;
  description: string;
}

interface SessionControlsProps {
  sessionId: string;
  isInstructor: boolean;
}

export default function SessionControls({ sessionId, isInstructor }: SessionControlsProps) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Shock controls
  const [showShockPanel, setShowShockPanel] = useState(false);
  const [shock, setShock] = useState<ShockConfig>({
    priceChange: 0,
    volChange: 0,
    description: ''
  });

  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (sessionId) {
      loadSessionData();
      
      // Set up real-time subscription for session updates
      const channel = supabase
        .channel(`session-controls:${sessionId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`
        }, () => {
          loadSessionData();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `session_id=eq.${sessionId}`
        }, () => {
          loadParticipants();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [sessionId]);

  // Update time remaining every minute
  useEffect(() => {
    const interval = setInterval(() => {
      updateTimeRemaining();
    }, 60000); // Every minute

    updateTimeRemaining(); // Initial update
    return () => clearInterval(interval);
  }, [session]);

  const loadSessionData = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSession(data);
      
      await loadParticipants();
    } catch (error: any) {
      console.error('Error loading session:', error);
      toast.error('Σφάλμα φόρτωσης συνεδρίας');
    } finally {
      setLoading(false);
    }
  };

  const loadParticipants = async () => {
    try {
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', sessionId)
        .order('seat_no');

      if (participantsError) throw participantsError;

      // Get scores and risk status
      const { data: leaderboard, error: leaderboardError } = await supabase
        .from('leaderboard')
        .select('participant_id, score')
        .eq('session_id', sessionId);

      const { data: riskStatus, error: riskError } = await supabase
        .from('participant_risk_status')
        .select('participant_id, active_breaches')
        .eq('session_id', sessionId);

      // Merge data
      const enrichedParticipants = participantsData.map(p => ({
        ...p,
        current_score: leaderboard?.find(l => l.participant_id === p.id)?.score || 0,
        active_breaches: riskStatus?.find(r => r.participant_id === p.id)?.active_breaches || 0
      }));

      setParticipants(enrichedParticipants);
    } catch (error: any) {
      console.error('Error loading participants:', error);
    }
  };

  const updateTimeRemaining = () => {
    if (!session || !session.start_at || session.status !== 'active') {
      setTimeRemaining(0);
      return;
    }

    const startTime = new Date(session.start_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / (1000 * 60)); // minutes
    const remaining = Math.max(0, session.duration_minutes - elapsed);
    
    setTimeRemaining(remaining);

    // Auto-complete session when time is up
    if (remaining === 0 && session.status === 'active' && isInstructor) {
      updateSessionStatus('completed');
    }
  };

  const updateSessionStatus = async (newStatus: string) => {
    if (!isInstructor) return;

    setActionLoading(newStatus);
    try {
      const response = await fetch('/api/functions/session-update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          status: newStatus
        }),
      });

      if (!response.ok) {
        throw new Error('Αποτυχία ενημέρωσης κατάστασης');
      }

      const statusLabels: Record<string, string> = {
        'active': 'ενεργοποιήθηκε',
        'paused': 'παύθηκε',
        'frozen': 'παγώθηκε',
        'completed': 'ολοκληρώθηκε',
        'cancelled': 'ακυρώθηκε'
      };

      toast.success(`Η συνεδρία ${statusLabels[newStatus] || 'ενημερώθηκε'}`);
      await loadSessionData();
    } catch (error: any) {
      toast.error(error.message || 'Σφάλμα ενημέρωσης κατάστασης');
    } finally {
      setActionLoading(null);
    }
  };

  const applyShock = async () => {
    if (!isInstructor || !shock.priceChange && !shock.volChange) return;

    setActionLoading('shock');
    try {
      const response = await fetch('/api/functions/host-shock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          priceChangePercent: shock.priceChange,
          volChangePoints: shock.volChange,
          description: shock.description || 'Market Shock'
        }),
      });

      if (!response.ok) {
        throw new Error('Αποτυχία εφαρμογής shock');
      }

      toast.success(`Market shock εφαρμόστηκε: ${shock.priceChange > 0 ? '+' : ''}${shock.priceChange}% τιμή, ${shock.volChange > 0 ? '+' : ''}${shock.volChange} pts vol`);
      
      setShock({ priceChange: 0, volChange: 0, description: '' });
      setShowShockPanel(false);
    } catch (error: any) {
      toast.error(error.message || 'Σφάλμα εφαρμογής shock');
    } finally {
      setActionLoading(null);
    }
  };

  const nextDay = async () => {
    if (!isInstructor || !session?.is_multi_day) return;

    setActionLoading('next-day');
    try {
      const response = await fetch('/api/functions/session-next-day', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('Αποτυχία μετάβασης στην επόμενη ημέρα');
      }

      toast.success(`Μετάβαση στην ημέρα ${session.current_day + 1}`);
      await loadSessionData();
    } catch (error: any) {
      toast.error(error.message || 'Σφάλμα μετάβασης ημέρας');
    } finally {
      setActionLoading(null);
    }
  };

  const exportData = async (type: 'trades' | 'leaderboard' | 'risk') => {
    if (!isInstructor) return;

    try {
      const response = await fetch('/api/functions/export-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          exportType: type
        }),
      });

      if (!response.ok) {
        throw new Error('Αποτυχία εξαγωγής δεδομένων');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${session?.session_name}-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Εξαγωγή ${type} ολοκληρώθηκε`);
    } catch (error: any) {
      toast.error(error.message || 'Σφάλμα εξαγωγής');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Συνεδρία δεν βρέθηκε</p>
      </div>
    );
  }

  const statusColor = {
    'setup': 'gray',
    'waiting': 'yellow',
    'active': 'green',
    'paused': 'orange',
    'frozen': 'red',
    'completed': 'blue',
    'cancelled': 'gray'
  }[session.status] || 'gray';

  const statusIcon = {
    'setup': Settings,
    'waiting': Clock,
    'active': Play,
    'paused': Pause,
    'frozen': Snowflake,
    'completed': CheckCircle,
    'cancelled': Square
  }[session.status] || Settings;

  const StatusIcon = statusIcon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {session.session_name}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                statusColor === 'green' ? 'bg-green-100 text-green-800' :
                statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                statusColor === 'red' ? 'bg-red-100 text-red-800' :
                statusColor === 'blue' ? 'bg-blue-100 text-blue-800' :
                statusColor === 'orange' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                <StatusIcon className="w-4 h-4" />
                {session.status.toUpperCase()}
              </div>
              
              {session.is_multi_day && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  Ημέρα {session.current_day} από {session.trading_days}
                </div>
              )}
              
              {session.status === 'active' && timeRemaining > 0 && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <Clock className="w-4 h-4" />
                  Απομένουν: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Users className="w-4 h-4" />
              {participants.length}/{session.max_participants}
            </div>
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Συμμετέχοντες</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {participants.map(participant => (
            <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  participant.is_instructor 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {participant.is_instructor ? 'I' : participant.seat_no}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {participant.display_name}
                    {participant.is_instructor && ' (Instructor)'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Score: ${participant.current_score?.toLocaleString() || '0'}
                  </div>
                </div>
              </div>
              
              {participant.active_breaches > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">{participant.active_breaches}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Instructor Controls */}
      {isInstructor && (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Session Controls */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Έλεγχος Συνεδρίας</h4>
              
              {session.status === 'setup' && (
                <button
                  onClick={() => updateSessionStatus('waiting')}
                  disabled={participants.length < 2 || actionLoading === 'waiting'}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {actionLoading === 'waiting' ? 'Ενεργοποίηση...' : 'Ενεργοποίηση'}
                </button>
              )}
              
              {session.status === 'waiting' && (
                <button
                  onClick={() => updateSessionStatus('active')}
                  disabled={actionLoading === 'active'}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {actionLoading === 'active' ? 'Έναρξη...' : 'Έναρξη Συνεδρίας'}
                </button>
              )}
              
              {session.status === 'active' && (
                <>
                  <button
                    onClick={() => updateSessionStatus('paused')}
                    disabled={actionLoading === 'paused'}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    <Pause className="w-4 h-4" />
                    {actionLoading === 'paused' ? 'Παύση...' : 'Παύση'}
                  </button>
                  
                  <button
                    onClick={() => updateSessionStatus('frozen')}
                    disabled={actionLoading === 'frozen'}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <Snowflake className="w-4 h-4" />
                    {actionLoading === 'frozen' ? 'Πάγωμα...' : 'Πάγωμα'}
                  </button>
                </>
              )}
              
              {session.status === 'paused' && (
                <button
                  onClick={() => updateSessionStatus('active')}
                  disabled={actionLoading === 'active'}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {actionLoading === 'active' ? 'Συνέχιση...' : 'Συνέχιση'}
                </button>
              )}
              
              {['active', 'paused'].includes(session.status) && (
                <button
                  onClick={() => updateSessionStatus('completed')}
                  disabled={actionLoading === 'completed'}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {actionLoading === 'completed' ? 'Τερματισμός...' : 'Τερματισμός'}
                </button>
              )}
            </div>

            {/* Market Shocks */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Market Shocks</h4>
              
              <button
                onClick={() => setShowShockPanel(!showShockPanel)}
                disabled={!['active', 'paused'].includes(session.status)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                Custom Shock
              </button>
              
              {/* Quick Shock Presets */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShock({ priceChange: 5, volChange: 5, description: 'Bull Rally' });
                    applyShock();
                  }}
                  disabled={!['active', 'paused'].includes(session.status) || actionLoading === 'shock'}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                >
                  Bull +5%
                </button>
                <button
                  onClick={() => {
                    setShock({ priceChange: -5, volChange: 10, description: 'Bear Crash' });
                    applyShock();
                  }}
                  disabled={!['active', 'paused'].includes(session.status) || actionLoading === 'shock'}
                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                >
                  Bear -5%
                </button>
              </div>
            </div>

            {/* Multi-Day Controls */}
            {session.is_multi_day && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white">Πολυήμερη Συνεδρία</h4>
                
                {session.current_day < session.trading_days && session.status === 'active' && (
                  <button
                    onClick={nextDay}
                    disabled={actionLoading === 'next-day'}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    <ArrowRight className="w-4 h-4" />
                    {actionLoading === 'next-day' ? 'Επόμενη ημέρα...' : 'Επόμενη ημέρα'}
                  </button>
                )}
                
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Πρόοδος: {session.current_day}/{session.trading_days} ημέρες
                </div>
              </div>
            )}

            {/* Export Controls */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Εξαγωγή Δεδομένων</h4>
              
              <button
                onClick={() => exportData('trades')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                Trades CSV
              </button>
              
              <button
                onClick={() => exportData('leaderboard')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                Scores CSV
              </button>
              
              <button
                onClick={() => exportData('risk')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                Risk CSV
              </button>
            </div>
          </div>

          {/* Shock Panel */}
          {showShockPanel && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-3">
                Προσαρμοσμένο Market Shock
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Μεταβολή Τιμής (%)
                  </label>
                  <input
                    type="number"
                    value={shock.priceChange}
                    onChange={(e) => setShock(prev => ({ ...prev, priceChange: parseFloat(e.target.value) || 0 }))}
                    step="0.5"
                    min="-50"
                    max="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Μεταβολή Vol (pts)
                  </label>
                  <input
                    type="number"
                    value={shock.volChange}
                    onChange={(e) => setShock(prev => ({ ...prev, volChange: parseFloat(e.target.value) || 0 }))}
                    step="1"
                    min="-20"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Περιγραφή
                  </label>
                  <input
                    type="text"
                    value={shock.description}
                    onChange={(e) => setShock(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="π.χ. Geopolitical Crisis"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={applyShock}
                  disabled={(!shock.priceChange && !shock.volChange) || actionLoading === 'shock'}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  {actionLoading === 'shock' ? 'Εφαρμογή...' : 'Εφαρμογή Shock'}
                </button>
                
                <button
                  onClick={() => setShowShockPanel(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Ακύρωση
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Non-instructor view */}
      {!isInstructor && (
        <div className="p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p>Περιμένετε οδηγίες από τον εκπαιδευτή</p>
            {session.status === 'waiting' && (
              <p className="mt-2 font-medium">Η συνεδρία θα ξεκινήσει σύντομα...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}