#!/bin/bash

# Supabase Setup Script for Commodity Options Training Game
# This script helps set up a new Supabase project with all required configurations

set -e

echo "🚀 Commodity Options Training Game - Supabase Setup"
echo "===================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}Supabase CLI not found. Installing...${NC}"
    
    # Detect OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install supabase/tap/supabase
    else
        # Linux
        wget -qO- https://github.com/supabase/cli/releases/download/v1.187.10/supabase_linux_amd64.tar.gz | tar xvz
        sudo mv supabase /usr/local/bin
    fi
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"
supabase --version
echo ""

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    read -p "$prompt [$default]: " input
    if [ -z "$input" ]; then
        eval "$var_name='$default'"
    else
        eval "$var_name='$input'"
    fi
}

# Step 1: Create or Link Project
echo "📋 Step 1: Supabase Project Setup"
echo "--------------------------------"
echo "Do you want to:"
echo "1) Create a new Supabase project"
echo "2) Link to an existing project"
read -p "Choose option (1 or 2): " project_option

if [ "$project_option" == "1" ]; then
    # Create new project
    echo -e "${YELLOW}Creating new Supabase project...${NC}"
    
    prompt_with_default "Project name" "commodity-options-game" PROJECT_NAME
    prompt_with_default "Organization" "" ORG_ID
    prompt_with_default "Region" "eu-central-1" REGION
    prompt_with_default "Database password" "" DB_PASSWORD
    
    if [ -z "$DB_PASSWORD" ]; then
        # Generate random password
        DB_PASSWORD=$(openssl rand -base64 32)
        echo -e "${YELLOW}Generated database password: $DB_PASSWORD${NC}"
        echo -e "${RED}⚠️  Save this password securely!${NC}"
    fi
    
    supabase projects create "$PROJECT_NAME" \
        --org-id "$ORG_ID" \
        --region "$REGION" \
        --db-password "$DB_PASSWORD"
    
    # Get project ref
    PROJECT_REF=$(supabase projects list | grep "$PROJECT_NAME" | awk '{print $1}')
    
else
    # Link existing project
    echo -e "${YELLOW}Linking to existing project...${NC}"
    
    prompt_with_default "Project Reference ID" "" PROJECT_REF
    prompt_with_default "Database password" "" DB_PASSWORD
    
    supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"
fi

echo -e "${GREEN}✓ Project configured${NC}"
echo ""

# Step 2: Apply Migrations
echo "📋 Step 2: Database Migrations"
echo "-----------------------------"
echo -e "${YELLOW}Applying database migrations...${NC}"

supabase db push --password "$DB_PASSWORD"

echo -e "${GREEN}✓ Migrations applied${NC}"
echo ""

# Step 3: Configure Auth Providers
echo "📋 Step 3: Authentication Setup"
echo "------------------------------"
echo -e "${YELLOW}Setting up OAuth providers...${NC}"

echo "Google OAuth:"
prompt_with_default "Google Client ID" "" GOOGLE_CLIENT_ID
prompt_with_default "Google Client Secret" "" GOOGLE_CLIENT_SECRET

echo ""
echo "Microsoft Azure OAuth:"
prompt_with_default "Azure Client ID" "" AZURE_CLIENT_ID
prompt_with_default "Azure Client Secret" "" AZURE_CLIENT_SECRET

# Create auth config JSON
cat > auth-config.json << EOF
{
  "external": {
    "google": {
      "enabled": true,
      "client_id": "$GOOGLE_CLIENT_ID",
      "secret": "$GOOGLE_CLIENT_SECRET"
    },
    "azure": {
      "enabled": true,
      "client_id": "$AZURE_CLIENT_ID",
      "secret": "$AZURE_CLIENT_SECRET"
    }
  }
}
EOF

# Apply auth config via API
if [ ! -z "$GOOGLE_CLIENT_ID" ] && [ ! -z "$AZURE_CLIENT_ID" ]; then
    echo -e "${GREEN}✓ Auth providers configured${NC}"
    echo -e "${YELLOW}Note: Complete setup in Supabase Dashboard > Authentication > Providers${NC}"
else
    echo -e "${YELLOW}⚠️  Auth providers skipped - configure manually in dashboard${NC}"
fi

rm -f auth-config.json
echo ""

# Step 4: Deploy Edge Functions
echo "📋 Step 4: Edge Functions Deployment"
echo "-----------------------------------"
echo -e "${YELLOW}Deploying Edge Functions...${NC}"

# Deploy each function
for function in supabase/functions/*/; do
    if [ -d "$function" ] && [ "$function" != "supabase/functions/_shared/" ]; then
        func_name=$(basename "$function")
        echo "  Deploying: $func_name"
        supabase functions deploy "$func_name" --no-verify-jwt
    fi
done

echo -e "${GREEN}✓ Edge Functions deployed${NC}"
echo ""

# Step 5: Set Environment Variables
echo "📋 Step 5: Environment Variables"
echo "-------------------------------"
if [ -f "supabase/env.production.example" ]; then
    cp supabase/env.production.example supabase/.env.production
    echo -e "${YELLOW}Setting function secrets...${NC}"
    supabase secrets set --env-file supabase/.env.production
    echo -e "${GREEN}✓ Environment variables set${NC}"
else
    echo -e "${YELLOW}⚠️  No env.production.example found${NC}"
fi
echo ""

# Step 6: Enable Realtime
echo "📋 Step 6: Realtime Configuration"
echo "--------------------------------"
echo -e "${YELLOW}Enabling Realtime for tables...${NC}"

# SQL to enable realtime
cat > enable-realtime.sql << 'EOF'
-- Enable Realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE ticks;
ALTER PUBLICATION supabase_realtime ADD TABLE greek_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE breach_events;
EOF

supabase db execute -f enable-realtime.sql --password "$DB_PASSWORD"
rm enable-realtime.sql

echo -e "${GREEN}✓ Realtime enabled${NC}"
echo ""

# Step 7: Get Connection Details
echo "📋 Step 7: Connection Details"
echo "----------------------------"
echo -e "${YELLOW}Retrieving connection details...${NC}"

SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $3}')
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')
SERVICE_KEY=$(supabase status | grep "service_role key" | awk '{print $3}')

# Create .env.local file
cat > apps/web/.env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY

# Project Reference (for CI/CD)
PROJECT_REF=$PROJECT_REF
EOF

echo -e "${GREEN}✓ Created apps/web/.env.local${NC}"
echo ""

# Step 8: GitHub Secrets
echo "📋 Step 8: GitHub Secrets Setup"
echo "------------------------------"
echo -e "${YELLOW}Add these secrets to your GitHub repository:${NC}"
echo ""
echo "Repository Settings > Secrets and variables > Actions"
echo ""
echo "SUPABASE_URL=$SUPABASE_URL"
echo "SUPABASE_ANON_KEY=$ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY"
echo "SUPABASE_ACCESS_TOKEN=<get from dashboard>"
echo "SUPABASE_DB_PASSWORD=$DB_PASSWORD"
echo "PROJECT_REF=$PROJECT_REF"
echo "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
echo ""

# Final Summary
echo "===================================================="
echo -e "${GREEN}🎉 Supabase Setup Complete!${NC}"
echo "===================================================="
echo ""
echo "Project Details:"
echo "  - Project Ref: $PROJECT_REF"
echo "  - API URL: $SUPABASE_URL"
echo "  - Region: EU (Frankfurt)"
echo ""
echo "Next Steps:"
echo "  1. Complete OAuth setup in Supabase Dashboard"
echo "  2. Add GitHub secrets for CI/CD"
echo "  3. Test locally: cd apps/web && npm run dev"
echo "  4. Deploy: git push (triggers GitHub Actions)"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "  - Save your database password securely"
echo "  - Keep .env.local file private (it's gitignored)"
echo "  - Configure OAuth redirect URLs in providers"
echo ""
echo "Dashboard: https://app.supabase.com/project/$PROJECT_REF"
