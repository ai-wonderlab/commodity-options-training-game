-- Risk Management Tables
-- Tracks Greek snapshots, breach events, and VaR calculations

-- Greek snapshots table (per participant, per tick)
CREATE TABLE IF NOT EXISTS greek_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Portfolio Greeks
  delta DECIMAL(10, 2) NOT NULL,
  gamma DECIMAL(10, 4) NOT NULL,
  vega DECIMAL(10, 2) NOT NULL,
  theta DECIMAL(10, 2) NOT NULL,
  vanna DECIMAL(10, 4),
  vomma DECIMAL(10, 4),
  
  -- VaR metrics
  var_95 DECIMAL(10, 2) NOT NULL,
  var_scenarios JSONB, -- Detailed scenario results
  
  -- Portfolio value
  portfolio_value DECIMAL(10, 2) NOT NULL,
  unrealized_pnl DECIMAL(10, 2) NOT NULL,
  realized_pnl DECIMAL(10, 2) NOT NULL,
  
  -- Market data at snapshot
  futures_price DECIMAL(10, 2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Breach events table
CREATE TABLE IF NOT EXISTS breach_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  
  -- Breach details
  breach_type VARCHAR(20) NOT NULL CHECK (breach_type IN ('delta', 'gamma', 'vega', 'theta', 'var')),
  breach_value DECIMAL(10, 4) NOT NULL, -- The value that caused the breach
  limit_value DECIMAL(10, 4) NOT NULL, -- The limit that was breached
  
  -- Timing
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN closed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (closed_at - opened_at))
      ELSE NULL
    END
  ) STORED,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  
  -- Associated order (if breach was caused by a trade)
  trigger_order_id UUID REFERENCES orders(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk limits configuration (per session)
CREATE TABLE IF NOT EXISTS risk_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Greek limits
  delta_cap DECIMAL(10, 2) DEFAULT 10000,
  gamma_cap DECIMAL(10, 4) DEFAULT 1000,
  vega_cap DECIMAL(10, 2) DEFAULT 50000,
  theta_cap DECIMAL(10, 2) DEFAULT 10000,
  
  -- VaR limit
  var_limit DECIMAL(10, 2) DEFAULT 100000,
  
  -- Breach penalties (weights)
  breach_penalty_weight DECIMAL(5, 2) DEFAULT 10,
  var_penalty_weight DECIMAL(5, 2) DEFAULT 5,
  
  -- Allow trading with breaches?
  allow_breach_trading BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participant risk status (current state)
CREATE TABLE IF NOT EXISTS participant_risk_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  
  -- Current Greeks
  current_delta DECIMAL(10, 2) DEFAULT 0,
  current_gamma DECIMAL(10, 4) DEFAULT 0,
  current_vega DECIMAL(10, 2) DEFAULT 0,
  current_theta DECIMAL(10, 2) DEFAULT 0,
  
  -- Current VaR
  current_var DECIMAL(10, 2) DEFAULT 0,
  
  -- Breach counts
  total_breaches INTEGER DEFAULT 0,
  active_breaches INTEGER DEFAULT 0,
  total_breach_seconds INTEGER DEFAULT 0,
  
  -- Last update
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id, participant_id)
);

-- Indexes for performance
CREATE INDEX idx_greek_snapshots_session_participant 
  ON greek_snapshots(session_id, participant_id, timestamp DESC);
CREATE INDEX idx_breach_events_session_participant 
  ON breach_events(session_id, participant_id, status);
CREATE INDEX idx_breach_events_opened 
  ON breach_events(opened_at DESC);
CREATE INDEX idx_participant_risk_status_session 
  ON participant_risk_status(session_id);

-- Function to check and record breaches
CREATE OR REPLACE FUNCTION check_risk_breaches(
  p_session_id UUID,
  p_participant_id UUID,
  p_delta DECIMAL,
  p_gamma DECIMAL,
  p_vega DECIMAL,
  p_theta DECIMAL,
  p_var DECIMAL,
  p_order_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_limits risk_limits;
  v_breaches JSONB;
  v_breach_array JSONB[];
  v_existing_breach breach_events;
BEGIN
  -- Get risk limits for session
  SELECT * INTO v_limits FROM risk_limits WHERE session_id = p_session_id;
  
  IF v_limits IS NULL THEN
    -- Use defaults if no limits configured
    v_limits := ROW(
      NULL, p_session_id, 10000, 1000, 50000, 10000, 100000, 10, 5, true, NOW(), NOW()
    )::risk_limits;
  END IF;
  
  -- Check each limit
  
  -- Delta breach
  IF ABS(p_delta) > v_limits.delta_cap THEN
    -- Check if there's an open breach of this type
    SELECT * INTO v_existing_breach 
    FROM breach_events 
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'delta' 
      AND status = 'open'
    LIMIT 1;
    
    IF v_existing_breach IS NULL THEN
      -- Create new breach
      INSERT INTO breach_events (
        session_id, participant_id, breach_type, 
        breach_value, limit_value, trigger_order_id
      ) VALUES (
        p_session_id, p_participant_id, 'delta',
        p_delta, v_limits.delta_cap, p_order_id
      );
      
      v_breach_array := array_append(v_breach_array, jsonb_build_object(
        'type', 'delta',
        'value', p_delta,
        'limit', v_limits.delta_cap,
        'status', 'opened'
      ));
    END IF;
  ELSE
    -- Close any open delta breach
    UPDATE breach_events 
    SET status = 'closed', closed_at = NOW()
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'delta' 
      AND status = 'open';
  END IF;
  
  -- Gamma breach
  IF ABS(p_gamma) > v_limits.gamma_cap THEN
    SELECT * INTO v_existing_breach 
    FROM breach_events 
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'gamma' 
      AND status = 'open'
    LIMIT 1;
    
    IF v_existing_breach IS NULL THEN
      INSERT INTO breach_events (
        session_id, participant_id, breach_type, 
        breach_value, limit_value, trigger_order_id
      ) VALUES (
        p_session_id, p_participant_id, 'gamma',
        p_gamma, v_limits.gamma_cap, p_order_id
      );
      
      v_breach_array := array_append(v_breach_array, jsonb_build_object(
        'type', 'gamma',
        'value', p_gamma,
        'limit', v_limits.gamma_cap,
        'status', 'opened'
      ));
    END IF;
  ELSE
    UPDATE breach_events 
    SET status = 'closed', closed_at = NOW()
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'gamma' 
      AND status = 'open';
  END IF;
  
  -- Vega breach
  IF ABS(p_vega) > v_limits.vega_cap THEN
    SELECT * INTO v_existing_breach 
    FROM breach_events 
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'vega' 
      AND status = 'open'
    LIMIT 1;
    
    IF v_existing_breach IS NULL THEN
      INSERT INTO breach_events (
        session_id, participant_id, breach_type, 
        breach_value, limit_value, trigger_order_id
      ) VALUES (
        p_session_id, p_participant_id, 'vega',
        p_vega, v_limits.vega_cap, p_order_id
      );
      
      v_breach_array := array_append(v_breach_array, jsonb_build_object(
        'type', 'vega',
        'value', p_vega,
        'limit', v_limits.vega_cap,
        'status', 'opened'
      ));
    END IF;
  ELSE
    UPDATE breach_events 
    SET status = 'closed', closed_at = NOW()
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'vega' 
      AND status = 'open';
  END IF;
  
  -- Theta breach
  IF ABS(p_theta) > v_limits.theta_cap THEN
    SELECT * INTO v_existing_breach 
    FROM breach_events 
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'theta' 
      AND status = 'open'
    LIMIT 1;
    
    IF v_existing_breach IS NULL THEN
      INSERT INTO breach_events (
        session_id, participant_id, breach_type, 
        breach_value, limit_value, trigger_order_id
      ) VALUES (
        p_session_id, p_participant_id, 'theta',
        p_theta, v_limits.theta_cap, p_order_id
      );
      
      v_breach_array := array_append(v_breach_array, jsonb_build_object(
        'type', 'theta',
        'value', p_theta,
        'limit', v_limits.theta_cap,
        'status', 'opened'
      ));
    END IF;
  ELSE
    UPDATE breach_events 
    SET status = 'closed', closed_at = NOW()
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'theta' 
      AND status = 'open';
  END IF;
  
  -- VaR breach
  IF p_var > v_limits.var_limit THEN
    SELECT * INTO v_existing_breach 
    FROM breach_events 
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'var' 
      AND status = 'open'
    LIMIT 1;
    
    IF v_existing_breach IS NULL THEN
      INSERT INTO breach_events (
        session_id, participant_id, breach_type, 
        breach_value, limit_value, trigger_order_id,
        severity
      ) VALUES (
        p_session_id, p_participant_id, 'var',
        p_var, v_limits.var_limit, p_order_id,
        'critical'
      );
      
      v_breach_array := array_append(v_breach_array, jsonb_build_object(
        'type', 'var',
        'value', p_var,
        'limit', v_limits.var_limit,
        'status', 'opened',
        'severity', 'critical'
      ));
    END IF;
  ELSE
    UPDATE breach_events 
    SET status = 'closed', closed_at = NOW()
    WHERE session_id = p_session_id 
      AND participant_id = p_participant_id 
      AND breach_type = 'var' 
      AND status = 'open';
  END IF;
  
  -- Update participant risk status
  INSERT INTO participant_risk_status (
    session_id, participant_id,
    current_delta, current_gamma, current_vega, current_theta, current_var,
    active_breaches
  ) VALUES (
    p_session_id, p_participant_id,
    p_delta, p_gamma, p_vega, p_theta, p_var,
    (SELECT COUNT(*) FROM breach_events 
     WHERE session_id = p_session_id 
       AND participant_id = p_participant_id 
       AND status = 'open')
  )
  ON CONFLICT (session_id, participant_id) DO UPDATE SET
    current_delta = EXCLUDED.current_delta,
    current_gamma = EXCLUDED.current_gamma,
    current_vega = EXCLUDED.current_vega,
    current_theta = EXCLUDED.current_theta,
    current_var = EXCLUDED.current_var,
    active_breaches = EXCLUDED.active_breaches,
    last_updated = NOW();
  
  -- Return breach information
  v_breaches := jsonb_build_object(
    'breaches', COALESCE(v_breach_array, ARRAY[]::JSONB[]),
    'allow_trading', v_limits.allow_breach_trading
  );
  
  RETURN v_breaches;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total breach time for scoring
CREATE OR REPLACE FUNCTION calculate_breach_time(
  p_session_id UUID,
  p_participant_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_total_seconds INTEGER;
BEGIN
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN closed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (closed_at - opened_at))
        ELSE 
          EXTRACT(EPOCH FROM (NOW() - opened_at))
      END
    ), 0)::INTEGER INTO v_total_seconds
  FROM breach_events
  WHERE session_id = p_session_id
    AND participant_id = p_participant_id;
  
  RETURN v_total_seconds;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE greek_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_risk_status ENABLE ROW LEVEL SECURITY;

-- Participants can view their own risk data
CREATE POLICY "Participants view own greek snapshots"
  ON greek_snapshots FOR SELECT
  USING (auth.uid() = participant_id OR 
         auth.uid() IN (SELECT instructor_id FROM sessions WHERE id = session_id));

CREATE POLICY "Participants view own breach events"
  ON breach_events FOR SELECT
  USING (auth.uid() = participant_id OR 
         auth.uid() IN (SELECT instructor_id FROM sessions WHERE id = session_id));

CREATE POLICY "View risk limits"
  ON risk_limits FOR SELECT
  USING (true);

CREATE POLICY "Participants view risk status"
  ON participant_risk_status FOR SELECT
  USING (auth.uid() = participant_id OR 
         auth.uid() IN (SELECT instructor_id FROM sessions WHERE id = session_id));

-- Instructors can manage risk limits
CREATE POLICY "Instructors manage risk limits"
  ON risk_limits FOR ALL
  USING (auth.uid() IN (SELECT instructor_id FROM sessions WHERE id = session_id));

-- Service role can do everything
CREATE POLICY "Service role full access greek_snapshots"
  ON greek_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access breach_events"
  ON breach_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access participant_risk_status"
  ON participant_risk_status FOR ALL
  USING (auth.role() = 'service_role');
