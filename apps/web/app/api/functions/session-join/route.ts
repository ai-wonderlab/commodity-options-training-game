import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { sessionCode, displayName, ssoUserId } = await request.json();

    // Validate inputs
    if (!sessionCode || !displayName || !ssoUserId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If Supabase not configured, return mock response
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({
        participantId: `PARTICIPANT-${Date.now()}`,
        sessionId: sessionCode,
        seatNumber: Math.floor(Math.random() * 25) + 1,
        message: `Joined session ${sessionCode} as ${displayName}`
      });
    }

    // Find session by code (using session ID prefix)
    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .ilike('id', `${sessionCode}%`)
      .eq('is_active', true)
      .limit(1);

    if (sessionError || !sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: 'Session not found or inactive' },
        { status: 404 }
      );
    }

    const session = sessions[0];

    // Check if user already joined
    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('*')
      .eq('session_id', session.id)
      .eq('sso_user_id', ssoUserId)
      .single();

    if (existingParticipant) {
      // User already joined, return existing participant
      return NextResponse.json({
        participantId: existingParticipant.id,
        sessionId: session.id,
        seatNumber: existingParticipant.seat_no,
        message: `Welcome back ${existingParticipant.display_name}!`
      });
    }

    // Get next available seat number
    const { data: participants } = await supabase
      .from('participants')
      .select('seat_no')
      .eq('session_id', session.id)
      .order('seat_no', { ascending: false })
      .limit(1);

    const nextSeatNo = participants && participants.length > 0 
      ? participants[0].seat_no + 1 
      : 1;

    // Check if session is full (max 25 players)
    if (nextSeatNo > 25) {
      return NextResponse.json(
        { error: 'Session is full (max 25 players)' },
        { status: 400 }
      );
    }

    // Create new participant
    const { data: newParticipant, error: insertError } = await supabase
      .from('participants')
      .insert({
        session_id: session.id,
        display_name: displayName,
        seat_no: nextSeatNo,
        sso_user_id: ssoUserId,
        is_instructor: false,
        initial_bankroll: session.bankroll || 100000,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Participant insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to join session' },
        { status: 500 }
      );
    }

    // Initialize leaderboard entry
    await supabase
      .from('leaderboard')
      .insert({
        session_id: session.id,
        participant_id: newParticipant.id,
        pnl: 0,
        score: session.bankroll || 100000,
        drawdown: 0,
        penalties: 0,
        updated_at: new Date().toISOString()
      })
      .single();

    // Return success response
    return NextResponse.json({
      participantId: newParticipant.id,
      sessionId: session.id,
      seatNumber: newParticipant.seat_no,
      message: `Welcome ${displayName}! You are player #${nextSeatNo}`
    });

  } catch (error) {
    console.error('Session join error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}