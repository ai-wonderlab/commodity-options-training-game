-- Enable Realtime for all game tables
-- This allows real-time subscriptions from the frontend

-- Core game tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;

-- Analytics tables
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE greek_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE breach_events;

-- Market data
ALTER PUBLICATION supabase_realtime ADD TABLE ticks;
ALTER PUBLICATION supabase_realtime ADD TABLE iv_surface_snapshots;

-- Create optimized indexes for real-time queries
CREATE INDEX IF NOT EXISTS idx_orders_session_participant 
    ON orders(session_id, participant_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_positions_participant 
    ON positions(participant_id);

CREATE INDEX IF NOT EXISTS idx_ticks_latest 
    ON ticks(symbol, ts DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_session_rank 
    ON leaderboard(session_id, rank);

CREATE INDEX IF NOT EXISTS idx_greek_snapshots_latest 
    ON greek_snapshots(participant_id, ts DESC);

-- Create views for common queries
CREATE OR REPLACE VIEW v_latest_ticks AS
SELECT DISTINCT ON (symbol) 
    symbol, ts, last, best_bid, best_ask, mid
FROM ticks
ORDER BY symbol, ts DESC;

CREATE OR REPLACE VIEW v_active_positions AS
SELECT 
    p.*,
    part.display_name,
    part.session_id
FROM positions p
JOIN participants part ON p.participant_id = part.id
WHERE p.net_qty != 0;

-- Grant permissions for real-time access
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
