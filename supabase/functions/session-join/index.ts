import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface JoinSessionRequest {
  sessionId: string;
  display_name: string;
}

interface JoinSessionResponse {
  participantId: string;
  seat_no: number;
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

    const requestBody: JoinSessionRequest = await req.json();

    // Validate required fields
    if (!requestBody.sessionId || !requestBody.display_name) {
      return new Response(
        JSON.stringify({ error: 'sessionId and display_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, is_active, bankroll')
      .eq('id', requestBody.sessionId)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found or not active' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already a participant
    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('id, seat_no')
      .eq('session_id', requestBody.sessionId)
      .eq('sso_user_id', user.id)
      .single();

    if (existingParticipant) {
      return new Response(
        JSON.stringify({
          participantId: existingParticipant.id,
          seat_no: existingParticipant.seat_no,
          message: 'Already joined this session'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get next seat number
    const { data: participants } = await supabase
      .from('participants')
      .select('seat_no')
      .eq('session_id', requestBody.sessionId)
      .order('seat_no', { ascending: false })
      .limit(1);

    const nextSeatNo = participants && participants.length > 0 ? participants[0].seat_no + 1 : 1;

    // Check seat limit (max 25 players per session)
    if (nextSeatNo > 25) {
      return new Response(
        JSON.stringify({ error: 'Session is full (maximum 25 participants)' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create participant
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        session_id: requestBody.sessionId,
        display_name: requestBody.display_name,
        seat_no: nextSeatNo,
        sso_user_id: user.id,
        is_instructor: false,
        initial_bankroll: session.bankroll
      })
      .select('id, seat_no')
      .single();

    if (participantError) {
      console.error('Participant creation error:', participantError);
      return new Response(
        JSON.stringify({ error: 'Failed to join session', details: participantError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize leaderboard entry
    const { error: leaderboardError } = await supabase
      .from('leaderboard')
      .insert({
        session_id: requestBody.sessionId,
        participant_id: participant.id,
        pnl: 0,
        score: 1000, // Base score
        drawdown: 0,
        penalties: 0
      });

    if (leaderboardError) {
      console.error('Leaderboard initialization error:', leaderboardError);
    }

    const response: JoinSessionResponse = {
      participantId: participant.id,
      seat_no: participant.seat_no,
      message: 'Successfully joined session'
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
