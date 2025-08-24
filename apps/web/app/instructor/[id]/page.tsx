'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { 
  Play, Pause, RotateCcw, Download, AlertTriangle, 
  TrendingUp, TrendingDown, Activity, Users, 
  Zap, Clock, DollarSign, BarChart3, ArrowLeft 
} from 'lucide-react';
import toast from 'react-hot-toast';
import ShockControls from '../../../components/ShockControls';
import PlayerMonitor from '../../../components/PlayerMonitor';
import SessionControls from '../../../components/SessionControls';

interface SessionData {
  id: string;
  session_id: string;
  mode: 'live' | 'replay';
  status: 'setup' | 'active' | 'paused' | 'completed';
  bankroll: number;
  var_limit: number;
  max_players: number;
  replay_day?: string;
  replay_speed?: number;
  created_at: string;
}

interface Player {
  id: string;
  display_name: string;
  bankroll: number;
  current_pnl: number;
  var_usage: number;
  greeks: {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
  };
  positions: number;
  breaches: number;
  status: 'active' | 'inactive' | 'breached';
}

export default function InstructorDashboard() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [spotPrice, setSpotPrice] = useState(82.50);
  const [totalVolume, setTotalVolume] = useState(0);

  useEffect(() => {
    loadSession();
    loadPlayers();
    
    // Subscribe to real-time updates
    const sessionChannel = supabase
      .channel(`instructor-session-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `session_id=eq.${sessionId}`
      }, () => {
        loadSession();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `session_id=eq.${sessionId}`
      }, () => {
        loadPlayers();
      })
      .subscribe();

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Simulate price updates
    const priceInterval = setInterval(() => {
      setSpotPrice(prev => {
        const change = (Math.random() - 0.5) * 0.1;
        return Math.max(70, Math.min(95, prev + change));
      });
      setTotalVolume(prev => prev + Math.floor(Math.random() * 100));
    }, 5000);

    return () => {
      sessionChannel.unsubscribe();
      clearInterval(timeInterval);
      clearInterval(priceInterval);
    };
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;
      setSession(data);
    } catch (error) {
      console.error('Error loading session:', error);
      // Mock data for demo
      setSession({
        id: '1',
        session_id: sessionId,
        mode: 'live',
        status: 'active',
        bankroll: 100000,
        var_limit: 5000,
        max_players: 25,
        created_at: new Date().toISOString(),
      });
    }
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;
      
      // Transform to Player format
      const playersData = (data || []).map(p => ({
        id: p.id,
        display_name: p.display_name,
        bankroll: p.bankroll,
        current_pnl: p.current_pnl || 0,
        var_usage: Math.random() * 100,
        greeks: {
          delta: (Math.random() - 0.5) * 100,
          gamma: Math.random() * 10,
          vega: (Math.random() - 0.5) * 50,
          theta: -Math.random() * 20,
        },
        positions: Math.floor(Math.random() * 20),
        breaches: Math.floor(Math.random() * 3),
        status: p.status || 'active'
      }));
      
      setPlayers(playersData);
    } catch (error) {
      console.error('Error loading players:', error);
      // Mock data for demo
      setPlayers([
        {
          id: '1',
          display_name: 'Alice Trader',
          bankroll: 100000,
          current_pnl: 2500,
          var_usage: 45,
          greeks: { delta: 25, gamma: 2.5, vega: -15, theta: -8 },
          positions: 8,
          breaches: 0,
          status: 'active'
        },
        {
          id: '2',
          display_name: 'Bob Investor',
          bankroll: 100000,
          current_pnl: -1200,
          var_usage: 78,
          greeks: { delta: -40, gamma: 5.2, vega: 30, theta: -12 },
          positions: 12,
          breaches: 1,
          status: 'active'
        },
        {
          id: '3',
          display_name: 'Charlie Risk',
          bankroll: 100000,
          current_pnl: 5400,
          var_usage: 92,
          greeks: { delta: 60, gamma: 8.1, vega: -45, theta: -18 },
          positions: 15,
          breaches: 2,
          status: 'breached'
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionControl = async (action: 'start' | 'pause' | 'resume' | 'stop') => {
    try {
      let newStatus = session?.status;
      
      switch (action) {
        case 'start':
          newStatus = 'active';
          break;
        case 'pause':
          newStatus = 'paused';
          break;
        case 'resume':
          newStatus = 'active';
          break;
        case 'stop':
          newStatus = 'completed';
          break;
      }

      const { error } = await supabase
        .from('sessions')
        .update({ status: newStatus })
        .eq('session_id', sessionId);

      if (error) throw error;
      
      toast.success(`Session ${action}ed successfully`);
      loadSession();
    } catch (error) {
      console.error(`Error ${action}ing session:`, error);
      toast.error(`Failed to ${action} session`);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/functions/export-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${sessionId}-${Date.now()}.csv`;
      a.click();
      
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Export failed - using mock data');
      
      // Mock CSV download
      const csvContent = `Player,PnL,VaR Usage,Delta,Gamma,Vega,Theta,Positions,Breaches
Alice Trader,2500,45%,25,2.5,-15,-8,8,0
Bob Investor,-1200,78%,-40,5.2,30,-12,12,1
Charlie Risk,5400,92%,60,8.1,-45,-18,15,2`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${sessionId}-${Date.now()}.csv`;
      a.click();
    }
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading session...</div>
      </div>
    );
  }

  // Calculate aggregate stats
  const totalPnL = players.reduce((sum, p) => sum + p.current_pnl, 0);
  const avgVarUsage = players.reduce((sum, p) => sum + p.var_usage, 0) / (players.length || 1);
  const totalBreaches = players.reduce((sum, p) => sum + p.breaches, 0);
  const activePlayers = players.filter(p => p.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/instructor')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Session: {session.session_id}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {currentTime.toLocaleTimeString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="w-4 h-4" />
                    {session.mode}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    session.status === 'active' ? 'bg-green-100 text-green-600' :
                    session.status === 'paused' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {session.status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <SessionControls 
                session={session}
                onControl={handleSessionControl}
              />
              <button
                onClick={handleExport}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title="Export Data"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Market Stats Bar */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div>
                <span className="text-xs opacity-75">BRN Spot</span>
                <div className="text-xl font-bold">${spotPrice.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-xs opacity-75">Total Volume</span>
                <div className="text-xl font-bold">{totalVolume.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-xs opacity-75">Active Players</span>
                <div className="text-xl font-bold">{activePlayers}/{session.max_players}</div>
              </div>
              <div>
                <span className="text-xs opacity-75">Total P&L</span>
                <div className={`text-xl font-bold ${totalPnL >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  ${totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Player Monitor (2 cols) */}
          <div className="lg:col-span-2">
            <PlayerMonitor players={players} />
          </div>
          
          {/* Right: Controls & Stats */}
          <div className="space-y-6">
            {/* Risk Overview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Risk Overview
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg VaR Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          avgVarUsage > 80 ? 'bg-red-500' :
                          avgVarUsage > 60 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${avgVarUsage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{avgVarUsage.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Breaches</span>
                  <span className={`text-sm font-medium ${totalBreaches > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalBreaches}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">At Risk</span>
                  <span className="text-sm font-medium text-yellow-600">
                    {players.filter(p => p.var_usage > 80).length} players
                  </span>
                </div>
              </div>
            </div>
            
            {/* Shock Controls */}
            <ShockControls sessionId={sessionId} />
            
            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm">Send Risk Warning</span>
                </button>
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">Reset Positions</span>
                </button>
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span className="text-sm">View Analytics</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
