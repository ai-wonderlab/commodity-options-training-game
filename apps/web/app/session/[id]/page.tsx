'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import toast from 'react-hot-toast';
import OptionChain from '../../../components/OptionChain';
import OrderTicket from '../../../components/OrderTicket';
import PositionsTable from '../../../components/PositionsTable';
import RiskMeters from '../../../components/RiskMeters';
import Leaderboard from '../../../components/Leaderboard';
import MarketData from '../../../components/MarketData';

interface SessionData {
  session: any;
  participants: any[];
  leaderboard: any[];
  positions: any[];
  limits: any;
  ticksLatest: any[];
}

export default function SessionPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'ticket' | 'positions' | 'risk' | 'whatif'>('ticket');
  const [currentParticipant, setCurrentParticipant] = useState<any>(null);

  // Fetch session state
  const fetchSessionState = useCallback(async () => {
    try {
      const response = await fetch(`/api/functions/session-state?id=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch session state');
      }

      const data = await response.json();
      setSessionData(data);

      // Find current participant
      const { data: { user } } = await supabase.auth.getUser();
      const participant = data.participants?.find((p: any) => p.sso_user_id === user?.id);
      setCurrentParticipant(participant);
    } catch (error) {
      console.error('Error fetching session state:', error);
      toast.error('Failed to load session data');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Set up realtime subscription
  useEffect(() => {
    fetchSessionState();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leaderboard',
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        fetchSessionState();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        fetchSessionState();
      })
      .subscribe();

    // Polling fallback for ticks
    const interval = setInterval(fetchSessionState, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [sessionId, fetchSessionState]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="text-center">
          <p className="text-red-600">Session not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex">
      {/* Left Panel - Futures & Option Chain */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <MarketData ticks={sessionData.ticksLatest || {}} />
        <div className="flex-1 overflow-hidden">
          <OptionChain 
            instruments={sessionData.session?.instruments || []}
            ticks={sessionData.ticksLatest || {}}
          />
        </div>
      </div>

      {/* Center Panel - Trading & Portfolio */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setSelectedTab('ticket')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'ticket'
                  ? 'bg-white dark:bg-gray-800 border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Order Ticket
            </button>
            <button
              onClick={() => setSelectedTab('positions')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'positions'
                  ? 'bg-white dark:bg-gray-800 border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Positions
            </button>
            <button
              onClick={() => setSelectedTab('risk')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'risk'
                  ? 'bg-white dark:bg-gray-800 border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Risk
            </button>
            <button
              onClick={() => setSelectedTab('whatif')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'whatif'
                  ? 'bg-white dark:bg-gray-800 border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              What-If
            </button>
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-auto">
          {selectedTab === 'ticket' && (
            <OrderTicket 
              sessionId={sessionId}
              participantId={currentParticipant?.id}
              onOrderSubmitted={fetchSessionState}
            />
          )}
          {selectedTab === 'positions' && (
            <PositionsTable 
              positions={sessionData.positions.filter(p => p.participant_id === currentParticipant?.id)}
              currentPrices={sessionData.ticksLatest}
            />
          )}
          {selectedTab === 'risk' && (
            <RiskMeters 
              participantId={currentParticipant?.id}
              limits={sessionData.limits}
            />
          )}
          {selectedTab === 'whatif' && (
            <div className="text-center text-gray-500 py-8">
              What-If Analysis Coming Soon
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Leaderboard & Alerts */}
      <div className="w-1/4 border-l border-gray-200 dark:border-gray-700 flex flex-col">
        <Leaderboard 
          leaderboard={sessionData.leaderboard}
          participants={sessionData.participants}
          currentParticipantId={currentParticipant?.id}
        />
      </div>
    </div>
  );
}
