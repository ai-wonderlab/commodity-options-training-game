-- =============================================
-- Commodity Options Training Game - Initial Schema
-- ICE Brent (BRN) futures & EU-Style Brent options (BUL)
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- SESSIONS TABLE
-- Represents individual game sessions
-- =============================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT NOT NULL CHECK (mode IN ('live', 'replay')),
    instruments JSONB NOT NULL DEFAULT '[]',
    bankroll NUMERIC(15,2) NOT NULL DEFAULT 100000,
    spread_config JSONB NOT NULL DEFAULT '{"default_spread": 0.02}',
    fee_config JSONB NOT NULL DEFAULT '{"per_contract": 2.50, "percentage": 0.0001}',
    var_limit NUMERIC(15,2) NOT NULL DEFAULT 5000,
    scoring_weights JSONB NOT NULL DEFAULT '{"alpha": 0.1, "beta": 0.2, "gamma": 0.1}',
    data_source TEXT NOT NULL DEFAULT 'mock' CHECK (data_source IN ('mock', 'refinitiv', 'ice')),
    replay_day DATE,
    replay_speed INTEGER DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    instructor_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- PARTICIPANTS TABLE
-- Players in each session
-- =============================================
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    seat_no INTEGER NOT NULL,
    sso_user_id TEXT NOT NULL,
    is_instructor BOOLEAN NOT NULL DEFAULT false,
    initial_bankroll NUMERIC(15,2) NOT NULL DEFAULT 100000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(session_id, seat_no),
    UNIQUE(session_id, sso_user_id)
);

-- =============================================
-- ORDERS TABLE
-- All trading orders (executed and pending)
-- =============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    type TEXT NOT NULL CHECK (type IN ('MKT', 'LMT')),
    symbol TEXT NOT NULL, -- 'BRN' for futures
    expiry DATE, -- NULL for futures, date for options
    strike NUMERIC(10,2), -- NULL for futures, strike for options
    opt_type TEXT CHECK (opt_type IN ('C', 'P')), -- NULL for futures
    qty INTEGER NOT NULL,
    limit_price NUMERIC(10,2), -- NULL for market orders
    iv_override NUMERIC(8,6), -- Manual IV override for options
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED', 'REJECTED')),
    fill_price NUMERIC(10,2),
    fees NUMERIC(10,2) DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    filled_at TIMESTAMPTZ
);

-- =============================================
-- POSITIONS TABLE
-- Current positions for each participant
-- =============================================
CREATE TABLE positions (
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    expiry DATE, -- NULL for futures
    strike NUMERIC(10,2), -- NULL for futures
    opt_type TEXT CHECK (opt_type IN ('C', 'P')), -- NULL for futures
    net_qty INTEGER NOT NULL DEFAULT 0,
    avg_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    realized_pnl NUMERIC(15,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (participant_id, symbol, COALESCE(expiry, '1900-01-01'::date), COALESCE(strike, 0), COALESCE(opt_type, ''))
);

-- =============================================
-- GREEK_SNAPSHOTS TABLE
-- Historical Greek calculations for risk monitoring
-- =============================================
CREATE TABLE greek_snapshots (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    delta NUMERIC(15,6) NOT NULL DEFAULT 0,
    gamma NUMERIC(15,6) NOT NULL DEFAULT 0,
    vega NUMERIC(15,6) NOT NULL DEFAULT 0,
    theta NUMERIC(15,6) NOT NULL DEFAULT 0,
    vanna NUMERIC(15,6) NOT NULL DEFAULT 0,
    vomma NUMERIC(15,6) NOT NULL DEFAULT 0,
    var_estimate NUMERIC(15,2) NOT NULL DEFAULT 0,
    portfolio_value NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- =============================================
-- BREACH_EVENTS TABLE
-- Risk limit violations
-- =============================================
CREATE TABLE breach_events (
    id BIGSERIAL PRIMARY KEY,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('DELTA', 'GAMMA', 'VEGA', 'THETA', 'VAR')),
    start_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_ts TIMESTAMPTZ,
    severity TEXT NOT NULL CHECK (severity IN ('WARNING', 'BREACH', 'CRITICAL')),
    limit_value NUMERIC(15,6) NOT NULL,
    actual_value NUMERIC(15,6) NOT NULL,
    penalty_applied NUMERIC(10,2) DEFAULT 0
);

-- =============================================
-- TICKS TABLE
-- Market data (prices and implied volatility)
-- =============================================
CREATE TABLE ticks (
    ts TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    last NUMERIC(10,2),
    best_bid NUMERIC(10,2),
    best_ask NUMERIC(10,2),
    mid NUMERIC(10,2),
    iv_surface_snapshot_id UUID REFERENCES iv_surface_snapshots(id),
    
    PRIMARY KEY (ts, symbol)
);

-- =============================================
-- IV_SURFACE_SNAPSHOTS TABLE
-- Implied volatility surfaces for options pricing
-- =============================================
CREATE TABLE iv_surface_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    provider TEXT NOT NULL DEFAULT 'mock',
    surface_json JSONB NOT NULL -- Structured IV data by strike/expiry
);

-- =============================================
-- LEADERBOARD TABLE
-- Real-time scoring and rankings
-- =============================================
CREATE TABLE leaderboard (
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    pnl NUMERIC(15,2) NOT NULL DEFAULT 0,
    score NUMERIC(15,2) NOT NULL DEFAULT 0,
    drawdown NUMERIC(15,2) NOT NULL DEFAULT 0,
    penalties NUMERIC(10,2) NOT NULL DEFAULT 0,
    rank INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (session_id, participant_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Sessions
CREATE INDEX idx_sessions_active ON sessions(is_active, created_at);
CREATE INDEX idx_sessions_instructor ON sessions(instructor_user_id);

-- Participants
CREATE INDEX idx_participants_session ON participants(session_id);
CREATE INDEX idx_participants_sso ON participants(sso_user_id);

-- Orders
CREATE INDEX idx_orders_session ON orders(session_id, ts DESC);
CREATE INDEX idx_orders_participant ON orders(participant_id, ts DESC);
CREATE INDEX idx_orders_status ON orders(status, ts DESC);

-- Greek snapshots
CREATE INDEX idx_greek_snapshots_participant ON greek_snapshots(participant_id, ts DESC);
CREATE INDEX idx_greek_snapshots_ts ON greek_snapshots(ts DESC);

-- Breach events
CREATE INDEX idx_breach_events_participant ON breach_events(participant_id, start_ts DESC);
CREATE INDEX idx_breach_events_active ON breach_events(participant_id, type) WHERE end_ts IS NULL;

-- Ticks
CREATE INDEX idx_ticks_symbol_ts ON ticks(symbol, ts DESC);
CREATE INDEX idx_ticks_ts ON ticks(ts DESC);

-- Leaderboard
CREATE INDEX idx_leaderboard_session ON leaderboard(session_id, rank);

-- =============================================
-- UPDATE TIMESTAMP TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaderboard_updated_at BEFORE UPDATE ON leaderboard
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE greek_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticks ENABLE ROW LEVEL SECURITY;
ALTER TABLE iv_surface_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Sessions: Users can only access sessions they participate in or instruct
CREATE POLICY "Users can view their sessions" ON sessions
    FOR SELECT USING (
        instructor_user_id = auth.jwt() ->> 'sub' OR
        id IN (
            SELECT session_id FROM participants 
            WHERE sso_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Instructors can modify their sessions" ON sessions
    FOR ALL USING (instructor_user_id = auth.jwt() ->> 'sub');

-- Participants: Users can see participants in their sessions
CREATE POLICY "Users can view session participants" ON participants
    FOR SELECT USING (
        sso_user_id = auth.jwt() ->> 'sub' OR
        session_id IN (
            SELECT session_id FROM participants 
            WHERE sso_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can update their own participant record" ON participants
    FOR UPDATE USING (sso_user_id = auth.jwt() ->> 'sub');

-- Orders: Users can see orders in their sessions
CREATE POLICY "Users can view session orders" ON orders
    FOR SELECT USING (
        participant_id IN (
            SELECT id FROM participants 
            WHERE sso_user_id = auth.jwt() ->> 'sub'
        ) OR
        session_id IN (
            SELECT session_id FROM participants 
            WHERE sso_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can create their own orders" ON orders
    FOR INSERT WITH CHECK (
        participant_id IN (
            SELECT id FROM participants 
            WHERE sso_user_id = auth.jwt() ->> 'sub'
        )
    );

-- Similar RLS policies for other tables following session membership pattern
CREATE POLICY "Users can view session positions" ON positions
    FOR SELECT USING (
        participant_id IN (
            SELECT id FROM participants 
            WHERE sso_user_id = auth.jwt() ->> 'sub'
        ) OR
        participant_id IN (
            SELECT p.id FROM participants p
            JOIN participants me ON p.session_id = me.session_id
            WHERE me.sso_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can view session greeks" ON greek_snapshots
    FOR SELECT USING (
        participant_id IN (
            SELECT p.id FROM participants p
            JOIN participants me ON p.session_id = me.session_id
            WHERE me.sso_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can view session breaches" ON breach_events
    FOR SELECT USING (
        participant_id IN (
            SELECT p.id FROM participants p
            JOIN participants me ON p.session_id = me.session_id
            WHERE me.sso_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Everyone can view ticks" ON ticks
    FOR SELECT USING (true);

CREATE POLICY "Everyone can view iv surfaces" ON iv_surface_snapshots
    FOR SELECT USING (true);

CREATE POLICY "Users can view session leaderboard" ON leaderboard
    FOR SELECT USING (
        session_id IN (
            SELECT session_id FROM participants 
            WHERE sso_user_id = auth.jwt() ->> 'sub'
        )
    );
