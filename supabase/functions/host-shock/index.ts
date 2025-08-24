import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface ShockRequest {
  sessionId: string;
  priceChangePercent: number;
  volChangePoints: number;
  description?: string;
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
    const { sessionId, priceChangePercent, volChangePoints, description } = await req.json() as ShockRequest

    // Validate auth
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    
    if (!user) {
      throw new Error('Μη εξουσιοδοτημένη πρόσβαση')
    }

    // Verify user is instructor of this session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('instructor_user_id, status, mode, data_config')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Συνεδρία δεν βρέθηκε')
    }

    if (session.instructor_user_id !== user.id) {
      throw new Error('Μόνο ο εκπαιδευτής μπορεί να εφαρμόσει shocks')
    }

    if (!['active', 'paused'].includes(session.status)) {
      throw new Error('Η συνεδρία πρέπει να είναι ενεργή για εφαρμογή shocks')
    }

    // Apply shock only to mock data providers
    const dataConfig = session.data_config || {}
    if (dataConfig.provider !== 'mock') {
      throw new Error('Market shocks υποστηρίζονται μόνο σε mock data')
    }

    // Record shock event for audit
    const { error: logError } = await supabaseAdmin
      .from('market_shocks')
      .insert({
        session_id: sessionId,
        applied_by: user.id,
        price_change_percent: priceChangePercent,
        vol_change_points: volChangePoints,
        description: description || 'Market Shock',
        applied_at: new Date().toISOString()
      })

    if (logError) {
      console.error('Failed to log shock:', logError)
      // Don't fail the shock application for logging issues
    }

    // Get current market data to compute shocked values
    const { data: latestTick, error: tickError } = await supabaseAdmin
      .from('ticks')
      .select('*')
      .eq('symbol', 'BRN')
      .order('ts', { ascending: false })
      .limit(1)
      .single()

    let currentPrice = 82.5 // Default fallback
    let currentVol = 0.25  // Default fallback
    
    if (latestTick && !tickError) {
      currentPrice = latestTick.price
      // Get current vol from latest IV surface if available
      const { data: ivSurface } = await supabaseAdmin
        .from('iv_surface_snapshots')
        .select('surface_json')
        .order('ts', { ascending: false })
        .limit(1)
        .single()
      
      if (ivSurface?.surface_json?.base_vol) {
        currentVol = ivSurface.surface_json.base_vol
      }
    }

    // Calculate shocked values
    const shockedPrice = currentPrice * (1 + priceChangePercent / 100)
    const shockedVol = Math.max(0.05, Math.min(1.0, currentVol + volChangePoints / 100))

    // Create shocked market tick
    const shockTick = {
      ts: new Date().toISOString(),
      symbol: 'BRN',
      price: Number(shockedPrice.toFixed(2)),
      bid: Number((shockedPrice - 0.01).toFixed(2)),
      ask: Number((shockedPrice + 0.01).toFixed(2)),
      volume: Math.floor(1000 + Math.random() * 2000), // Large volume for shock
      is_shock: true
    }

    // Insert shocked tick
    const { error: insertError } = await supabaseAdmin
      .from('ticks')
      .insert(shockTick)

    if (insertError) {
      throw new Error(`Failed to insert shock tick: ${insertError.message}`)
    }

    // Create shocked IV surface
    const shockedSurface = {
      ts: new Date().toISOString(),
      provider: 'shock',
      surface_json: {
        base_vol: shockedVol,
        shock_applied: true,
        price_change: priceChangePercent,
        vol_change: volChangePoints,
        strikes: generateShockedSurface(shockedPrice, shockedVol)
      }
    }

    const { error: surfaceError } = await supabaseAdmin
      .from('iv_surface_snapshots')
      .insert(shockedSurface)

    if (surfaceError) {
      console.error('Failed to insert shocked surface:', surfaceError)
      // Don't fail for surface insertion issues
    }

    // Broadcast shock to all session participants
    const shockEvent = {
      type: 'broadcast',
      event: 'SHOCK',
      payload: {
        sessionId,
        priceChange: priceChangePercent,
        volChange: volChangePoints,
        description: description || 'Market Shock',
        newPrice: shockedPrice,
        newVol: shockedVol,
        timestamp: new Date().toISOString()
      }
    }

    await supabaseAdmin
      .channel(`session:${sessionId}`)
      .send(shockEvent)

    // Also broadcast the market tick
    const tickEvent = {
      type: 'broadcast',
      event: 'TICK',
      payload: {
        symbol: 'BRN',
        price: shockedPrice,
        bid: shockTick.bid,
        ask: shockTick.ask,
        volume: shockTick.volume,
        timestamp: shockTick.ts,
        isShock: true
      }
    }

    await supabaseAdmin
      .channel(`session:${sessionId}`)
      .send(tickEvent)

    // Trigger risk recalculation for all participants
    await triggerRiskRecalculation(supabaseAdmin, sessionId, shockedPrice, shockedVol)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Market shock applied successfully',
        shockedPrice,
        shockedVol,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Host shock error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Σφάλμα εφαρμογής market shock' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to generate shocked IV surface
function generateShockedSurface(futuresPrice: number, baseVol: number) {
  const strikes: Record<string, number> = {}
  const atmStrike = Math.round(futuresPrice / 2.5) * 2.5

  // Generate strikes around ATM
  for (let i = -5; i <= 5; i++) {
    const strike = atmStrike + i * 2.5
    const moneyness = strike / futuresPrice
    
    // Volatility smile: higher IV for OTM options + shock effect
    const otmAdjustment = Math.abs(1 - moneyness) * 0.15
    const shockVolatilityBoost = 0.05 // Additional vol from shock
    const iv = baseVol + otmAdjustment + shockVolatilityBoost
    
    strikes[strike.toString()] = Number(Math.max(0.05, Math.min(1.0, iv)).toFixed(4))
  }

  return strikes
}

// Helper function to trigger risk recalculation for all participants
async function triggerRiskRecalculation(
  supabaseAdmin: any, 
  sessionId: string, 
  newPrice: number, 
  newVol: number
) {
  try {
    // Get all participants in session
    const { data: participants, error } = await supabaseAdmin
      .from('participants')
      .select('id')
      .eq('session_id', sessionId)

    if (error || !participants) {
      console.error('Failed to get participants for risk recalc:', error)
      return
    }

    // For each participant, we would normally trigger risk recalculation
    // This would be done by the order-submit function or a separate risk calculation service
    // For now, we'll just broadcast a risk update event
    
    const riskUpdateEvent = {
      type: 'broadcast',
      event: 'RISK_RECALC_REQUIRED',
      payload: {
        sessionId,
        newPrice,
        newVol,
        timestamp: new Date().toISOString(),
        reason: 'market_shock'
      }
    }

    await supabaseAdmin
      .channel(`session:${sessionId}`)
      .send(riskUpdateEvent)

  } catch (error) {
    console.error('Failed to trigger risk recalculation:', error)
  }
}

// Create market_shocks table migration if it doesn't exist
/*
CREATE TABLE IF NOT EXISTS market_shocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  applied_by TEXT NOT NULL,
  price_change_percent DECIMAL(8, 4) NOT NULL,
  vol_change_points DECIMAL(8, 4) NOT NULL,
  description TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_shocks_session ON market_shocks(session_id, applied_at DESC);
*/