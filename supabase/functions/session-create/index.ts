import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CreateSessionRequest {
  mode: 'live' | 'replay';
  instruments?: string[];
  bankroll?: number;
  spread_config?: Record<string, any>;
  fee_config?: Record<string, any>;
  var_limit?: number;
  scoring_weights?: Record<string, any>;
  data_source?: 'mock' | 'refinitiv' | 'ice';
  replay_day?: string;
  replay_speed?: number;
}

interface CreateSessionResponse {
  sessionId: string;
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody: CreateSessionRequest = await req.json();

    // Validate required fields
    if (!requestBody.mode || !['live', 'replay'].includes(requestBody.mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode. Must be "live" or "replay"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get default instrument configuration
    const { data: instrumentsData } = await supabase.rpc('get_brent_instruments');
    
    // Get default configurations
    const { data: defaultSpread } = await supabase.rpc('get_default_spread_config');
    const { data: defaultFees } = await supabase.rpc('get_default_fee_config');
    const { data: defaultWeights } = await supabase.rpc('get_default_scoring_weights');

    // Create the session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        mode: requestBody.mode,
        instruments: requestBody.instruments || instrumentsData,
        bankroll: requestBody.bankroll || 100000,
        spread_config: requestBody.spread_config || defaultSpread,
        fee_config: requestBody.fee_config || defaultFees,
        var_limit: requestBody.var_limit || 5000,
        scoring_weights: requestBody.scoring_weights || defaultWeights,
        data_source: requestBody.data_source || 'mock',
        replay_day: requestBody.replay_day || null,
        replay_speed: requestBody.replay_speed || 1,
        instructor_user_id: user.id
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto-join the instructor as the first participant
    const { error: participantError } = await supabase
      .from('participants')
      .insert({
        session_id: session.id,
        display_name: user.user_metadata?.full_name || user.email || 'Instructor',
        seat_no: 1,
        sso_user_id: user.id,
        is_instructor: true,
        initial_bankroll: requestBody.bankroll || 100000
      });

    if (participantError) {
      console.error('Participant creation error:', participantError);
      // Continue anyway - session is created
    }

    // Initialize leaderboard entry
    const { error: leaderboardError } = await supabase
      .from('leaderboard')
      .insert({
        session_id: session.id,
        participant_id: (await supabase
          .from('participants')
          .select('id')
          .eq('session_id', session.id)
          .eq('sso_user_id', user.id)
          .single()).data?.id,
        pnl: 0,
        score: requestBody.scoring_weights?.base_score || 1000,
        drawdown: 0,
        penalties: 0,
        rank: 1
      });

    if (leaderboardError) {
      console.error('Leaderboard initialization error:', leaderboardError);
    }

    const response: CreateSessionResponse = {
      sessionId: session.id,
      message: `${requestBody.mode} session created successfully`
    };

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
