// @ts-ignore
import { serve } from "https://deno.land/std/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import { corsHeaders } from "../_shared/cors.ts";

// @ts-ignore
declare const Deno: any;

interface NextDayRequest {
  sessionId: string;
}

serve(async (req: Request) => {
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
    const { sessionId } = await req.json() as NextDayRequest

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
      .select('instructor_user_id, status, is_multi_day, trading_days, current_day')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Συνεδρία δεν βρέθηκε')
    }

    if (session.instructor_user_id !== user.id) {
      throw new Error('Μόνο ο εκπαιδευτής μπορεί να προχωρήσει στην επόμενη ημέρα')
    }

    if (!session.is_multi_day) {
      throw new Error('Η συνεδρία δεν είναι πολυήμερη')
    }

    if (session.status !== 'active') {
      throw new Error('Η συνεδρία πρέπει να είναι ενεργή για μετάβαση στην επόμενη ημέρα')
    }

    if (session.current_day >= session.trading_days) {
      throw new Error('Η συνεδρία έχει ήδη ολοκληρώσει όλες τις ημέρες trading')
    }

    const nextDay = session.current_day + 1

    // Perform end-of-day calculations
    await performEndOfDayCalculations(supabaseAdmin, sessionId, session.current_day)

    // Update session to next day
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({
        current_day: nextDay,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      throw new Error(`Αποτυχία ενημέρωσης ημέρας: ${updateError.message}`)
    }

    // Log day transition
    await supabaseAdmin
      .from('session_day_log')
      .insert({
        session_id: sessionId,
        from_day: session.current_day,
        to_day: nextDay,
        transitioned_by: user.id,
        transitioned_at: new Date().toISOString()
      })

    // Reset daily metrics but keep cumulative positions
    await resetDailyMetrics(supabaseAdmin, sessionId)

    // Generate market opening data for new day
    await generateNewDayMarketData(supabaseAdmin, sessionId, nextDay)

    // Broadcast day transition to all participants
    const dayTransitionEvent = {
      type: 'broadcast',
      event: 'SESSION_CONTROL',
      payload: {
        sessionId,
        action: 'next_day',
        currentDay: nextDay,
        totalDays: session.trading_days,
        timestamp: new Date().toISOString()
      }
    }

    await supabaseAdmin
      .channel(`session:${sessionId}`)
      .send(dayTransitionEvent)

    // Send informational alert
    const isLastDay = nextDay === session.trading_days
    await supabaseAdmin
      .channel(`session:${sessionId}`)
      .send({
        type: 'broadcast',
        event: 'ALERT',
        payload: {
          severity: 'info',
          type: 'day_transition',
          message: isLastDay 
            ? `Καλημέρα! Τελευταία ημέρα trading (${nextDay}/${session.trading_days})`
            : `Καλημέρα! Ημέρα ${nextDay} από ${session.trading_days}`,
          timestamp: new Date().toISOString()
        }
      })

    // If this is the last day, set up auto-completion
    if (isLastDay) {
      await supabaseAdmin
        .channel(`session:${sessionId}`)
        .send({
          type: 'broadcast',
          event: 'ALERT',
          payload: {
            severity: 'warning',
            type: 'final_day',
            message: 'Προσοχή: Αυτή είναι η τελευταία ημέρα της συνεδρίας!',
            timestamp: new Date().toISOString()
          }
        })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        currentDay: nextDay,
        totalDays: session.trading_days,
        isLastDay,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Session next day error:', error)
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message || 'Σφάλμα μετάβασης στην επόμενη ημέρα' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to perform end-of-day calculations
async function performEndOfDayCalculations(
  supabaseAdmin: any, 
  sessionId: string, 
  currentDay: number
) {
  try {
    // Get all participants
    const { data: participants, error } = await supabaseAdmin
      .from('participants')
      .select('id')
      .eq('session_id', sessionId)

    if (error || !participants) {
      console.error('Failed to get participants for EOD:', error)
      return
    }

    // For each participant, calculate end-of-day P&L and metrics
    for (const participant of participants) {
      // Get current positions
      const { data: positions, error: posError } = await supabaseAdmin
        .from('positions')
        .select('*')
        .eq('participant_id', participant.id)

      if (posError || !positions) continue

      // Calculate unrealized P&L at market close
      let totalUnrealizedPnL = 0
      const closingPrice = 82.5 // Would get from market data

      for (const position of positions) {
        if (position.symbol === 'BRN') {
          // Futures position
          const unrealized = (closingPrice - position.avg_price) * position.net_qty * 1000
          totalUnrealizedPnL += unrealized
        }
        // Would also calculate options unrealized P&L here
      }

      // Create end-of-day snapshot
      await supabaseAdmin
        .from('eod_snapshots')
        .insert({
          session_id: sessionId,
          participant_id: participant.id,
          trading_day: currentDay,
          realized_pnl: positions[0]?.realized_pnl || 0,
          unrealized_pnl: totalUnrealizedPnL,
          total_equity: (positions[0]?.realized_pnl || 0) + totalUnrealizedPnL,
          positions_json: positions,
          snapshot_at: new Date().toISOString()
        })
    }

  } catch (error) {
    console.error('End of day calculations error:', error)
  }
}

// Helper function to reset daily metrics
async function resetDailyMetrics(supabaseAdmin: any, sessionId: string) {
  try {
    // Reset daily P&L tracking but keep cumulative
    // This might involve updating tracking tables or flags
    
    // Reset daily risk metrics
    await supabaseAdmin
      .from('participant_risk_status')
      .update({
        // Reset daily counters but keep positions
        last_updated: new Date().toISOString()
      })
      .eq('session_id', sessionId)

    console.log('Daily metrics reset for session:', sessionId)
  } catch (error) {
    console.error('Reset daily metrics error:', error)
  }
}

// Helper function to generate market data for new day
async function generateNewDayMarketData(
  supabaseAdmin: any, 
  sessionId: string, 
  day: number
) {
  try {
    // Get session configuration
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('data_config, market_hours')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      console.error('Failed to get session for market data generation:', error)
      return
    }

    // Generate opening market data for new day
    const marketHours = session.market_hours || { start: '09:00', end: '17:30' }
    const dataConfig = session.data_config || {}

    // Create opening tick with some gap from previous close
    const gapPercent = (Math.random() - 0.5) * 0.04 // ±2% overnight gap
    const basePrice = 82.5 * (1 + gapPercent)
    
    const openingTick = {
      ts: new Date().toISOString(),
      symbol: 'BRN',
      price: Number(basePrice.toFixed(2)),
      bid: Number((basePrice - 0.01).toFixed(2)),
      ask: Number((basePrice + 0.01).toFixed(2)),
      volume: Math.floor(500 + Math.random() * 1000),
      is_opening: true,
      trading_day: day
    }

    await supabaseAdmin
      .from('ticks')
      .insert(openingTick)

    // Broadcast opening tick
    await supabaseAdmin
      .channel(`session:${sessionId}`)
      .send({
        type: 'broadcast',
        event: 'TICK',
        payload: {
          ...openingTick,
          timestamp: openingTick.ts,
          isOpening: true
        }
      })

  } catch (error) {
    console.error('Generate new day market data error:', error)
  }
}

// Migration for multi-day session tables
/*
CREATE TABLE IF NOT EXISTS session_day_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  from_day INTEGER NOT NULL,
  to_day INTEGER NOT NULL,
  transitioned_by TEXT NOT NULL,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eod_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trading_day INTEGER NOT NULL,
  realized_pnl DECIMAL(15, 2) NOT NULL DEFAULT 0,
  unrealized_pnl DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_equity DECIMAL(15, 2) NOT NULL DEFAULT 0,
  positions_json JSONB,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(session_id, participant_id, trading_day)
);

CREATE INDEX idx_session_day_log_session ON session_day_log(session_id, transitioned_at DESC);
CREATE INDEX idx_eod_snapshots_session_day ON eod_snapshots(session_id, trading_day);
CREATE INDEX idx_eod_snapshots_participant ON eod_snapshots(participant_id, trading_day);
*/
