'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Users, TrendingUp, AlertTriangle, Play, Pause, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

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
          session_id: 'DEMO-001',
          mode: 'live',
          status: 'active',
          bankroll: 100000,
          var_limit: 5000,
          max_players: 25,
          current_players: 12,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          session_id: 'DEMO-002',
          mode: 'replay',
          status: 'paused',
          bankroll: 50000,
          var_limit: 2500,
          max_players: 10,
          current_players: 8,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      setLoading(true);
      
      // Generate session ID
      const sessionId = `ICE-${Date.now().toString(36).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          session_id: sessionId,
          mode: newSession.mode,
          status: 'setup',
          bankroll: newSession.bankroll,
          var_limit: newSession.varLimit,
          max_players: newSession.maxPlayers,
          replay_day: newSession.replayDay || null,
          replay_speed: newSession.replaySpeed,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Session ${sessionId} created!`);
      setShowCreateModal(false);
      router.push(`/instructor/${sessionId}`);
    } catch (error: any) {
      console.error('Error creating session:', error);
      // Fallback for demo
      const demoId = `DEMO-${Date.now().toString(36).toUpperCase()}`;
      toast.success(`Demo session ${demoId} created!`);
      setShowCreateModal(false);
      router.push(`/instructor/${demoId}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'paused': return 'text-yellow-600 bg-yellow-100';
      case 'completed': return 'text-gray-600 bg-gray-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'completed': return <AlertTriangle className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Instructor Console
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage training sessions for ICE Brent Options
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Session
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {sessions.filter(s => s.status === 'active').length}
              </p>
            </div>
            <Play className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Players</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {sessions.reduce((sum, s) => sum + s.current_players, 0)}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Bankroll</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${(sessions.reduce((sum, s) => sum + s.bankroll, 0) / (sessions.length || 1) / 1000).toFixed(0)}k
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Risk Breaches</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.floor(Math.random() * 5)}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sessions
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Session ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Players
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Bankroll
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  VaR Limit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Loading sessions...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No sessions found. Create your first session!
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-900 dark:text-white">
                        {session.session_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                        {getStatusIcon(session.status)}
                        {session.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {session.mode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {session.current_players}/{session.max_players}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      ${(session.bankroll / 1000).toFixed(0)}k
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      ${(session.var_limit / 1000).toFixed(1)}k
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(session.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/instructor/${session.session_id}`)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Session
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mode
                </label>
                <select
                  value={newSession.mode}
                  onChange={(e) => setNewSession({ ...newSession, mode: e.target.value as 'live' | 'replay' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="live">Live Trading</option>
                  <option value="replay">Historical Replay</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Starting Bankroll
                </label>
                <input
                  type="number"
                  value={newSession.bankroll}
                  onChange={(e) => setNewSession({ ...newSession, bankroll: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  VaR Limit
                </label>
                <input
                  type="number"
                  value={newSession.varLimit}
                  onChange={(e) => setNewSession({ ...newSession, varLimit: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Players
                </label>
                <input
                  type="number"
                  value={newSession.maxPlayers}
                  onChange={(e) => setNewSession({ ...newSession, maxPlayers: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {newSession.mode === 'replay' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Replay Date
                    </label>
                    <input
                      type="date"
                      value={newSession.replayDay}
                      onChange={(e) => setNewSession({ ...newSession, replayDay: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Replay Speed
                    </label>
                    <select
                      value={newSession.replaySpeed}
                      onChange={(e) => setNewSession({ ...newSession, replaySpeed: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="0.5">0.5x</option>
                      <option value="1">1x</option>
                      <option value="2">2x</option>
                      <option value="5">5x</option>
                      <option value="10">10x</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
