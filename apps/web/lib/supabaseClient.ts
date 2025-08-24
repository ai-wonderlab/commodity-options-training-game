import { createClient } from '@supabase/supabase-js';

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing. Using mock mode.');
}

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-application-name': 'commodity-options-game'
    }
  }
});

// Database types
export interface Session {
  id: string;
  mode: 'live' | 'replay';
  instruments: any[];
  bankroll: number;
  spread_config: any;
  fee_config: any;
  var_limit: number;
  scoring_weights: any;
  data_source: 'mock' | 'refinitiv' | 'ice';
  replay_day?: Date;
  replay_speed?: number;
  is_active: boolean;
  instructor_user_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Participant {
  id: string;
  session_id: string;
  display_name: string;
  seat_no: number;
  sso_user_id: string;
  is_instructor: boolean;
  initial_bankroll: number;
  created_at: Date;
}

export interface Order {
  id: string;
  session_id: string;
  participant_id: string;
  ts: Date;
  side: 'BUY' | 'SELL';
  type: 'MKT' | 'LMT';
  symbol: string;
  expiry?: Date;
  strike?: number;
  opt_type?: 'C' | 'P';
  qty: number;
  limit_price?: number;
  iv_override?: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  fill_price?: number;
  fees?: number;
  error_message?: string;
  created_at: Date;
  filled_at?: Date;
}

export interface Position {
  participant_id: string;
  symbol: string;
  expiry?: Date;
  strike?: number;
  opt_type?: 'C' | 'P';
  net_qty: number;
  avg_price: number;
  realized_pnl: number;
  updated_at: Date;
}

export interface Tick {
  ts: Date;
  symbol: string;
  last?: number;
  best_bid?: number;
  best_ask?: number;
  mid?: number;
}

export interface LeaderboardEntry {
  session_id: string;
  participant_id: string;
  pnl: number;
  score: number;
  drawdown: number;
  penalties: number;
  rank?: number;
  updated_at: Date;
}

export interface GreekSnapshot {
  id: string;
  ts: Date;
  participant_id: string;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  vanna?: number;
  vomma?: number;
  var_estimate: number;
  portfolio_value: number;
}

export interface BreachEvent {
  id: string;
  participant_id: string;
  type: 'DELTA' | 'GAMMA' | 'VEGA' | 'THETA' | 'VAR';
  start_ts: Date;
  end_ts?: Date;
  severity: 'WARNING' | 'BREACH' | 'CRITICAL';
  limit_value: number;
  actual_value: number;
  penalty_applied?: number;
}

// Helper function to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// Mock data fallback flag
export const useMockData = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true' || !isSupabaseConfigured();

export default supabase;