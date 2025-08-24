-- Session Management Additional Tables
-- Support for enhanced session controls, multi-day sessions, and market shocks

-- Market shocks tracking table
CREATE TABLE IF NOT EXISTS market_shocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  applied_by TEXT NOT NULL,
  price_change_percent DECIMAL(8, 4) NOT NULL,
  vol_change_points DECIMAL(8, 4) NOT NULL,
  description TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session status change log
CREATE TABLE IF NOT EXISTS session_status_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session summaries (created when session completes)
CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  total_participants INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id),
  highest_score DECIMAL(15, 2),
  average_score DECIMAL(15, 2),
  total_trades INTEGER DEFAULT 0,
  session_duration_minutes INTEGER,
  session_completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-day session day transition log
CREATE TABLE IF NOT EXISTS session_day_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  from_day INTEGER NOT NULL,
  to_day INTEGER NOT NULL,
  transitioned_by TEXT NOT NULL,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- End-of-day snapshots for multi-day sessions
CREATE TABLE IF NOT EXISTS eod_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trading_day INTEGER NOT NULL,
  realized_pnl DECIMAL(15, 2) NOT NULL DEFAULT 0,
  unrealized_pnl DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_equity DECIMAL(15, 2) NOT NULL DEFAULT 0,
  positions_json JSONB,
  daily_trades INTEGER DEFAULT 0,
  daily_volume DECIMAL(15, 2) DEFAULT 0,
  daily_fees DECIMAL(10, 2) DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(session_id, participant_id, trading_day)
);

-- Session alerts/messages log
CREATE TABLE IF NOT EXISTS session_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id), -- NULL for global alerts
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'info', 'warning', 'critical', 'success', 'breach', 'shock', 'status'
  )),
  message TEXT NOT NULL,
  details JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false
);

-- Performance indexes
CREATE INDEX idx_market_shocks_session ON market_shocks(session_id, applied_at DESC);
CREATE INDEX idx_session_status_log_session ON session_status_log(session_id, changed_at DESC);
CREATE INDEX idx_session_summaries_session ON session_summaries(session_id);
CREATE INDEX idx_session_summaries_completed ON session_summaries(session_completed_at DESC);
CREATE INDEX idx_session_day_log_session ON session_day_log(session_id, transitioned_at DESC);
CREATE INDEX idx_eod_snapshots_session_day ON eod_snapshots(session_id, trading_day);
CREATE INDEX idx_eod_snapshots_participant ON eod_snapshots(participant_id, trading_day);
CREATE INDEX idx_session_alerts_session ON session_alerts(session_id, created_at DESC);
CREATE INDEX idx_session_alerts_participant ON session_alerts(participant_id, created_at DESC);
CREATE INDEX idx_session_alerts_unread ON session_alerts(participant_id, is_read) WHERE is_read = false;

-- Add trading_day column to ticks for multi-day sessions
ALTER TABLE ticks ADD COLUMN IF NOT EXISTS trading_day INTEGER DEFAULT 1;
ALTER TABLE ticks ADD COLUMN IF NOT EXISTS is_opening BOOLEAN DEFAULT false;
ALTER TABLE ticks ADD COLUMN IF NOT EXISTS is_shock BOOLEAN DEFAULT false;

-- Add indexes for new tick columns
CREATE INDEX IF NOT EXISTS idx_ticks_trading_day ON ticks(trading_day, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ticks_opening ON ticks(is_opening) WHERE is_opening = true;
CREATE INDEX IF NOT EXISTS idx_ticks_shocks ON ticks(is_shock) WHERE is_shock = true;

-- RLS Policies for new tables

-- Market shocks: instructors can view/insert, participants can view
ALTER TABLE market_shocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors manage market shocks" ON market_shocks
  FOR ALL USING (
    applied_by = auth.jwt() ->> 'sub' OR
    auth.uid() IN (
      SELECT instructor_id FROM sessions WHERE id = session_id
    )
  );

CREATE POLICY "Participants view market shocks" ON market_shocks
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM participants WHERE sso_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Session status log: view only for session members
ALTER TABLE session_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session members view status log" ON session_status_log
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM participants WHERE sso_user_id = auth.jwt() ->> 'sub'
    ) OR
    auth.uid() IN (
      SELECT instructor_id FROM sessions WHERE id = session_id
    )
  );

-- Session summaries: view only for session members
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session members view summaries" ON session_summaries
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM participants WHERE sso_user_id = auth.jwt() ->> 'sub'
    ) OR
    auth.uid() IN (
      SELECT instructor_id FROM sessions WHERE id = session_id
    )
  );

-- EOD snapshots: participants see own, instructors see all
ALTER TABLE eod_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view own EOD snapshots" ON eod_snapshots
  FOR SELECT USING (
    auth.uid() = participant_id OR
    auth.uid() IN (
      SELECT instructor_id FROM sessions WHERE id = session_id
    )
  );

-- Session alerts: participants see own + global, instructors see all
ALTER TABLE session_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View session alerts" ON session_alerts
  FOR SELECT USING (
    participant_id IS NULL OR -- Global alerts
    auth.uid() = participant_id OR -- Own alerts
    auth.uid() IN (
      SELECT instructor_id FROM sessions WHERE id = session_id
    ) -- Instructors see all
  );

CREATE POLICY "Create session alerts" ON session_alerts
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT instructor_id FROM sessions WHERE id = session_id
    ) OR
    auth.role() = 'service_role'
  );

-- Service role has full access to all new tables
CREATE POLICY "Service role full access market_shocks" ON market_shocks
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access session_status_log" ON session_status_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access session_summaries" ON session_summaries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access session_day_log" ON session_day_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access eod_snapshots" ON eod_snapshots
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access session_alerts" ON session_alerts
  FOR ALL USING (auth.role() = 'service_role');

-- Functions to support session management

-- Function to get session participants count
CREATE OR REPLACE FUNCTION get_session_participant_count(session_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  participant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO participant_count
  FROM participants
  WHERE session_id = session_uuid
    AND NOT is_instructor;
  
  RETURN COALESCE(participant_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is session instructor
CREATE OR REPLACE FUNCTION is_session_instructor(session_uuid UUID, user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  is_instructor BOOLEAN;
BEGIN
  SELECT (instructor_user_id = user_id) INTO is_instructor
  FROM sessions
  WHERE id = session_uuid;
  
  RETURN COALESCE(is_instructor, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update leaderboard rankings
CREATE OR REPLACE FUNCTION update_leaderboard_rankings(session_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Update rankings based on current scores
  WITH ranked_participants AS (
    SELECT 
      participant_id,
      RANK() OVER (ORDER BY score DESC, pnl DESC) as new_rank
    FROM leaderboard
    WHERE session_id = session_uuid
  )
  UPDATE leaderboard
  SET 
    rank = rp.new_rank,
    updated_at = NOW()
  FROM ranked_participants rp
  WHERE leaderboard.participant_id = rp.participant_id
    AND leaderboard.session_id = session_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update leaderboard rankings when scores change
CREATE OR REPLACE FUNCTION trigger_update_rankings()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_leaderboard_rankings(NEW.session_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leaderboard updates
DROP TRIGGER IF EXISTS update_rankings_on_score_change ON leaderboard;
CREATE TRIGGER update_rankings_on_score_change
  AFTER UPDATE OF score ON leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings();

-- Clean up expired alerts function
CREATE OR REPLACE FUNCTION cleanup_expired_alerts()
RETURNS VOID AS $$
BEGIN
  DELETE FROM session_alerts
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cron job to clean up expired alerts (requires pg_cron extension)
-- This would run every hour to clean expired alerts
-- SELECT cron.schedule('cleanup-alerts', '0 * * * *', 'SELECT cleanup_expired_alerts();');
