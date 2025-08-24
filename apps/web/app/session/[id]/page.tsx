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
// Live components for production
import MarketDataLive from '../../../components/MarketDataLive';
import LeaderboardLive from '../../../components/LeaderboardLive';
import OrderTicketLive from '../../../components/OrderTicketLive';
import PositionsTableLive from '../../../components/PositionsTableLive';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';

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
    <div className="h-[calc(100vh-80px)] flex gap-4 p-4 bg-background">
              {/* Left Panel - Futures & Option Chain */}
        <div className="w-1/3 flex flex-col gap-4">
          {isSupabaseConfigured() ? (
            <MarketDataLive sessionId={sessionId} symbol="BRN" />
          ) : (
            <MarketData ticks={Array.isArray(sessionData.ticksLatest) ? {} : sessionData.ticksLatest || {}} />
          )}
          <div className="flex-1 min-h-0">
            <OptionChain 
              instruments={sessionData.session?.instruments || []}
              ticks={Array.isArray(sessionData.ticksLatest) ? {} : sessionData.ticksLatest || {}}
            />
          </div>
        </div>

      {/* Center Panel - Trading & Portfolio */}
      <div className="flex-1 flex flex-col rounded-lg border bg-card shadow-soft overflow-hidden">
        <div className="border-b border-border bg-muted/30">
          <div className="flex p-1">
            <button
              onClick={() => setSelectedTab('ticket')}
              className={`flex-1 px-4 py-2 font-medium rounded-md transition-all ${
                selectedTab === 'ticket'
                  ? 'bg-background shadow-soft text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              Order Ticket
            </button>
            <button
              onClick={() => setSelectedTab('positions')}
              className={`flex-1 px-4 py-2 font-medium rounded-md transition-all ${
                selectedTab === 'positions'
                  ? 'bg-background shadow-soft text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              Positions
            </button>
            <button
              onClick={() => setSelectedTab('risk')}
              className={`flex-1 px-4 py-2 font-medium rounded-md transition-all ${
                selectedTab === 'risk'
                  ? 'bg-background shadow-soft text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              Risk
            </button>
            <button
              onClick={() => setSelectedTab('whatif')}
              className={`flex-1 px-4 py-2 font-medium rounded-md transition-all ${
                selectedTab === 'whatif'
                  ? 'bg-background shadow-soft text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              What-If
            </button>
          </div>
        </div>
        
        <div className="flex-1 p-6 overflow-auto">
                      {selectedTab === 'ticket' && (
              isSupabaseConfigured() ? (
                <OrderTicketLive 
                  sessionId={sessionId}
                  participantId={currentParticipant?.id}
                  onOrderSubmitted={fetchSessionState}
                />
              ) : (
                <OrderTicket 
                  sessionId={sessionId}
                  participantId={currentParticipant?.id}
                  onOrderSubmitted={fetchSessionState}
                />
              )
            )}
            {selectedTab === 'positions' && (
              isSupabaseConfigured() ? (
                <PositionsTableLive 
                  participantId={currentParticipant?.id}
                  sessionId={sessionId}
                />
              ) : (
                <PositionsTable 
                  positions={sessionData.positions.filter(p => p.participant_id === currentParticipant?.id)}
                  currentPrices={Array.isArray(sessionData.ticksLatest) ? sessionData.ticksLatest : []}
                />
              )
            )}
          {selectedTab === 'risk' && (
            <RiskMeters 
              participantId={currentParticipant?.id}
              limits={sessionData.limits}
            />
          )}
          {selectedTab === 'whatif' && (
            <div className="text-center text-muted-foreground py-8">
              What-If Analysis Coming Soon
            </div>
          )}
        </div>
      </div>

              {/* Right Panel - Leaderboard & Alerts */}
        <div className="w-1/4 flex flex-col">
          {isSupabaseConfigured() ? (
            <LeaderboardLive 
              sessionId={sessionId}
              currentParticipantId={currentParticipant?.id}
            />
          ) : (
            <Leaderboard 
              leaderboard={sessionData.leaderboard}
              participants={sessionData.participants}
              currentParticipantId={currentParticipant?.id}
            />
          )}
        </div>
    </div>
  );
}
