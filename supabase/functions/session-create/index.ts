import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface EnhancedCreateSessionRequest {
  // Basic settings
  session_name: string;
  description?: string;
  mode: 'live' | 'replay';
  bankroll: number;
  max_participants: number;
  duration_minutes: number;
  timezone?: string;
  status?: string;
  
  // Multi-day support
  is_multi_day?: boolean;
  trading_days?: number;
  
  // JSON configurations
  data_config: {
    provider: 'mock' | 'refinitiv' | 'ice';
    region: 'eu' | 'us';
    base_volatility: number;
    symbols: string[];
    price_volatility?: number;
    iv_shock_size?: number;
  };
  
  risk_config: {
    delta_cap: number;
    gamma_cap: number;
    vega_cap: number;
    theta_cap: number;
    var_limit: number;
    allow_breach_trading: boolean;
  };
  
  scoring_weights: {
    breach_penalty_weight: number;
    var_penalty_weight: number;
    drawdown_penalty_weight: number;
    fee_weight: number;
    mode: 'training' | 'competition';
  };
  
  fee_config: {
    exchange_fee: number;
    clearing_fee: number;
    commission: number;
    regulatory_fee: number;
    min_fee: number;
    max_fee: number;
  };
  
  spread_config: {
    futures: {
      default: number;
      front_month: number;
      back_months: number;
    };
    options: {
      atm: number;
      otm: number;
      deep: number;
      near_expiry: number;
    };
  };
  
  replay_config?: {
    replay_day?: string;
    replay_speed?: number;
    start_time?: string;
    end_time?: string;
  };
  
  available_instruments: string[];
  market_hours: {
    start: string;
    end: string;
  };
}

interface CreateSessionResponse {
  sessionId: string;
  sessionName: string;
  status: string;
  message: string;
  instructorParticipantId?: string;
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

    const requestBody: EnhancedCreateSessionRequest = await req.json();

    // Validate required fields
    if (!requestBody.session_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Session name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!requestBody.mode || !['live', 'replay'].includes(requestBody.mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode. Must be "live" or "replay"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (requestBody.mode === 'replay' && !requestBody.replay_config?.replay_day) {
      return new Response(
        JSON.stringify({ error: 'Replay day is required for replay mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate numeric constraints
    if (requestBody.max_participants < 2 || requestBody.max_participants > 50) {
      return new Response(
        JSON.stringify({ error: 'Max participants must be between 2 and 50' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (requestBody.duration_minutes < 15 || requestBody.duration_minutes > 480) {
      return new Response(
        JSON.stringify({ error: 'Duration must be between 15 and 480 minutes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the session with all enhanced fields
    const sessionData = {
      session_name: requestBody.session_name.trim(),
      description: requestBody.description?.trim() || '',
      mode: requestBody.mode,
      bankroll: requestBody.bankroll,
      max_participants: requestBody.max_participants,
      duration_minutes: requestBody.duration_minutes,
      timezone: requestBody.timezone || 'Europe/Athens',
      status: requestBody.status || 'setup',
      is_multi_day: requestBody.is_multi_day || false,
      trading_days: requestBody.trading_days || 1,
      current_day: 1,
      
      // JSON configurations
      data_config: {
        provider: requestBody.data_config.provider,
        region: requestBody.data_config.region,
        base_volatility: requestBody.data_config.base_volatility,
        symbols: requestBody.data_config.symbols,
        price_volatility: requestBody.data_config.price_volatility || 0.02,
        iv_shock_size: requestBody.data_config.iv_shock_size || 0.05
      },
      
      risk_config: requestBody.risk_config,
      scoring_weights: requestBody.scoring_weights,
      fee_config: requestBody.fee_config,
      spread_config: requestBody.spread_config,
      
      replay_config: requestBody.replay_config || {},
      available_instruments: requestBody.available_instruments,
      market_hours: requestBody.market_hours,
      
      // Contract specifications
      contract_multiplier: 1000,
      tick_size: 0.01,
      min_order_qty: 1,
      max_order_qty: 100,
      
      instructor_user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select('id')
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create session', 
          details: sessionError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create risk limits configuration
    const { error: riskLimitsError } = await supabase
      .from('risk_limits')
      .insert({
        session_id: session.id,
        delta_cap: requestBody.risk_config.delta_cap,
        gamma_cap: requestBody.risk_config.gamma_cap,
        vega_cap: requestBody.risk_config.vega_cap,
        theta_cap: requestBody.risk_config.theta_cap,
        var_limit: requestBody.risk_config.var_limit,
        breach_penalty_weight: requestBody.scoring_weights.breach_penalty_weight,
        var_penalty_weight: requestBody.scoring_weights.var_penalty_weight,
        allow_breach_trading: requestBody.risk_config.allow_breach_trading
      });

    if (riskLimitsError) {
      console.error('Risk limits creation error:', riskLimitsError);
    }

    // Auto-join the instructor as the first participant
    const instructorDisplayName = user.user_metadata?.full_name || 
                                  user.user_metadata?.name || 
                                  user.email?.split('@')[0] || 
                                  'Εκπαιδευτής';

    const { data: instructorParticipant, error: participantError } = await supabase
      .from('participants')
      .insert({
        session_id: session.id,
        display_name: instructorDisplayName,
        seat_no: 0, // Instructor gets seat 0
        sso_user_id: user.id,
        is_instructor: true,
        initial_bankroll: requestBody.bankroll
      })
      .select('id')
      .single();

    if (participantError) {
      console.error('Instructor participant creation error:', participantError);
    }

    // Initialize instructor's leaderboard entry
    if (instructorParticipant) {
      const { error: leaderboardError } = await supabase
        .from('leaderboard')
        .insert({
          session_id: session.id,
          participant_id: instructorParticipant.id,
          pnl: 0,
          score: 0, // Instructor starts with 0 score
          drawdown: 0,
          penalties: 0,
          rank: null // Instructor doesn't participate in ranking
        });

      if (leaderboardError) {
        console.error('Instructor leaderboard initialization error:', leaderboardError);
      }

      // Initialize risk status for instructor
      await supabase
        .from('participant_risk_status')
        .insert({
          session_id: session.id,
          participant_id: instructorParticipant.id,
          current_delta: 0,
          current_gamma: 0,
          current_vega: 0,
          current_theta: 0,
          current_var: 0,
          total_breaches: 0,
          active_breaches: 0,
          total_breach_seconds: 0
        });
    }

    // Log session creation
    await supabase
      .from('session_status_log')
      .insert({
        session_id: session.id,
        old_status: 'none',
        new_status: requestBody.status || 'setup',
        changed_by: user.id,
        changed_at: new Date().toISOString()
      });

    // Create initial market data for mock provider
    if (requestBody.data_config.provider === 'mock') {
      await initializeMockData(supabase, session.id, requestBody.data_config);
    }

    // Send session created alert
    await supabase
      .from('session_alerts')
      .insert({
        session_id: session.id,
        alert_type: 'success',
        message: `Συνεδρία "${requestBody.session_name}" δημιουργήθηκε επιτυχώς`,
        details: {
          mode: requestBody.mode,
          participants: requestBody.max_participants,
          duration: requestBody.duration_minutes
        },
        created_by: user.id,
        created_at: new Date().toISOString()
      });

    const response: CreateSessionResponse = {
      sessionId: session.id,
      sessionName: requestBody.session_name,
      status: requestBody.status || 'setup',
      message: `Session "${requestBody.session_name}" created successfully`,
      instructorParticipantId: instructorParticipant?.id
    };

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to initialize mock market data
async function initializeMockData(
  supabase: any, 
  sessionId: string, 
  dataConfig: any
) {
  try {
    const basePrice = 82.5;
    const baseVolatility = dataConfig.base_volatility;

    // Create initial tick
    const { error: tickError } = await supabase
      .from('ticks')
      .insert({
        ts: new Date().toISOString(),
        symbol: 'BRN',
        price: basePrice,
        bid: basePrice - 0.01,
        ask: basePrice + 0.01,
        volume: 1000,
        trading_day: 1,
        is_opening: true
      });

    if (tickError) {
      console.error('Failed to create initial tick:', tickError);
    }

    // Create initial IV surface
    const strikes: Record<string, number> = {};
    const atmStrike = Math.round(basePrice / 2.5) * 2.5;

    for (let i = -5; i <= 5; i++) {
      const strike = atmStrike + i * 2.5;
      const moneyness = strike / basePrice;
      const otmAdjustment = Math.abs(1 - moneyness) * 0.15;
      const iv = baseVolatility + otmAdjustment;
      strikes[strike.toString()] = Number(iv.toFixed(4));
    }

    const { error: surfaceError } = await supabase
      .from('iv_surface_snapshots')
      .insert({
        ts: new Date().toISOString(),
        provider: 'mock',
        surface_json: {
          base_vol: baseVolatility,
          strikes,
          session_id: sessionId
        }
      });

    if (surfaceError) {
      console.error('Failed to create initial IV surface:', surfaceError);
    }

  } catch (error) {
    console.error('Mock data initialization error:', error);
  }
}