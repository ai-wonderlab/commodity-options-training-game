import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SubmitOrderRequest {
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

interface SubmitOrderResponse {
  orderId: string;
  status: string;
  fillPrice?: number;
  fees?: number;
  portfolio: {
    pnl: number;
    score: number;
    greeks: {
      delta: number;
      gamma: number;
      vega: number;
      theta: number;
    };
    var: number;
  };
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

    const requestBody: SubmitOrderRequest = await req.json();

    // Validate participant owns the request
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, session_id, sso_user_id')
      .eq('id', requestBody.participantId)
      .eq('session_id', requestBody.sessionId)
      .single();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: 'Invalid participant or session' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session configuration
    const { data: session } = await supabase
      .from('sessions')
      .select('spread_config, fee_config, var_limit, scoring_weights')
      .eq('id', requestBody.sessionId)
      .single();

    // Get current market price
    const { data: tick } = await supabase
      .from('ticks')
      .select('mid, best_bid, best_ask')
      .eq('symbol', requestBody.symbol)
      .order('ts', { ascending: false })
      .limit(1)
      .single();

    if (!tick) {
      return new Response(
        JSON.stringify({ error: 'No market data available for symbol' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate fill price based on order type
    let fillPrice: number;
    let fees: number;

    if (requestBody.type === 'MKT') {
      // Market orders fill at mid
      fillPrice = tick.mid;
    } else {
      // Limit orders - check if crossable
      if (requestBody.side === 'BUY' && requestBody.limitPrice! >= tick.best_ask) {
        fillPrice = tick.best_ask;
      } else if (requestBody.side === 'SELL' && requestBody.limitPrice! <= tick.best_bid) {
        fillPrice = tick.best_bid;
      } else {
        // Order rests, not filled immediately
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            session_id: requestBody.sessionId,
            participant_id: requestBody.participantId,
            side: requestBody.side,
            type: requestBody.type,
            symbol: requestBody.symbol,
            expiry: requestBody.expiry,
            strike: requestBody.strike,
            opt_type: requestBody.optType,
            qty: requestBody.qty,
            limit_price: requestBody.limitPrice,
            iv_override: requestBody.ivOverride,
            status: 'PENDING'
          })
          .select('id')
          .single();

        if (orderError) {
          throw orderError;
        }

        return new Response(
          JSON.stringify({
            orderId: order.id,
            status: 'PENDING',
            portfolio: await getPortfolioSnapshot(supabase, requestBody.participantId)
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate fees
    const feeConfig = requestBody.symbol === 'BRN' 
      ? session?.fee_config?.futures 
      : session?.fee_config?.options;
    
    fees = (feeConfig?.per_contract || 2.5) * requestBody.qty + 
           (feeConfig?.percentage || 0.0001) * fillPrice * requestBody.qty;

    // Create filled order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        session_id: requestBody.sessionId,
        participant_id: requestBody.participantId,
        side: requestBody.side,
        type: requestBody.type,
        symbol: requestBody.symbol,
        expiry: requestBody.expiry,
        strike: requestBody.strike,
        opt_type: requestBody.optType,
        qty: requestBody.qty,
        limit_price: requestBody.limitPrice,
        iv_override: requestBody.ivOverride,
        status: 'FILLED',
        fill_price: fillPrice,
        fees: fees,
        filled_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (orderError) {
      throw orderError;
    }

    // Update position
    await updatePosition(supabase, requestBody, fillPrice, fees);

    // Calculate new portfolio Greeks and risk metrics
    const portfolio = await getPortfolioSnapshot(supabase, requestBody.participantId);

    // Check for risk breaches
    await checkRiskLimits(supabase, requestBody.participantId, portfolio, session?.var_limit);

    // Update leaderboard
    await updateLeaderboard(supabase, requestBody.sessionId, requestBody.participantId, portfolio);

    const response: SubmitOrderResponse = {
      orderId: order.id,
      status: 'FILLED',
      fillPrice,
      fees,
      portfolio
    };

    // Broadcast update to session participants via Realtime
    await supabase
      .from('leaderboard')
      .update({ updated_at: new Date().toISOString() })
      .eq('session_id', requestBody.sessionId)
      .eq('participant_id', requestBody.participantId);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Order submission error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to submit order', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function updatePosition(supabase: any, order: SubmitOrderRequest, fillPrice: number, fees: number) {
  const { data: existingPosition } = await supabase
    .from('positions')
    .select('*')
    .eq('participant_id', order.participantId)
    .eq('symbol', order.symbol)
    .eq('expiry', order.expiry || '1900-01-01')
    .eq('strike', order.strike || 0)
    .eq('opt_type', order.optType || '')
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
      .eq('participant_id', order.participantId)
      .eq('symbol', order.symbol)
      .eq('expiry', order.expiry || '1900-01-01')
      .eq('strike', order.strike || 0)
      .eq('opt_type', order.optType || '');
  } else {
    await supabase
      .from('positions')
      .insert({
        participant_id: order.participantId,
        symbol: order.symbol,
        expiry: order.expiry,
        strike: order.strike,
        opt_type: order.optType,
        net_qty: signedQty,
        avg_price: fillPrice
      });
  }
}

async function getPortfolioSnapshot(supabase: any, participantId: string) {
  // Simplified portfolio calculation - in production would call Black-76 library
  const { data: positions } = await supabase
    .from('positions')
    .select('*')
    .eq('participant_id', participantId);

  // Mock calculation - would integrate with packages/shared library
  return {
    pnl: Math.random() * 1000 - 500,
    score: 1000 + Math.random() * 200,
    greeks: {
      delta: Math.random() * 100 - 50,
      gamma: Math.random() * 10,
      vega: Math.random() * 50,
      theta: -Math.random() * 20
    },
    var: Math.random() * 3000
  };
}

async function checkRiskLimits(supabase: any, participantId: string, portfolio: any, varLimit: number) {
  // Check VAR limit
  if (portfolio.var > varLimit) {
    await supabase
      .from('breach_events')
      .insert({
        participant_id: participantId,
        type: 'VAR',
        severity: 'BREACH',
        limit_value: varLimit,
        actual_value: portfolio.var
      });
  }
}

async function updateLeaderboard(supabase: any, sessionId: string, participantId: string, portfolio: any) {
  await supabase
    .from('leaderboard')
    .update({
      pnl: portfolio.pnl,
      score: portfolio.score,
      updated_at: new Date().toISOString()
    })
    .eq('session_id', sessionId)
    .eq('participant_id', participantId);
}
