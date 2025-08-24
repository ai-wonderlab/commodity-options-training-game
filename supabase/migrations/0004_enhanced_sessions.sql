-- Enhanced Session Configuration
-- Extends sessions table with all instructor configuration options

-- Add new columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_name TEXT DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 25;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Athens';

-- Session status management
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'setup' 
  CHECK (status IN ('setup', 'waiting', 'active', 'paused', 'frozen', 'completed', 'cancelled'));

-- Multi-day support
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_multi_day BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS trading_days INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_day INTEGER DEFAULT 1;

-- Enhanced configuration
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS market_hours JSONB DEFAULT '{"start": "09:00", "end": "17:30"}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS available_instruments JSONB DEFAULT 
  '["BRN", "BUL-1M", "BUL-2M", "BUL-3M", "BUL-6M"]';

-- Trading configuration
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contract_multiplier INTEGER DEFAULT 1000;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tick_size DECIMAL(8, 4) DEFAULT 0.01;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS min_order_qty INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS max_order_qty INTEGER DEFAULT 100;

-- Risk configuration (enhanced)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS risk_config JSONB DEFAULT '{
  "delta_cap": 10000,
  "gamma_cap": 1000, 
  "vega_cap": 50000,
  "theta_cap": 10000,
  "var_limit": 100000,
  "position_limit": 500,
  "allow_breach_trading": true,
  "auto_close_breaches": false
}';

-- Enhanced fee structure
ALTER TABLE sessions DROP COLUMN IF EXISTS fee_config;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS fee_config JSONB DEFAULT '{
  "exchange_fee": 0.50,
  "clearing_fee": 0.25,
  "commission": 1.00,
  "regulatory_fee": 0.00002,
  "min_fee": 2.00,
  "max_fee": 100.00
}';

-- Enhanced spread configuration  
ALTER TABLE sessions DROP COLUMN IF EXISTS spread_config;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS spread_config JSONB DEFAULT '{
  "futures": {"default": 2, "front_month": 1.5, "back_months": 3},
  "options": {"atm": 5, "otm": 10, "deep": 20, "near_expiry": 1.5}
}';

-- Enhanced scoring weights
ALTER TABLE sessions DROP COLUMN IF EXISTS scoring_weights;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scoring_weights JSONB DEFAULT '{
  "breach_penalty_weight": 10,
  "var_penalty_weight": 5,
  "drawdown_penalty_weight": 2,
  "fee_weight": 1,
  "mode": "training"
}';

-- Data provider enhanced config
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS data_config JSONB DEFAULT '{
  "provider": "mock",
  "region": "eu",
  "symbols": ["BRN"],
  "base_volatility": 0.25,
  "price_volatility": 0.02,
  "iv_shock_size": 0.05
}';

-- Replay configuration
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS replay_config JSONB DEFAULT '{
  "replay_day": null,
  "replay_speed": 1,
  "start_time": "09:30",
  "end_time": "17:00",
  "time_compression": false
}';

-- Remove old columns that are now in JSONB configs
ALTER TABLE sessions DROP COLUMN IF EXISTS replay_day;
ALTER TABLE sessions DROP COLUMN IF EXISTS replay_speed;

-- Session templates for quick setup
CREATE TABLE IF NOT EXISTS session_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_config JSONB NOT NULL,
  created_by TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO session_templates (name, description, template_config, is_public) VALUES
('Training - Beginner', 'Basic options training with forgiving risk limits', '{
  "duration_minutes": 60,
  "max_participants": 15,
  "bankroll": 1000000,
  "mode": "live",
  "data_config": {"provider": "mock", "base_volatility": 0.25},
  "risk_config": {
    "delta_cap": 15000,
    "gamma_cap": 1500,
    "vega_cap": 75000,
    "var_limit": 150000,
    "allow_breach_trading": true
  },
  "scoring_weights": {
    "breach_penalty_weight": 5,
    "var_penalty_weight": 2,
    "drawdown_penalty_weight": 1
  }
}', true),

('Competition - Advanced', 'High-stakes competition with strict risk limits', '{
  "duration_minutes": 90,
  "max_participants": 25,
  "bankroll": 500000,
  "mode": "live",
  "data_config": {"provider": "mock", "base_volatility": 0.30},
  "risk_config": {
    "delta_cap": 8000,
    "gamma_cap": 800,
    "vega_cap": 40000,
    "var_limit": 75000,
    "allow_breach_trading": true
  },
  "scoring_weights": {
    "breach_penalty_weight": 25,
    "var_penalty_weight": 15,
    "drawdown_penalty_weight": 5
  }
}', true),

('Historical Replay', 'Replay historical market day with analysis', '{
  "duration_minutes": 45,
  "max_participants": 20,
  "bankroll": 2000000,
  "mode": "replay",
  "replay_config": {
    "replay_speed": 2,
    "start_time": "09:30",
    "end_time": "16:00"
  },
  "risk_config": {
    "delta_cap": 12000,
    "gamma_cap": 1200,
    "vega_cap": 60000,
    "var_limit": 120000
  }
}', true);

-- Function to create session from template
CREATE OR REPLACE FUNCTION create_session_from_template(
  template_id UUID,
  instructor_id TEXT,
  session_name TEXT DEFAULT NULL,
  overrides JSONB DEFAULT '{}'::JSONB
) RETURNS UUID AS $$
DECLARE
  template_config JSONB;
  final_config JSONB;
  new_session_id UUID;
BEGIN
  -- Get template configuration
  SELECT t.template_config INTO template_config
  FROM session_templates t
  WHERE t.id = template_id;
  
  IF template_config IS NULL THEN
    RAISE EXCEPTION 'Template not found: %', template_id;
  END IF;
  
  -- Merge template config with overrides
  final_config := template_config || overrides;
  
  -- Create new session
  INSERT INTO sessions (
    session_name,
    mode,
    bankroll,
    max_participants,
    duration_minutes,
    instructor_user_id,
    status,
    data_config,
    risk_config,
    scoring_weights,
    fee_config,
    spread_config,
    replay_config,
    available_instruments
  ) VALUES (
    COALESCE(session_name, 'Νέα Συνεδρία από Template'),
    COALESCE(final_config->>'mode', 'live'),
    COALESCE((final_config->>'bankroll')::NUMERIC, 1000000),
    COALESCE((final_config->>'max_participants')::INTEGER, 25),
    COALESCE((final_config->>'duration_minutes')::INTEGER, 60),
    instructor_id,
    'setup',
    COALESCE(final_config->'data_config', '{"provider": "mock"}'::JSONB),
    COALESCE(final_config->'risk_config', '{"delta_cap": 10000}'::JSONB),
    COALESCE(final_config->'scoring_weights', '{"breach_penalty_weight": 10}'::JSONB),
    COALESCE(final_config->'fee_config', '{"commission": 1.00}'::JSONB),
    COALESCE(final_config->'spread_config', '{"futures": {"default": 2}}'::JSONB),
    COALESCE(final_config->'replay_config', '{"replay_speed": 1}'::JSONB),
    COALESCE(final_config->'available_instruments', '["BRN", "BUL-1M"]'::JSONB)
  ) RETURNING id INTO new_session_id;
  
  -- Create default risk limits
  INSERT INTO risk_limits (session_id, delta_cap, gamma_cap, vega_cap, theta_cap, var_limit)
  SELECT 
    new_session_id,
    COALESCE((final_config->'risk_config'->>'delta_cap')::NUMERIC, 10000),
    COALESCE((final_config->'risk_config'->>'gamma_cap')::NUMERIC, 1000),
    COALESCE((final_config->'risk_config'->>'vega_cap')::NUMERIC, 50000),
    COALESCE((final_config->'risk_config'->>'theta_cap')::NUMERIC, 10000),
    COALESCE((final_config->'risk_config'->>'var_limit')::NUMERIC, 100000);
  
  RETURN new_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update session status with validation
CREATE OR REPLACE FUNCTION update_session_status(
  session_id UUID,
  new_status TEXT,
  instructor_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  current_status TEXT;
  participant_count INTEGER;
BEGIN
  -- Verify instructor owns session
  SELECT status INTO current_status
  FROM sessions s
  WHERE s.id = session_id AND s.instructor_user_id = instructor_id;
  
  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Session not found or access denied';
  END IF;
  
  -- Validate status transitions
  IF current_status = 'setup' AND new_status NOT IN ('waiting', 'cancelled') THEN
    RAISE EXCEPTION 'Can only move from setup to waiting or cancelled';
  END IF;
  
  IF current_status = 'waiting' AND new_status NOT IN ('active', 'cancelled') THEN
    RAISE EXCEPTION 'Can only move from waiting to active or cancelled';
  END IF;
  
  IF current_status = 'active' AND new_status NOT IN ('paused', 'frozen', 'completed') THEN
    RAISE EXCEPTION 'Can only pause, freeze, or complete active sessions';
  END IF;
  
  -- Check minimum participants for activation
  IF new_status = 'active' THEN
    SELECT COUNT(*) INTO participant_count
    FROM participants p
    WHERE p.session_id = session_id;
    
    IF participant_count < 2 THEN
      RAISE EXCEPTION 'Need at least 2 participants to start session';
    END IF;
  END IF;
  
  -- Update status and timestamps
  UPDATE sessions SET
    status = new_status,
    start_at = CASE 
      WHEN new_status = 'active' AND start_at IS NULL THEN NOW()
      ELSE start_at
    END,
    end_at = CASE
      WHEN new_status IN ('completed', 'cancelled') THEN NOW()
      ELSE end_at
    END,
    updated_at = NOW()
  WHERE id = session_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Enhanced indexes
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor_status ON sessions(instructor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_active_multi_day ON sessions(is_multi_day) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_session_templates_public ON session_templates(is_public, name);

-- RLS for templates
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public templates" ON session_templates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their own templates" ON session_templates
  FOR SELECT USING (created_by = auth.jwt() ->> 'sub');

CREATE POLICY "Users can create their own templates" ON session_templates
  FOR INSERT WITH CHECK (created_by = auth.jwt() ->> 'sub');

-- Update existing sessions with default values
UPDATE sessions SET 
  session_name = COALESCE(session_name, 'Συνεδρία ' || id::text),
  max_participants = COALESCE(max_participants, 25),
  duration_minutes = COALESCE(duration_minutes, 60),
  status = COALESCE(status, 'setup'),
  timezone = COALESCE(timezone, 'Europe/Athens')
WHERE session_name IS NULL OR session_name = '';
