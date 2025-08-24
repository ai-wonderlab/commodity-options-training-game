import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface StatusUpdateRequest {
  sessionId: string;
  status: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Parse request
    const { sessionId, status } = await req.json() as StatusUpdateRequest

    // Validate auth
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    
    if (!user) {
      throw new Error('Μη εξουσιοδοτημένη πρόσβαση')
    }

    // Get current session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('instructor_user_id, status, max_participants')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Συνεδρία δεν βρέθηκε')
    }

    if (session.instructor_user_id !== user.id) {
      throw new Error('Μόνο ο εκπαιδευτής μπορεί να αλλάξει την κατάσταση της συνεδρίας')
    }

    // Validate status transitions
    const currentStatus = session.status
    const validTransitions: Record<string, string[]> = {
      'setup': ['waiting', 'cancelled'],
      'waiting': ['active', 'cancelled'],
      'active': ['paused', 'frozen', 'completed', 'cancelled'],
      'paused': ['active', 'completed', 'cancelled'],
      'frozen': ['active', 'cancelled'],
      'completed': [], // Final state
      'cancelled': []  // Final state
    }

    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new Error(`Μη έγκυρη μετάβαση από ${currentStatus} σε ${status}`)
    }

    // Additional validations
    if (status === 'active') {
      // Check minimum participants
      const { count: participantCount, error: countError } = await supabaseAdmin
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)

      if (countError) {
        throw new Error('Αποτυχία ελέγχου συμμετεχόντων')
      }

      if ((participantCount || 0) < 2) {
        throw new Error('Απαιτούνται τουλάχιστον 2 συμμετέχοντες για έναρξη συνεδρίας')
      }
    }

    // Update session status
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    // Set timestamps based on status
    if (status === 'active' && currentStatus !== 'paused') {
      // Starting for first time
      updateData.start_at = new Date().toISOString()
    }

    if (['completed', 'cancelled'].includes(status)) {
      updateData.end_at = new Date().toISOString()
    }

    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId)

    if (updateError) {
      throw new Error(`Αποτυχία ενημέρωσης κατάστασης: ${updateError.message}`)
    }

    // Log status change
    await supabaseAdmin
      .from('session_status_log')
      .insert({
        session_id: sessionId,
        old_status: currentStatus,
        new_status: status,
        changed_by: user.id,
        changed_at: new Date().toISOString()
      })

    // Broadcast status change to all participants
    const statusEvent = {
      type: 'broadcast',
      event: 'SESSION_CONTROL',
      payload: {
        sessionId,
        action: status,
        previousStatus: currentStatus,
        timestamp: new Date().toISOString(),
        changedBy: user.email || user.id
      }
    }

    await supabaseAdmin
      .channel(`session:${sessionId}`)
      .send(statusEvent)

    // Additional actions based on status
    switch (status) {
      case 'active':
        // Initialize leaderboard if not exists
        await initializeLeaderboard(supabaseAdmin, sessionId)
        
        // Send welcome message
        await supabaseAdmin
          .channel(`session:${sessionId}`)
          .send({
            type: 'broadcast',
            event: 'ALERT',
            payload: {
              severity: 'info',
              type: 'session_start',
              message: 'Η συνεδρία trading ξεκίνησε! Καλή επιτυχία!',
              timestamp: new Date().toISOString()
            }
          })
        break

      case 'paused':
        await supabaseAdmin
          .channel(`session:${sessionId}`)
          .send({
            type: 'broadcast',
            event: 'ALERT',
            payload: {
              severity: 'warning',
              type: 'session_paused',
              message: 'Η συνεδρία έχει τεθεί σε παύση από τον εκπαιδευτή',
              timestamp: new Date().toISOString()
            }
          })
        break

      case 'frozen':
        await supabaseAdmin
          .channel(`session:${sessionId}`)
          .send({
            type: 'broadcast',
            event: 'ALERT',
            payload: {
              severity: 'critical',
              type: 'session_frozen',
              message: 'Η συνεδρία έχει παγώσει - δεν επιτρέπονται συναλλαγές',
              timestamp: new Date().toISOString()
            }
          })
        break

      case 'completed':
        // Calculate final scores and rankings
        await finalizeSession(supabaseAdmin, sessionId)
        
        await supabaseAdmin
          .channel(`session:${sessionId}`)
          .send({
            type: 'broadcast',
            event: 'ALERT',
            payload: {
              severity: 'info',
              type: 'session_completed',
              message: 'Η συνεδρία ολοκληρώθηκε! Δείτε τα τελικά αποτελέσματα.',
              timestamp: new Date().toISOString()
            }
          })
        break

      case 'cancelled':
        await supabaseAdmin
          .channel(`session:${sessionId}`)
          .send({
            type: 'broadcast',
            event: 'ALERT',
            payload: {
              severity: 'warning',
              type: 'session_cancelled',
              message: 'Η συνεδρία ακυρώθηκε από τον εκπαιδευτή',
              timestamp: new Date().toISOString()
            }
          })
        break
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status,
        previousStatus: currentStatus,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Session status update error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Σφάλμα ενημέρωσης κατάστασης συνεδρίας' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to initialize leaderboard
async function initializeLeaderboard(supabaseAdmin: any, sessionId: string) {
  try {
    // Get all participants
    const { data: participants, error } = await supabaseAdmin
      .from('participants')
      .select('id, initial_bankroll')
      .eq('session_id', sessionId)

    if (error || !participants) {
      console.error('Failed to get participants for leaderboard init:', error)
      return
    }

    // Initialize leaderboard entries
    const leaderboardEntries = participants.map((p: any) => ({
      session_id: sessionId,
      participant_id: p.id,
      pnl: 0,
      score: 0,
      drawdown: 0,
      penalties: 0,
      rank: null,
      updated_at: new Date().toISOString()
    }))

    // Insert with upsert to avoid conflicts
    const { error: insertError } = await supabaseAdmin
      .from('leaderboard')
      .upsert(leaderboardEntries, {
        onConflict: 'session_id,participant_id',
        ignoreDuplicates: false
      })

    if (insertError) {
      console.error('Failed to initialize leaderboard:', insertError)
    }
  } catch (error) {
    console.error('Leaderboard initialization error:', error)
  }
}

// Helper function to finalize session
async function finalizeSession(supabaseAdmin: any, sessionId: string) {
  try {
    // Get final leaderboard with calculated scores
    const { data: finalScores, error } = await supabaseAdmin
      .from('leaderboard')
      .select('*')
      .eq('session_id', sessionId)
      .order('score', { ascending: false })

    if (error || !finalScores) {
      console.error('Failed to get final scores:', error)
      return
    }

    // Update final rankings
    for (let i = 0; i < finalScores.length; i++) {
      await supabaseAdmin
        .from('leaderboard')
        .update({ 
          rank: i + 1,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('participant_id', finalScores[i].participant_id)
    }

    // Create session summary
    const summary = {
      session_id: sessionId,
      total_participants: finalScores.length,
      winner_participant_id: finalScores[0]?.participant_id,
      highest_score: finalScores[0]?.score || 0,
      average_score: finalScores.reduce((sum: number, p: any) => sum + p.score, 0) / finalScores.length,
      total_trades: 0, // Would need to calculate
      session_completed_at: new Date().toISOString()
    }

    await supabaseAdmin
      .from('session_summaries')
      .insert(summary)

  } catch (error) {
    console.error('Session finalization error:', error)
  }
}

// Migration for session status tracking tables
/*
CREATE TABLE IF NOT EXISTS session_status_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  total_participants INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id),
  highest_score DECIMAL(15, 2),
  average_score DECIMAL(15, 2),
  total_trades INTEGER DEFAULT 0,
  session_completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_status_log_session ON session_status_log(session_id, changed_at DESC);
CREATE INDEX idx_session_summaries_session ON session_summaries(session_id);
*/
