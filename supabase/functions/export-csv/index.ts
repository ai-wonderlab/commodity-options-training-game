import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ExportRequest {
  sessionId: string;
  exportType: 'trades' | 'leaderboard' | 'risk' | 'performance' | 'positions' | 'breaches' | 'full-session';
  participantId?: string; // Optional - for individual exports
  dateFrom?: string;      // Optional - for date range filtering
  dateTo?: string;        // Optional - for date range filtering
  includeDetails?: boolean; // Include detailed breakdowns
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

    const {
      sessionId,
      exportType,
      participantId,
      dateFrom,
      dateTo,
      includeDetails = false
    }: ExportRequest = await req.json();

    // Verify user has access to session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('instructor_user_id, session_name')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is instructor or participant
    const isInstructor = session.instructor_user_id === user.id;
    let hasAccess = isInstructor;

    if (!isInstructor) {
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('session_id', sessionId)
        .eq('sso_user_id', user.id)
        .single();
      
      hasAccess = !!participant;
      // Non-instructors can only export their own data
      if (hasAccess && !participantId) {
        return new Response(
          JSON.stringify({ error: 'Participants can only export their own data' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let csvContent = '';
    let filename = '';

    // Generate CSV based on export type
    switch (exportType) {
      case 'trades':
        const result = await generateTradesCSV(supabase, sessionId, participantId, dateFrom, dateTo, includeDetails);
        csvContent = result.csv;
        filename = `${session.session_name}-trades-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'leaderboard':
        const leaderboardResult = await generateLeaderboardCSV(supabase, sessionId, includeDetails);
        csvContent = leaderboardResult.csv;
        filename = `${session.session_name}-leaderboard-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'risk':
        const riskResult = await generateRiskCSV(supabase, sessionId, participantId, dateFrom, dateTo);
        csvContent = riskResult.csv;
        filename = `${session.session_name}-risk-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'performance':
        const perfResult = await generatePerformanceCSV(supabase, sessionId, participantId, dateFrom, dateTo);
        csvContent = perfResult.csv;
        filename = `${session.session_name}-performance-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'positions':
        const posResult = await generatePositionsCSV(supabase, sessionId, participantId);
        csvContent = posResult.csv;
        filename = `${session.session_name}-positions-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'breaches':
        const breachResult = await generateBreachesCSV(supabase, sessionId, participantId, dateFrom, dateTo);
        csvContent = breachResult.csv;
        filename = `${session.session_name}-breaches-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'full-session':
        if (!isInstructor) {
          return new Response(
            JSON.stringify({ error: 'Only instructors can export full session data' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const fullResult = await generateFullSessionCSV(supabase, sessionId);
        csvContent = fullResult.csv;
        filename = `${session.session_name}-full-export-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid export type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Return CSV file
    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export CSV error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate trades CSV
async function generateTradesCSV(
  supabase: any,
  sessionId: string,
  participantId?: string,
  dateFrom?: string,
  dateTo?: string,
  includeDetails?: boolean
) {
  let query = supabase
    .from('orders')
    .select(`
      id,
      ts,
      side,
      type,
      symbol,
      expiry,
      strike,
      opt_type,
      qty,
      limit_price,
      iv_override,
      status,
      fill_price,
      fees,
      participants!inner(display_name, seat_no)
    `)
    .eq('session_id', sessionId)
    .order('ts', { ascending: true });

  if (participantId) {
    query = query.eq('participant_id', participantId);
  }

  if (dateFrom) {
    query = query.gte('ts', dateFrom);
  }

  if (dateTo) {
    query = query.lte('ts', dateTo);
  }

  const { data: orders, error } = await query;
  
  if (error) throw error;

  // CSV Headers
  let headers = [
    'Trade ID',
    'Timestamp',
    'Participant',
    'Seat',
    'Side',
    'Type',
    'Symbol',
    'Expiry',
    'Strike',
    'Option Type',
    'Quantity',
    'Limit Price',
    'IV Override',
    'Status',
    'Fill Price',
    'Fees',
    'Gross P&L',
    'Net P&L'
  ];

  if (includeDetails) {
    headers.push('Order Value', 'Total Cost', 'Fill Time');
  }

  let csvContent = headers.join(',') + '\n';

  for (const order of orders) {
    const participant = order.participants;
    const grossPnL = order.fill_price && order.limit_price 
      ? (order.fill_price - order.limit_price) * order.qty * 1000 
      : 0;
    const netPnL = grossPnL - (order.fees || 0);
    const orderValue = order.fill_price ? order.fill_price * order.qty * 1000 : 0;
    const totalCost = orderValue + (order.fees || 0);

    let row = [
      order.id,
      new Date(order.ts).toISOString(),
      `"${participant.display_name}"`,
      participant.seat_no,
      order.side,
      order.type,
      order.symbol,
      order.expiry || '',
      order.strike || '',
      order.opt_type || '',
      order.qty,
      order.limit_price || '',
      order.iv_override || '',
      order.status,
      order.fill_price || '',
      order.fees || 0,
      grossPnL.toFixed(2),
      netPnL.toFixed(2)
    ];

    if (includeDetails) {
      row.push(
        orderValue.toFixed(2),
        totalCost.toFixed(2),
        order.filled_at || ''
      );
    }

    csvContent += row.join(',') + '\n';
  }

  return { csv: csvContent };
}

// Generate leaderboard CSV
async function generateLeaderboardCSV(
  supabase: any,
  sessionId: string,
  includeDetails?: boolean
) {
  const { data: leaderboard, error } = await supabase
    .from('leaderboard')
    .select(`
      pnl,
      score,
      drawdown,
      penalties,
      rank,
      updated_at,
      participants!inner(display_name, seat_no, is_instructor, initial_bankroll)
    `)
    .eq('session_id', sessionId)
    .order('rank', { ascending: true });

  if (error) throw error;

  let headers = [
    'Rank',
    'Participant',
    'Seat',
    'P&L',
    'Score',
    'Drawdown',
    'Penalties',
    'ROI %',
    'Last Updated'
  ];

  if (includeDetails) {
    headers.push('Initial Bankroll', 'Final Equity', 'Is Instructor');
  }

  let csvContent = headers.join(',') + '\n';

  for (const entry of leaderboard) {
    const participant = entry.participants;
    const roi = participant.initial_bankroll > 0 
      ? ((entry.pnl / participant.initial_bankroll) * 100) 
      : 0;
    const finalEquity = participant.initial_bankroll + entry.pnl;

    let row = [
      entry.rank || '',
      `"${participant.display_name}"`,
      participant.seat_no,
      entry.pnl.toFixed(2),
      entry.score.toFixed(2),
      entry.drawdown.toFixed(2),
      entry.penalties.toFixed(2),
      roi.toFixed(2),
      new Date(entry.updated_at).toISOString()
    ];

    if (includeDetails) {
      row.push(
        participant.initial_bankroll.toFixed(2),
        finalEquity.toFixed(2),
        participant.is_instructor
      );
    }

    csvContent += row.join(',') + '\n';
  }

  return { csv: csvContent };
}

// Generate risk CSV
async function generateRiskCSV(
  supabase: any,
  sessionId: string,
  participantId?: string,
  dateFrom?: string,
  dateTo?: string
) {
  let query = supabase
    .from('greek_snapshots')
    .select(`
      timestamp,
      delta,
      gamma,
      vega,
      theta,
      var,
      participants!inner(display_name, seat_no)
    `)
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (participantId) {
    query = query.eq('participant_id', participantId);
  }

  if (dateFrom) {
    query = query.gte('timestamp', dateFrom);
  }

  if (dateTo) {
    query = query.lte('timestamp', dateTo);
  }

  const { data: snapshots, error } = await query;
  
  if (error) throw error;

  const headers = [
    'Timestamp',
    'Participant',
    'Seat',
    'Delta',
    'Gamma',
    'Vega',
    'Theta',
    'VaR 95%'
  ];

  let csvContent = headers.join(',') + '\n';

  for (const snapshot of snapshots) {
    const participant = snapshot.participants;
    
    const row = [
      new Date(snapshot.timestamp).toISOString(),
      `"${participant.display_name}"`,
      participant.seat_no,
      snapshot.delta?.toFixed(2) || '0',
      snapshot.gamma?.toFixed(4) || '0',
      snapshot.vega?.toFixed(2) || '0',
      snapshot.theta?.toFixed(2) || '0',
      snapshot.var?.toFixed(2) || '0'
    ];

    csvContent += row.join(',') + '\n';
  }

  return { csv: csvContent };
}

// Generate performance CSV
async function generatePerformanceCSV(
  supabase: any,
  sessionId: string,
  participantId?: string,
  dateFrom?: string,
  dateTo?: string
) {
  // Get EOD snapshots if available, otherwise use current data
  let query = supabase
    .from('eod_snapshots')
    .select(`
      trading_day,
      realized_pnl,
      unrealized_pnl,
      total_equity,
      daily_trades,
      daily_volume,
      daily_fees,
      snapshot_at,
      participants!inner(display_name, seat_no, initial_bankroll)
    `)
    .eq('session_id', sessionId)
    .order('trading_day', { ascending: true });

  if (participantId) {
    query = query.eq('participant_id', participantId);
  }

  const { data: snapshots, error } = await query;
  
  if (error) throw error;

  const headers = [
    'Trading Day',
    'Participant',
    'Seat',
    'Realized P&L',
    'Unrealized P&L',
    'Total Equity',
    'Daily Trades',
    'Daily Volume',
    'Daily Fees',
    'ROI %',
    'Snapshot Time'
  ];

  let csvContent = headers.join(',') + '\n';

  for (const snapshot of snapshots) {
    const participant = snapshot.participants;
    const roi = participant.initial_bankroll > 0 
      ? ((snapshot.total_equity - participant.initial_bankroll) / participant.initial_bankroll * 100)
      : 0;

    const row = [
      snapshot.trading_day,
      `"${participant.display_name}"`,
      participant.seat_no,
      snapshot.realized_pnl?.toFixed(2) || '0',
      snapshot.unrealized_pnl?.toFixed(2) || '0',
      snapshot.total_equity?.toFixed(2) || '0',
      snapshot.daily_trades || '0',
      snapshot.daily_volume?.toFixed(2) || '0',
      snapshot.daily_fees?.toFixed(2) || '0',
      roi.toFixed(2),
      new Date(snapshot.snapshot_at).toISOString()
    ];

    csvContent += row.join(',') + '\n';
  }

  return { csv: csvContent };
}

// Generate positions CSV
async function generatePositionsCSV(
  supabase: any,
  sessionId: string,
  participantId?: string
) {
  let query = supabase
    .from('positions')
    .select(`
      symbol,
      expiry,
      strike,
      opt_type,
      net_qty,
      avg_price,
      realized_pnl,
      updated_at,
      participants!inner(display_name, seat_no)
    `)
    .order('updated_at', { ascending: false });

  // Filter by participants in session
  if (participantId) {
    query = query.eq('participant_id', participantId);
  } else {
    // Get all participants from session
    const { data: participants } = await supabase
      .from('participants')
      .select('id')
      .eq('session_id', sessionId);
    
    const participantIds = participants?.map(p => p.id) || [];
    query = query.in('participant_id', participantIds);
  }

  const { data: positions, error } = await query.neq('net_qty', 0);
  
  if (error) throw error;

  const headers = [
    'Participant',
    'Seat',
    'Symbol',
    'Expiry',
    'Strike',
    'Option Type',
    'Net Quantity',
    'Average Price',
    'Realized P&L',
    'Last Updated'
  ];

  let csvContent = headers.join(',') + '\n';

  for (const position of positions) {
    const participant = position.participants;
    
    const row = [
      `"${participant.display_name}"`,
      participant.seat_no,
      position.symbol,
      position.expiry || '',
      position.strike || '',
      position.opt_type || '',
      position.net_qty,
      position.avg_price?.toFixed(2) || '0',
      position.realized_pnl?.toFixed(2) || '0',
      new Date(position.updated_at).toISOString()
    ];

    csvContent += row.join(',') + '\n';
  }

  return { csv: csvContent };
}

// Generate breaches CSV
async function generateBreachesCSV(
  supabase: any,
  sessionId: string,
  participantId?: string,
  dateFrom?: string,
  dateTo?: string
) {
  let query = supabase
    .from('breach_events')
    .select(`
      breach_type,
      breach_value,
      limit_value,
      opened_at,
      closed_at,
      duration_seconds,
      status,
      severity,
      participants!inner(display_name, seat_no)
    `)
    .eq('session_id', sessionId)
    .order('opened_at', { ascending: true });

  if (participantId) {
    query = query.eq('participant_id', participantId);
  }

  if (dateFrom) {
    query = query.gte('opened_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('opened_at', dateTo);
  }

  const { data: breaches, error } = await query;
  
  if (error) throw error;

  const headers = [
    'Participant',
    'Seat',
    'Breach Type',
    'Breach Value',
    'Limit Value',
    'Opened At',
    'Closed At',
    'Duration (seconds)',
    'Status',
    'Severity'
  ];

  let csvContent = headers.join(',') + '\n';

  for (const breach of breaches) {
    const participant = breach.participants;
    
    const row = [
      `"${participant.display_name}"`,
      participant.seat_no,
      breach.breach_type,
      breach.breach_value?.toFixed(4) || '0',
      breach.limit_value?.toFixed(4) || '0',
      new Date(breach.opened_at).toISOString(),
      breach.closed_at ? new Date(breach.closed_at).toISOString() : '',
      breach.duration_seconds || '',
      breach.status,
      breach.severity
    ];

    csvContent += row.join(',') + '\n';
  }

  return { csv: csvContent };
}

// Generate full session export (instructor only)
async function generateFullSessionCSV(
  supabase: any,
  sessionId: string
) {
  // This creates a comprehensive export with all data
  const tradesResult = await generateTradesCSV(supabase, sessionId, undefined, undefined, undefined, true);
  const leaderboardResult = await generateLeaderboardCSV(supabase, sessionId, true);
  const riskResult = await generateRiskCSV(supabase, sessionId);
  const positionsResult = await generatePositionsCSV(supabase, sessionId);

  // Combine all exports with section headers
  let fullCsv = '# FULL SESSION EXPORT\n\n';
  fullCsv += '## TRADES\n';
  fullCsv += tradesResult.csv + '\n\n';
  fullCsv += '## LEADERBOARD\n';
  fullCsv += leaderboardResult.csv + '\n\n';
  fullCsv += '## RISK SNAPSHOTS\n';
  fullCsv += riskResult.csv + '\n\n';
  fullCsv += '## POSITIONS\n';
  fullCsv += positionsResult.csv + '\n\n';

  return { csv: fullCsv };
}