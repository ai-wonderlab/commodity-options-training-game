import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ShockRequest {
  sessionId: string;
  dF_pct?: number;  // Futures price shock percentage
  dVol_pts?: number; // Volatility shock in points
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

    const requestBody: ShockRequest = await req.json();

    // Verify user is instructor for this session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, instructor_user_id')
      .eq('id', requestBody.sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is instructor or has instructor role
    const { data: participant } = await supabase
      .from('participants')
      .select('is_instructor')
      .eq('session_id', requestBody.sessionId)
      .eq('sso_user_id', user.id)
      .single();

    if (session.instructor_user_id !== user.id && !participant?.is_instructor) {
      return new Response(
        JSON.stringify({ error: 'Only instructors can apply shocks' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get latest tick
    const { data: latestTick } = await supabase
      .from('ticks')
      .select('*')
      .eq('symbol', 'BRN')
      .order('ts', { ascending: false })
      .limit(1)
      .single();

    if (!latestTick) {
      return new Response(
        JSON.stringify({ error: 'No market data available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply shocks
    const newPrice = latestTick.mid * (1 + (requestBody.dF_pct || 0) / 100);
    const spread = latestTick.best_ask - latestTick.best_bid;

    // Insert shocked tick
    const { error: tickError } = await supabase
      .from('ticks')
      .insert({
        ts: new Date().toISOString(),
        symbol: 'BRN',
        last: newPrice,
        best_bid: newPrice - spread / 2,
        best_ask: newPrice + spread / 2,
        mid: newPrice,
        iv_surface_snapshot_id: latestTick.iv_surface_snapshot_id
      });

    if (tickError) {
      throw tickError;
    }

    // If volatility shock, create new IV surface
    if (requestBody.dVol_pts) {
      const { data: latestSurface } = await supabase
        .from('iv_surface_snapshots')
        .select('surface_json')
        .order('ts', { ascending: false })
        .limit(1)
        .single();

      if (latestSurface) {
        const shockedSurface = JSON.parse(JSON.stringify(latestSurface.surface_json));
        
        // Apply vol shock to all strikes/expiries
        for (const expiry in shockedSurface.surface) {
          for (const strike in shockedSurface.surface[expiry]) {
            shockedSurface.surface[expiry][strike] += requestBody.dVol_pts / 100;
          }
        }

        const { data: newSurface } = await supabase
          .from('iv_surface_snapshots')
          .insert({
            provider: 'shock',
            surface_json: shockedSurface
          })
          .select('id')
          .single();

        // Update tick with new surface
        await supabase
          .from('ticks')
          .update({ iv_surface_snapshot_id: newSurface?.id })
          .eq('ts', new Date().toISOString())
          .eq('symbol', 'BRN');
      }
    }

    // Broadcast shock event via Realtime
    const shockEvent = {
      type: 'MARKET_SHOCK',
      sessionId: requestBody.sessionId,
      timestamp: new Date().toISOString(),
      dF_pct: requestBody.dF_pct,
      dVol_pts: requestBody.dVol_pts,
      newPrice
    };

    // Update session to trigger realtime
    await supabase
      .from('sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', requestBody.sessionId);

    return new Response(
      JSON.stringify({
        message: 'Shock applied successfully',
        shock: shockEvent
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Shock application error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to apply shock', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
