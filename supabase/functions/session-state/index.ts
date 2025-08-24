import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get session ID from query params or body
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('id') || (await req.json()).id;
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch comprehensive session state
    const [session, participants, leaderboard, positions, latestTicks, greeks] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('participants').select('*').eq('session_id', sessionId),
      supabase.from('leaderboard').select('*').eq('session_id', sessionId).order('rank'),
      supabase.from('positions').select('*, participant:participants(*)').eq('participant_id.session_id', sessionId),
      supabase.from('ticks').select('*').order('ts', { ascending: false }).limit(50),
      supabase.from('greek_snapshots').select('*').order('ts', { ascending: false }).limit(100)
    ]);

    const response = {
      session: session.data,
      participants: participants.data,
      leaderboard: leaderboard.data,
      positions: positions.data,
      limits: session.data?.var_limit,
      ticksLatest: latestTicks.data,
      greekSnapshots: greeks.data
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
