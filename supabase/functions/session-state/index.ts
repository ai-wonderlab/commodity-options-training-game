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
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get participants
    const { data: participants } = await supabase
      .from('participants')
      .select('*')
      .eq('session_id', sessionId)
      .order('seat_no');

    // Get leaderboard
    const { data: leaderboard } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('session_id', sessionId)
      .order('score', { ascending: false });

    // Get all positions for session
    const participantIds = participants?.map(p => p.id) || [];
    const { data: positions } = await supabase
      .from('positions')
      .select('*')
      .in('participant_id', participantIds);

    // Get latest ticks
    const { data: ticksLatest } = await supabase
      .from('ticks')
      .select('*')
      .order('ts', { ascending: false })
      .limit(10);

    // Get risk limits from session config
    const limits = {
      delta: session.var_limit * 0.2,
      gamma: session.var_limit * 0.02,
      vega: session.var_limit * 0.1,
      theta: -session.var_limit * 0.04,
      var: session.var_limit
    };

    const response = {
      session,
      participants,
      leaderboard,
      positions,
      limits,
      ticksLatest
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Session state error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get session state', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
