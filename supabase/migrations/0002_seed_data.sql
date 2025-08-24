-- =============================================
-- Seed Data for Commodity Options Training Game
-- BRN/BUL instruments and mock market data
-- =============================================

-- =============================================
-- MOCK IV SURFACE SNAPSHOT
-- Base implied volatility surface for options pricing
-- =============================================
INSERT INTO iv_surface_snapshots (id, ts, provider, surface_json) VALUES (
    'mock-base-surface-001',
    '2024-01-15 09:30:00+00',
    'mock',
    '{
        "underlying": "BRN",
        "surface": {
            "2024-03-15": {
                "75.0": 0.28, "77.5": 0.26, "80.0": 0.25, "82.5": 0.26, "85.0": 0.28,
                "87.5": 0.31, "90.0": 0.34, "92.5": 0.37, "95.0": 0.40
            },
            "2024-06-15": {
                "75.0": 0.32, "77.5": 0.30, "80.0": 0.28, "82.5": 0.29, "85.0": 0.31,
                "87.5": 0.34, "90.0": 0.37, "92.5": 0.40, "95.0": 0.43
            },
            "2024-09-15": {
                "75.0": 0.35, "77.5": 0.33, "80.0": 0.31, "82.5": 0.32, "85.0": 0.34,
                "87.5": 0.37, "90.0": 0.40, "92.5": 0.43, "95.0": 0.46
            }
        },
        "risk_free_rate": 0.025,
        "timestamp": "2024-01-15T09:30:00Z"
    }'
);

-- =============================================
-- MOCK TICK DATA
-- Base market data for BRN futures
-- =============================================

-- BRN Futures base price
INSERT INTO ticks (ts, symbol, last, best_bid, best_ask, mid, iv_surface_snapshot_id) VALUES
('2024-01-15 09:30:00+00', 'BRN', 82.45, 82.40, 82.50, 82.45, 'mock-base-surface-001'),
('2024-01-15 09:31:00+00', 'BRN', 82.48, 82.43, 82.53, 82.48, 'mock-base-surface-001'),
('2024-01-15 09:32:00+00', 'BRN', 82.41, 82.36, 82.46, 82.41, 'mock-base-surface-001'),
('2024-01-15 09:33:00+00', 'BRN', 82.52, 82.47, 82.57, 82.52, 'mock-base-surface-001'),
('2024-01-15 09:34:00+00', 'BRN', 82.39, 82.34, 82.44, 82.39, 'mock-base-surface-001');

-- Sample option chain for March 2024 expiry
INSERT INTO ticks (ts, symbol, last, best_bid, best_ask, mid, iv_surface_snapshot_id) VALUES
-- 80.0 Call
('2024-01-15 09:30:00+00', 'BUL80C0324', 3.25, 3.15, 3.35, 3.25, 'mock-base-surface-001'),
-- 80.0 Put  
('2024-01-15 09:30:00+00', 'BUL80P0324', 0.85, 0.75, 0.95, 0.85, 'mock-base-surface-001'),
-- 82.5 Call
('2024-01-15 09:30:00+00', 'BUL82.5C0324', 1.95, 1.85, 2.05, 1.95, 'mock-base-surface-001'),
-- 82.5 Put
('2024-01-15 09:30:00+00', 'BUL82.5P0324', 1.55, 1.45, 1.65, 1.55, 'mock-base-surface-001'),
-- 85.0 Call
('2024-01-15 09:30:00+00', 'BUL85C0324', 0.95, 0.85, 1.05, 0.95, 'mock-base-surface-001'),
-- 85.0 Put
('2024-01-15 09:30:00+00', 'BUL85P0324', 2.85, 2.75, 2.95, 2.85, 'mock-base-surface-001');

-- =============================================
-- INSTRUMENT METADATA FUNCTIONS
-- Helper functions for instrument definitions
-- =============================================

CREATE OR REPLACE FUNCTION get_brent_instruments()
RETURNS JSONB AS $$
BEGIN
    RETURN '[
        {
            "symbol": "BRN",
            "name": "ICE Brent Crude Futures",
            "type": "FUTURE",
            "contract_size": 1000,
            "tick_size": 0.01,
            "currency": "USD",
            "exchange": "ICE",
            "expiries": ["2024-03-15", "2024-06-15", "2024-09-15", "2024-12-15"]
        },
        {
            "symbol": "BUL",
            "name": "ICE Brent Crude Options",
            "type": "OPTION",
            "underlying": "BRN",
            "contract_size": 1000,
            "tick_size": 0.01,
            "currency": "USD",
            "exchange": "ICE",
            "exercise_style": "European",
            "expiries": [
                {
                    "date": "2024-03-15",
                    "strikes": [75.0, 77.5, 80.0, 82.5, 85.0, 87.5, 90.0, 92.5, 95.0]
                },
                {
                    "date": "2024-06-15", 
                    "strikes": [75.0, 77.5, 80.0, 82.5, 85.0, 87.5, 90.0, 92.5, 95.0]
                },
                {
                    "date": "2024-09-15",
                    "strikes": [75.0, 77.5, 80.0, 82.5, 85.0, 87.5, 90.0, 92.5, 95.0]
                }
            ]
        }
    ]'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DEFAULT SESSION CONFIGURATION FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION get_default_spread_config()
RETURNS JSONB AS $$
BEGIN
    RETURN '{
        "futures": {
            "BRN": 0.02
        },
        "options": {
            "default": 0.05,
            "BUL": 0.03
        }
    }'::JSONB;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_default_fee_config()
RETURNS JSONB AS $$
BEGIN
    RETURN '{
        "futures": {
            "per_contract": 2.50,
            "percentage": 0.0001
        },
        "options": {
            "per_contract": 1.50,
            "percentage": 0.0002
        }
    }'::JSONB;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_default_scoring_weights()
RETURNS JSONB AS $$
BEGIN
    RETURN '{
        "alpha": 0.1,
        "beta": 0.2, 
        "gamma": 0.1,
        "base_score": 1000
    }'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MOCK HISTORICAL DAY DATA
-- Sample replay day with price evolution
-- =============================================

CREATE OR REPLACE FUNCTION seed_mock_replay_day(replay_date DATE DEFAULT '2024-01-15')
RETURNS VOID AS $$
DECLARE
    base_time TIMESTAMPTZ;
    i INTEGER;
    price_offset NUMERIC;
BEGIN
    base_time := replay_date::TIMESTAMPTZ + INTERVAL '9 hours 30 minutes';
    
    -- Generate 6.5 hours of tick data (390 minutes, every 5 minutes)
    FOR i IN 0..77 LOOP
        price_offset := sin(i * 0.1) * 1.5 + random() * 0.8 - 0.4;
        
        INSERT INTO ticks (ts, symbol, last, best_bid, best_ask, mid, iv_surface_snapshot_id)
        VALUES (
            base_time + (i * INTERVAL '5 minutes'),
            'BRN',
            82.45 + price_offset,
            82.45 + price_offset - 0.05,
            82.45 + price_offset + 0.05,
            82.45 + price_offset,
            'mock-base-surface-001'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the mock data seeding
SELECT seed_mock_replay_day();

-- =============================================
-- RISK LIMIT DEFAULTS
-- Standard risk limits for the game
-- =============================================

CREATE OR REPLACE FUNCTION get_default_risk_limits()
RETURNS JSONB AS $$
BEGIN
    RETURN '{
        "delta": {
            "max": 1000,
            "warning_at": 800
        },
        "gamma": {
            "max": 100,
            "warning_at": 80
        },
        "vega": {
            "max": 500,
            "warning_at": 400
        },
        "theta": {
            "max": -200,
            "warning_at": -160
        },
        "var_95": {
            "max": 5000,
            "warning_at": 4000
        }
    }'::JSONB;
END;
$$ LANGUAGE plpgsql;
