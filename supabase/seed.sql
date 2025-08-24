-- Seed data for development and testing
-- This file can be run with: supabase db seed

-- Clear existing test data (optional)
TRUNCATE sessions, participants, orders, positions, greek_snapshots, breach_events, ticks, iv_surface_snapshots, leaderboard CASCADE;

-- Insert test IV surface
INSERT INTO iv_surface_snapshots (id, ts, provider, surface_json) VALUES (
    'test-surface-001'::uuid,
    NOW() - INTERVAL '1 hour',
    'mock',
    '{
        "underlying": "BRN",
        "surface": {
            "2024-12-15": {
                "75.0": 0.28, "77.5": 0.26, "80.0": 0.25, "82.5": 0.26, "85.0": 0.28,
                "87.5": 0.31, "90.0": 0.34, "92.5": 0.37, "95.0": 0.40
            },
            "2025-03-15": {
                "75.0": 0.32, "77.5": 0.30, "80.0": 0.28, "82.5": 0.29, "85.0": 0.31,
                "87.5": 0.34, "90.0": 0.37, "92.5": 0.40, "95.0": 0.43
            }
        },
        "risk_free_rate": 0.025,
        "timestamp": "2024-01-01T09:00:00Z"
    }'::jsonb
);

-- Insert test session
INSERT INTO sessions (id, mode, instruments, bankroll, spread_config, fee_config, var_limit, scoring_weights, data_source, is_active) VALUES (
    'test-session-001'::uuid,
    'live',
    '[
        {
            "symbol": "BRN",
            "name": "ICE Brent Crude Futures",
            "type": "FUTURE",
            "contract_size": 1000,
            "tick_size": 0.01
        },
        {
            "symbol": "BUL",
            "name": "ICE Brent Crude Options",
            "type": "OPTION",
            "underlying": "BRN",
            "contract_size": 1000,
            "tick_size": 0.01,
            "exercise_style": "European"
        }
    ]'::jsonb,
    100000,
    '{"default_spread": 0.02, "futures": 0.01, "options": 0.03}'::jsonb,
    '{"per_contract": 2.50, "percentage": 0.0001}'::jsonb,
    5000,
    '{"alpha": 0.1, "beta": 0.2, "gamma": 0.1, "base_score": 1000}'::jsonb,
    'mock',
    true
);

-- Insert test participants
INSERT INTO participants (id, session_id, display_name, seat_no, sso_user_id, is_instructor, initial_bankroll) VALUES
    ('test-participant-001'::uuid, 'test-session-001'::uuid, 'Test Instructor', 1, 'test-instructor-id', true, 100000),
    ('test-participant-002'::uuid, 'test-session-001'::uuid, 'Player One', 2, 'test-player1-id', false, 100000),
    ('test-participant-003'::uuid, 'test-session-001'::uuid, 'Player Two', 3, 'test-player2-id', false, 100000);

-- Insert initial leaderboard entries
INSERT INTO leaderboard (session_id, participant_id, pnl, score, drawdown, penalties) VALUES
    ('test-session-001'::uuid, 'test-participant-001'::uuid, 0, 1000, 0, 0),
    ('test-session-001'::uuid, 'test-participant-002'::uuid, 0, 1000, 0, 0),
    ('test-session-001'::uuid, 'test-participant-003'::uuid, 0, 1000, 0, 0);

-- Insert recent tick data
DO $$
DECLARE
    base_price NUMERIC := 82.50;
    i INTEGER;
BEGIN
    FOR i IN 0..20 LOOP
        INSERT INTO ticks (ts, symbol, last, best_bid, best_ask, mid, iv_surface_snapshot_id)
        VALUES (
            NOW() - (INTERVAL '1 minute' * i),
            'BRN',
            base_price + (random() - 0.5) * 2,
            base_price + (random() - 0.5) * 2 - 0.05,
            base_price + (random() - 0.5) * 2 + 0.05,
            base_price + (random() - 0.5) * 2,
            'test-surface-001'::uuid
        );
    END LOOP;
END $$;

-- Insert sample orders (mix of filled and pending)
INSERT INTO orders (session_id, participant_id, side, type, symbol, qty, status, fill_price, fees, filled_at) VALUES
    ('test-session-001'::uuid, 'test-participant-002'::uuid, 'BUY', 'MKT', 'BRN', 10, 'FILLED', 82.45, 25.82, NOW() - INTERVAL '30 minutes'),
    ('test-session-001'::uuid, 'test-participant-002'::uuid, 'SELL', 'LMT', 'BRN', 5, 'PENDING', NULL, NULL, NULL),
    ('test-session-001'::uuid, 'test-participant-003'::uuid, 'BUY', 'MKT', 'BRN', 15, 'FILLED', 82.50, 38.74, NOW() - INTERVAL '25 minutes');

-- Insert sample positions
INSERT INTO positions (participant_id, symbol, net_qty, avg_price, realized_pnl) VALUES
    ('test-participant-002'::uuid, 'BRN', 10, 82.45, 0),
    ('test-participant-003'::uuid, 'BRN', 15, 82.50, 0);

-- Insert sample greek snapshots
INSERT INTO greek_snapshots (participant_id, delta, gamma, vega, theta, vanna, vomma, var_estimate, portfolio_value) VALUES
    ('test-participant-002'::uuid, 250.5, 12.3, 45.6, -8.9, 2.1, 0.8, 1250, 100250),
    ('test-participant-003'::uuid, 375.8, 18.5, 68.4, -13.4, 3.2, 1.2, 1875, 100375);

-- Create a demo replay day
INSERT INTO sessions (id, mode, instruments, bankroll, spread_config, fee_config, var_limit, scoring_weights, data_source, replay_day, replay_speed, is_active) VALUES (
    'demo-replay-001'::uuid,
    'replay',
    '[
        {
            "symbol": "BRN",
            "name": "ICE Brent Crude Futures",
            "type": "FUTURE",
            "contract_size": 1000,
            "tick_size": 0.01
        }
    ]'::jsonb,
    50000,
    '{"default_spread": 0.02}'::jsonb,
    '{"per_contract": 2.50, "percentage": 0.0001}'::jsonb,
    3000,
    '{"alpha": 0.1, "beta": 0.2, "gamma": 0.1, "base_score": 1000}'::jsonb,
    'mock',
    '2024-01-15',
    2,
    true
);

-- Grant permissions for testing (be careful in production!)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Output summary
DO $$
BEGIN
    RAISE NOTICE 'Seed data loaded successfully!';
    RAISE NOTICE 'Test session ID: test-session-001';
    RAISE NOTICE 'Demo replay session ID: demo-replay-001';
    RAISE NOTICE 'Test participants: 3 (1 instructor, 2 players)';
    RAISE NOTICE 'Sample orders: 3';
    RAISE NOTICE 'Sample ticks: 21';
END $$;
