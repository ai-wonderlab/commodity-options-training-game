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
        JSON.stringify({ error: 'sessionId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let csvData = '';
    let filename = '';

    switch (kind) {
      case 'trades': {
        const { data: orders } = await supabase
          .from('orders')
          .select('*, participant:participants(display_name)')
          .eq('session_id', sessionId)
          .order('ts', { ascending: true });

        csvData = 'Timestamp,Participant,Side,Type,Symbol,Expiry,Strike,OptType,Qty,LimitPrice,FillPrice,Fees,Status\n';
        orders?.forEach(order => {
          csvData += `${order.ts},${order.participant.display_name},${order.side},${order.type},`;
          csvData += `${order.symbol},${order.expiry || ''},${order.strike || ''},${order.opt_type || ''},`;
          csvData += `${order.qty},${order.limit_price || ''},${order.fill_price || ''},${order.fees},${order.status}\n`;
        });
        filename = `trades_${sessionId.slice(0, 8)}.csv`;
        break;
      }

      case 'greeks': {
        const { data: greeks } = await supabase
          .from('greek_snapshots')
          .select('*, participant:participants(display_name)')
          .eq('participant_id.session_id', sessionId)
          .order('ts', { ascending: true });

        csvData = 'Timestamp,Participant,Delta,Gamma,Vega,Theta,Vanna,Vomma,VaR,PortfolioValue\n';
        greeks?.forEach(g => {
          csvData += `${g.ts},${g.participant.display_name},${g.delta},${g.gamma},`;
          csvData += `${g.vega},${g.theta},${g.vanna},${g.vomma},${g.var_estimate},${g.portfolio_value}\n`;
        });
        filename = `greeks_${sessionId.slice(0, 8)}.csv`;
        break;
      }

      case 'breaches': {
        const { data: breaches } = await supabase
          .from('breach_events')
          .select('*, participant:participants(display_name)')
          .eq('participant_id.session_id', sessionId)
          .order('start_ts', { ascending: true });

        csvData = 'StartTime,EndTime,Participant,Type,Severity,LimitValue,ActualValue,Penalty\n';
        breaches?.forEach(b => {
          csvData += `${b.start_ts},${b.end_ts || 'ongoing'},${b.participant.display_name},`;
          csvData += `${b.type},${b.severity},${b.limit_value},${b.actual_value},${b.penalty_applied}\n`;
        });
        filename = `breaches_${sessionId.slice(0, 8)}.csv`;
        break;
      }

      case 'leaderboard': {
        const { data: leaderboard } = await supabase
          .from('leaderboard')
          .select('*, participant:participants(display_name)')
          .eq('session_id', sessionId)
          .order('rank', { ascending: true });

        csvData = 'Rank,Participant,PnL,Score,Drawdown,Penalties\n';
        leaderboard?.forEach((entry, idx) => {
          csvData += `${idx + 1},${entry.participant.display_name},${entry.pnl},`;
          csvData += `${entry.score},${entry.drawdown},${entry.penalties}\n`;
        });
        filename = `leaderboard_${sessionId.slice(0, 8)}.csv`;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid export kind' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(csvData, {
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
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
