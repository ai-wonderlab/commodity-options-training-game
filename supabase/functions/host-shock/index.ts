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
    
    // Verify instructor authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    const shock: ShockRequest = await req.json();

    // Verify user is instructor for this session
    const { data: session } = await supabase
      .from('sessions')
      .select('instructor_user_id')
      .eq('id', shock.sessionId)
      .single();

    if (!session || session.instructor_user_id !== user?.id) {
      return new Response(
        JSON.stringify({ error: 'Only instructors can apply shocks' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get latest ticks
    const { data: latestTicks } = await supabase
      .from('ticks')
      .select('*')
      .order('ts', { ascending: false })
      .limit(10);

    // Apply shocks to market data
    const shockedTicks = latestTicks?.map(tick => {
      const priceMultiplier = 1 + (shock.dF_pct || 0) / 100;
      return {
        ...tick,
        ts: new Date().toISOString(),
        last: tick.last * priceMultiplier,
        best_bid: tick.best_bid * priceMultiplier,
        best_ask: tick.best_ask * priceMultiplier,
        mid: tick.mid * priceMultiplier
      };
    });

    // Insert shocked ticks
    if (shockedTicks && shockedTicks.length > 0) {
      await supabase
        .from('ticks')
        .insert(shockedTicks);
    }

    // Apply volatility shock if specified
    if (shock.dVol_pts) {
      // Would update IV surface here
      console.log(`Applying volatility shock of ${shock.dVol_pts} points`);
    }

    // Broadcast shock event
    const channel = supabase.channel(`session:${shock.sessionId}`);
    await channel.send({
      type: 'broadcast',
      event: 'market_shock',
      payload: {
        dF_pct: shock.dF_pct,
        dVol_pts: shock.dVol_pts,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        message: 'Shock applied successfully',
        dF_pct: shock.dF_pct,
        dVol_pts: shock.dVol_pts
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Shock application error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
