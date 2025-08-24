import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    const kind = url.searchParams.get('kind') || 'trades';

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'sessionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let csvContent = '';
    let filename = '';

    switch (kind) {
      case 'trades': {
        const { data: orders } = await supabase
          .from('orders')
          .select(`
            ts,
            participant_id,
            participants!inner(display_name),
            side,
            type,
            symbol,
            expiry,
            strike,
            opt_type,
            qty,
            limit_price,
            status,
            fill_price,
            fees,
            filled_at
          `)
          .eq('session_id', sessionId)
          .order('ts', { ascending: false });

        csvContent = 'Timestamp,Participant,Side,Type,Symbol,Expiry,Strike,OptType,Qty,LimitPrice,Status,FillPrice,Fees,FilledAt\n';
        
        orders?.forEach(order => {
          csvContent += `${order.ts},${order.participants.display_name},${order.side},${order.type},`;
          csvContent += `${order.symbol},${order.expiry || ''},${order.strike || ''},${order.opt_type || ''},`;
          csvContent += `${order.qty},${order.limit_price || ''},${order.status},`;
          csvContent += `${order.fill_price || ''},${order.fees || ''},${order.filled_at || ''}\n`;
        });
        
        filename = `trades_${sessionId}_${new Date().toISOString()}.csv`;
        break;
      }

      case 'greeks': {
        const { data: snapshots } = await supabase
          .from('greek_snapshots')
          .select(`
            ts,
            participant_id,
            participants!inner(display_name),
            delta,
            gamma,
            vega,
            theta,
            vanna,
            vomma,
            var_estimate,
            portfolio_value
          `)
          .in('participant_id', 
            (await supabase
              .from('participants')
              .select('id')
              .eq('session_id', sessionId)).data?.map(p => p.id) || []
          )
          .order('ts', { ascending: false });

        csvContent = 'Timestamp,Participant,Delta,Gamma,Vega,Theta,Vanna,Vomma,VaR,PortfolioValue\n';
        
        snapshots?.forEach(snap => {
          csvContent += `${snap.ts},${snap.participants.display_name},`;
          csvContent += `${snap.delta},${snap.gamma},${snap.vega},${snap.theta},`;
          csvContent += `${snap.vanna},${snap.vomma},${snap.var_estimate},${snap.portfolio_value}\n`;
        });
        
        filename = `greeks_${sessionId}_${new Date().toISOString()}.csv`;
        break;
      }

      case 'breaches': {
        const { data: breaches } = await supabase
          .from('breach_events')
          .select(`
            start_ts,
            end_ts,
            participant_id,
            participants!inner(display_name),
            type,
            severity,
            limit_value,
            actual_value,
            penalty_applied
          `)
          .in('participant_id',
            (await supabase
              .from('participants')
              .select('id')
              .eq('session_id', sessionId)).data?.map(p => p.id) || []
          )
          .order('start_ts', { ascending: false });

        csvContent = 'StartTime,EndTime,Participant,Type,Severity,Limit,Actual,Penalty\n';
        
        breaches?.forEach(breach => {
          csvContent += `${breach.start_ts},${breach.end_ts || 'ongoing'},`;
          csvContent += `${breach.participants.display_name},${breach.type},${breach.severity},`;
          csvContent += `${breach.limit_value},${breach.actual_value},${breach.penalty_applied}\n`;
        });
        
        filename = `breaches_${sessionId}_${new Date().toISOString()}.csv`;
        break;
      }

      case 'leaderboard': {
        const { data: leaderboard } = await supabase
          .from('leaderboard')
          .select(`
            participant_id,
            participants!inner(display_name, seat_no),
            pnl,
            score,
            drawdown,
            penalties,
            rank,
            updated_at
          `)
          .eq('session_id', sessionId)
          .order('score', { ascending: false });

        csvContent = 'Rank,Seat,Participant,PnL,Score,Drawdown,Penalties,LastUpdate\n';
        
        leaderboard?.forEach((entry, index) => {
          csvContent += `${index + 1},${entry.participants.seat_no},`;
          csvContent += `${entry.participants.display_name},${entry.pnl},`;
          csvContent += `${entry.score},${entry.drawdown},${entry.penalties},${entry.updated_at}\n`;
        });
        
        filename = `leaderboard_${sessionId}_${new Date().toISOString()}.csv`;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid export kind. Use: trades, greeks, breaches, or leaderboard' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(csvContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to export data', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
