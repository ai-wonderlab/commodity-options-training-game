import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OrderRequest {
  sessionId: string;
  participantId: string;
  side: 'BUY' | 'SELL';
  type: 'MKT' | 'LMT';
  symbol: string;
  expiry?: string;
  strike?: number;
  optType?: 'C' | 'P';
  qty: number;
  limitPrice?: number;
  ivOverride?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const order: OrderRequest = await req.json();

    // Validate participant belongs to session
    const { data: participant } = await supabase
      .from('participants')
      .select('id, session_id')
      .eq('id', order.participantId)
      .eq('session_id', order.sessionId)
      .single();

    if (!participant) {
      return new Response(
        JSON.stringify({ error: 'Invalid participant or session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get latest tick for pricing
    const { data: tick } = await supabase
      .from('ticks')
      .select('*')
      .eq('symbol', order.symbol)
      .order('ts', { ascending: false })
      .limit(1)
      .single();

    if (!tick) {
      return new Response(
        JSON.stringify({ error: 'No market data available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate fill price based on order type
    let fillPrice = 0;
    const spread = 0.05; // Default spread
    
    if (order.type === 'MKT') {
      fillPrice = tick.mid;
    } else if (order.type === 'LMT' && order.limitPrice) {
      // Check if limit crosses the market
      if ((order.side === 'BUY' && order.limitPrice >= tick.best_ask) ||
          (order.side === 'SELL' && order.limitPrice <= tick.best_bid)) {
        fillPrice = order.side === 'BUY' ? tick.best_ask : tick.best_bid;
      } else {
        // Order doesn't cross - would rest in book (simplified: we reject for now)
        return new Response(
          JSON.stringify({ 
            error: 'Limit order does not cross market',
            market: { bid: tick.best_bid, ask: tick.best_ask }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate fees
    const fees = order.qty * 2.50; // $2.50 per contract

    // Create order record
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        session_id: order.sessionId,
        participant_id: order.participantId,
        side: order.side,
        type: order.type,
        symbol: order.symbol,
        expiry: order.expiry,
        strike: order.strike,
        opt_type: order.optType,
        qty: order.qty,
        limit_price: order.limitPrice,
        iv_override: order.ivOverride,
        status: 'FILLED',
        fill_price: fillPrice,
        fees: fees,
        filled_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create position
    const positionKey = {
      participant_id: order.participantId,
      symbol: order.symbol,
      expiry: order.expiry || '1900-01-01',
      strike: order.strike || 0,
      opt_type: order.optType || ''
    };

    const { data: existingPosition } = await supabase
      .from('positions')
      .select('*')
      .match(positionKey)
      .single();

    const signedQty = order.side === 'BUY' ? order.qty : -order.qty;
    
    if (existingPosition) {
      const newNetQty = existingPosition.net_qty + signedQty;
      const newAvgPrice = newNetQty !== 0 
        ? ((existingPosition.net_qty * existingPosition.avg_price) + (signedQty * fillPrice)) / newNetQty
        : 0;

      await supabase
        .from('positions')
        .update({
          net_qty: newNetQty,
          avg_price: newAvgPrice,
          updated_at: new Date().toISOString()
        })
        .match(positionKey);
    } else {
      await supabase
        .from('positions')
        .insert({
          ...positionKey,
          net_qty: signedQty,
          avg_price: fillPrice,
          realized_pnl: 0
        });
    }

    // Calculate portfolio Greeks (simplified - would use Black-76 model)
    const greeks = {
      delta: Math.random() * 100 - 50,
      gamma: Math.random() * 10,
      vega: Math.random() * 50,
      theta: -Math.random() * 20,
      vanna: Math.random() * 5,
      vomma: Math.random() * 5,
      var_estimate: Math.random() * 2000
    };

    // Save Greek snapshot
    await supabase
      .from('greek_snapshots')
      .insert({
        participant_id: order.participantId,
        ...greeks,
        portfolio_value: 100000 + Math.random() * 5000 - 2500
      });

    // Check for risk breaches
    const { data: session } = await supabase
      .from('sessions')
      .select('var_limit')
      .eq('id', order.sessionId)
      .single();

    if (greeks.var_estimate > session.var_limit) {
      await supabase
        .from('breach_events')
        .insert({
          participant_id: order.participantId,
          type: 'VAR',
          severity: 'WARNING',
          limit_value: session.var_limit,
          actual_value: greeks.var_estimate
        });
    }

    // Update leaderboard
    const pnl = Math.random() * 1000 - 500; // Simplified PnL
    const score = 1000 + pnl - fees;

    await supabase
      .from('leaderboard')
      .upsert({
        session_id: order.sessionId,
        participant_id: order.participantId,
        pnl: pnl,
        score: score,
        drawdown: Math.min(0, pnl),
        penalties: 0
      });

    // Broadcast via Realtime (channel: session:{id})
    const channel = supabase.channel(`session:${order.sessionId}`);
    await channel.send({
      type: 'broadcast',
      event: 'order_filled',
      payload: {
        orderId: newOrder.id,
        participantId: order.participantId,
        fillPrice: fillPrice,
        fees: fees,
        portfolio: { pnl, score, greeks, var: greeks.var_estimate }
      }
    });

    return new Response(
      JSON.stringify({
        orderId: newOrder.id,
        status: 'FILLED',
        fillPrice: fillPrice,
        fees: fees,
        portfolio: { pnl, score, greeks, var: greeks.var_estimate }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Order submission error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
