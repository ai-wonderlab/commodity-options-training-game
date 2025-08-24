#!/bin/bash

# Commodity Options Training Game - Complete Supabase Setup
# This script automates the entire Supabase setup process

set -e

echo "🎮 Commodity Options Training Game - Production Setup"
echo "======================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}Supabase CLI not found. Installing...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install supabase/tap/supabase
    else
        wget -qO- https://github.com/supabase/cli/releases/download/v1.187.10/supabase_linux_amd64.tar.gz | tar xvz
        sudo mv supabase /usr/local/bin
    fi
fi

echo -e "${GREEN}✓ Supabase CLI installed${NC}"
echo ""

# Step 1: Get Supabase credentials
echo "📝 Step 1: Supabase Project Setup"
echo "================================="
echo ""
echo "Please create a Supabase project at https://app.supabase.com"
echo "IMPORTANT: Select EU (Frankfurt) region for compliance!"
echo ""
read -p "Enter your Supabase Project Reference ID: " PROJECT_REF
read -p "Enter your Database Password: " -s DB_PASSWORD
echo ""
read -p "Enter your Supabase URL (https://xxx.supabase.co): " SUPABASE_URL
read -p "Enter your Anon/Public Key: " SUPABASE_ANON_KEY
read -p "Enter your Service Role Key: " -s SUPABASE_SERVICE_KEY
echo ""

# Step 2: Link project
echo ""
echo "🔗 Step 2: Linking Supabase Project..."
echo "======================================"
supabase link --project-ref $PROJECT_REF --password $DB_PASSWORD

# Step 3: Run migrations
echo ""
echo "🗄️ Step 3: Setting up Database..."
echo "================================="
supabase db push

# Step 4: Enable Realtime
echo ""
echo "⚡ Step 4: Enabling Realtime..."
echo "==============================="
cat > /tmp/enable-realtime.sql << 'EOF'
-- Enable Realtime for all game tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE ticks;
ALTER PUBLICATION supabase_realtime ADD TABLE greek_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE breach_events;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_session_participant ON orders(session_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_positions_participant ON positions(participant_id);
CREATE INDEX IF NOT EXISTS idx_ticks_latest ON ticks(symbol, ts DESC);
EOF

supabase db execute -f /tmp/enable-realtime.sql

# Step 5: Deploy Edge Functions
echo ""
echo "🚀 Step 5: Deploying Edge Functions..."
echo "======================================"
cd supabase/functions

for func in session-create session-join session-state order-submit host-shock export-csv session-next-day session-update-status; do
    if [ -d "$func" ]; then
        echo "Deploying $func..."
        supabase functions deploy $func --no-verify-jwt
    fi
done

cd ../..

# Step 6: Create environment file
echo ""
echo "🔧 Step 6: Creating Environment Configuration..."
echo "=============================================="
cat > apps/web/.env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY

# App Configuration
NEXT_PUBLIC_APP_NAME=Commodity Options Training Game
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_REGION=EU

# Feature Flags
NEXT_PUBLIC_ENABLE_AUTH=true
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=false
EOF

echo -e "${GREEN}✓ Environment file created${NC}"

# Step 7: Seed initial data
echo ""
echo "🌱 Step 7: Seeding Initial Data..."
echo "================================="
cat > /tmp/seed-data.sql << 'EOF'
-- Insert default instruments
INSERT INTO sessions (id, mode, instruments, bankroll, var_limit, data_source)
VALUES (
    'TEST-SESSION-' || extract(epoch from now())::text,
    'live',
    '[
        {"symbol": "BRN", "type": "future", "name": "ICE Brent Futures"},
        {"symbol": "BUL", "type": "option", "name": "ICE Brent Options"}
    ]'::jsonb,
    100000,
    5000,
    'mock'
) ON CONFLICT DO NOTHING;

-- Insert sample tick data
INSERT INTO ticks (ts, symbol, last, best_bid, best_ask, mid)
VALUES 
    (NOW(), 'BRN', 82.50, 82.45, 82.55, 82.50),
    (NOW(), 'BUL-C-85-MAR', 2.35, 2.30, 2.40, 2.35),
    (NOW(), 'BUL-P-80-MAR', 1.85, 1.80, 1.90, 1.85);
EOF

supabase db execute -f /tmp/seed-data.sql

# Step 8: Test the setup
echo ""
echo "🧪 Step 8: Testing Setup..."
echo "=========================="

# Test database connection
if supabase db remote list > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    exit 1
fi

# Test API endpoint
if curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/sessions" \
    -H "apikey: $SUPABASE_ANON_KEY" | grep -q "200"; then
    echo -e "${GREEN}✓ API endpoint accessible${NC}"
else
    echo -e "${YELLOW}⚠ API endpoint test failed (might need auth setup)${NC}"
fi

echo ""
echo "======================================"
echo -e "${GREEN}🎉 SETUP COMPLETE!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Configure OAuth providers in Supabase Dashboard"
echo "2. Run: cd apps/web && npm run dev"
echo "3. Visit: http://localhost:3000"
echo ""
echo "Supabase Dashboard: https://app.supabase.com/project/$PROJECT_REF"
echo ""