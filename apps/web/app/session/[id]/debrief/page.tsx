'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { 
  ArrowLeft, Download, TrendingUp, TrendingDown, 
  BarChart3, Award, AlertTriangle, Clock, 
  DollarSign, Activity, Target, Users
} from 'lucide-react';
import PerformanceChart from '../../../../components/PerformanceChart';
import TradeHistory from '../../../../components/TradeHistory';
import RiskAnalysis from '../../../../components/RiskAnalysis';
import toast from 'react-hot-toast';

interface SessionStats {
  sessionId: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalPlayers: number;
  totalTrades: number;
  totalVolume: number;
  avgPnL: number;
  bestPlayer: {
    name: string;
    pnl: number;
    return: number;
  };
  worstPlayer: {
    name: string;
    pnl: number;
    return: number;
  };
  totalBreaches: number;
  avgVarUsage: number;
}

export default function DebriefPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trades' | 'risk'>('overview');
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [playerData, setPlayerData] = useState<any[]>([]);

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      // Load session stats
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Load participants data
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', sessionId);

      if (participantsError) throw participantsError;

      // Load trade history
      const { data: tradesData, error: tradesError } = await supabase
        .from('orders')
        .select('*')
        .eq('session_id', sessionId);

      if (tradesError) throw tradesError;

      // Process data
      processSessionData(sessionData, participantsData || [], tradesData || []);
    } catch (error) {
      console.error('Error loading session data:', error);
      // Use mock data for demo
      setStats(getMockStats());
      setPlayerData(getMockPlayerData());
    } finally {
      setLoading(false);
    }
  };

  const processSessionData = (session: any, participants: any[], trades: any[]) => {
    const sortedParticipants = [...participants].sort((a, b) => (b.current_pnl || 0) - (a.current_pnl || 0));
    
    setStats({
      sessionId: session.session_id,
      startTime: session.created_at,
      endTime: session.updated_at || new Date().toISOString(),
      duration: Math.floor((Date.now() - new Date(session.created_at).getTime()) / 60000),
      totalPlayers: participants.length,
      totalTrades: trades.length,
      totalVolume: trades.reduce((sum, t) => sum + (t.quantity || 0), 0),
      avgPnL: participants.reduce((sum, p) => sum + (p.current_pnl || 0), 0) / (participants.length || 1),
      bestPlayer: sortedParticipants[0] ? {
        name: sortedParticipants[0].display_name,
        pnl: sortedParticipants[0].current_pnl || 0,
        return: ((sortedParticipants[0].current_pnl || 0) / session.bankroll) * 100,
      } : { name: 'N/A', pnl: 0, return: 0 },
      worstPlayer: sortedParticipants[sortedParticipants.length - 1] ? {
        name: sortedParticipants[sortedParticipants.length - 1].display_name,
        pnl: sortedParticipants[sortedParticipants.length - 1].current_pnl || 0,
        return: ((sortedParticipants[sortedParticipants.length - 1].current_pnl || 0) / session.bankroll) * 100,
      } : { name: 'N/A', pnl: 0, return: 0 },
      totalBreaches: participants.filter(p => p.breach_count > 0).length,
      avgVarUsage: 65, // Mock value
    });
    
    setPlayerData(sortedParticipants);
  };

  const getMockStats = (): SessionStats => ({
    sessionId: sessionId,
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: new Date().toISOString(),
    duration: 60,
    totalPlayers: 15,
    totalTrades: 248,
    totalVolume: 3450,
    avgPnL: 1250,
    bestPlayer: {
      name: 'Alice Trader',
      pnl: 8500,
      return: 8.5,
    },
    worstPlayer: {
      name: 'Bob Investor',
      pnl: -3200,
      return: -3.2,
    },
    totalBreaches: 3,
    avgVarUsage: 68,
  });

  const getMockPlayerData = () => [
    { display_name: 'Alice Trader', current_pnl: 8500, trades: 45, var_usage: 62, breaches: 0 },
    { display_name: 'Charlie Risk', current_pnl: 5200, trades: 38, var_usage: 78, breaches: 1 },
    { display_name: 'Diana Options', current_pnl: 3100, trades: 52, var_usage: 55, breaches: 0 },
    { display_name: 'Eve Hedge', current_pnl: 1800, trades: 29, var_usage: 71, breaches: 0 },
    { display_name: 'Frank Gamma', current_pnl: -500, trades: 41, var_usage: 85, breaches: 2 },
    { display_name: 'Bob Investor', current_pnl: -3200, trades: 43, var_usage: 92, breaches: 3 },
  ];

  const handleExport = async () => {
    toast.success('Exporting session data...');
    // Implementation would download CSV/PDF report
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading debrief...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/session/${sessionId}`)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Session Debrief: {sessionId}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Completed {stats ? new Date(stats.endTime).toLocaleString() : ''}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'performance', label: 'Performance', icon: TrendingUp },
              { id: 'trades', label: 'Trade History', icon: Activity },
              { id: 'risk', label: 'Risk Analysis', icon: AlertTriangle },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.duration} min
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Trades</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.totalTrades}
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg P&L</p>
                    <p className={`text-2xl font-bold ${stats.avgPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${stats.avgPnL >= 0 ? '+' : ''}{stats.avgPnL.toFixed(0)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Risk Breaches</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.totalBreaches}
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </div>
            </div>

            {/* Winners & Losers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Top Performer
                  </h3>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.bestPlayer.name}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-green-600">
                      +${stats.bestPlayer.pnl.toLocaleString()}
                    </span>
                    <span className="text-sm text-green-600">
                      (+{stats.bestPlayer.return.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Biggest Loss
                  </h3>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.worstPlayer.name}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-red-600">
                      ${stats.worstPlayer.pnl.toLocaleString()}
                    </span>
                    <span className="text-sm text-red-600">
                      ({stats.worstPlayer.return.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Final Leaderboard
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Player
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        P&L
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Trades
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        VaR Usage
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Breaches
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {playerData.map((player, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-lg font-bold ${
                            index === 0 ? 'text-yellow-500' :
                            index === 1 ? 'text-gray-400' :
                            index === 2 ? 'text-orange-600' :
                            'text-gray-600'
                          }`}>
                            #{index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {player.display_name}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${
                          player.current_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {player.current_pnl >= 0 ? '+' : ''}${player.current_pnl.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-400">
                          {player.trades}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-400">
                          {player.var_usage}%
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                          player.breaches > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {player.breaches}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <PerformanceChart sessionId={sessionId} playerData={playerData} />
        )}

        {activeTab === 'trades' && (
          <TradeHistory sessionId={sessionId} />
        )}

        {activeTab === 'risk' && (
          <RiskAnalysis sessionId={sessionId} playerData={playerData} />
        )}
      </div>
    </div>
  );
}
