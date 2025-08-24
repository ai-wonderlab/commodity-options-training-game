#!/bin/bash

# Complete Supabase Setup Script
# This script automates the entire Supabase setup process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ASCII Art Header
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║     Commodity Options Training Game Setup      ║"
echo "║              Supabase Configuration             ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt for input
prompt_input() {
    local var_name=$1
    local prompt_text=$2
    local is_secret=$3
    
    if [ "$is_secret" = true ]; then
        read -s -p "$prompt_text: " value
        echo
    else
        read -p "$prompt_text: " value
    fi
    
    eval "$var_name='$value'"
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

if ! command_exists supabase; then
    echo -e "${YELLOW}📦 Installing Supabase CLI...${NC}"
    npm install -g supabase
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Check if already logged in
echo -e "${YELLOW}🔐 Checking Supabase authentication...${NC}"
if ! supabase projects list >/dev/null 2>&1; then
    echo -e "${YELLOW}Please login to Supabase${NC}"
    supabase login
fi

# Project selection
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}🎯 Project Configuration${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

echo -e "\nDo you want to:"
echo "1) Create a new Supabase project"
echo "2) Use an existing project"
read -p "Select option (1 or 2): " project_option

if [ "$project_option" = "1" ]; then
    # Create new project
    echo -e "${YELLOW}📝 Creating new Supabase project...${NC}"
    
    prompt_input PROJECT_NAME "Enter project name" false
    prompt_input PROJECT_REGION "Enter region (eu-west-1, us-east-1, etc.)" false
    prompt_input DB_PASSWORD "Enter database password (min 6 characters)" true
    
    echo -e "${YELLOW}Creating project...${NC}"
    PROJECT_REF=$(supabase projects create "$PROJECT_NAME" \
        --region "$PROJECT_REGION" \
        --db-password "$DB_PASSWORD" \
        --output json | jq -r '.ref')
    
    echo -e "${GREEN}✅ Project created: $PROJECT_REF${NC}"
    
    # Wait for project to be ready
    echo -e "${YELLOW}⏳ Waiting for project to be ready (this may take a few minutes)...${NC}"
    sleep 60
    
else
    # Use existing project
    echo -e "${YELLOW}📋 Available projects:${NC}"
    supabase projects list
    
    prompt_input PROJECT_REF "Enter project reference ID" false
fi

# Link project
echo -e "${YELLOW}🔗 Linking project...${NC}"
supabase link --project-ref "$PROJECT_REF"

# Get project details
echo -e "${YELLOW}📊 Getting project details...${NC}"
PROJECT_URL=$(supabase status --output json | jq -r '.API.URL')
ANON_KEY=$(supabase status --output json | jq -r '.API.anon_key')
SERVICE_KEY=$(supabase status --output json | jq -r '.API.service_key')

# Push database schema
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}🗄️ Database Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

echo -e "${YELLOW}📤 Pushing database migrations...${NC}"
supabase db push

echo -e "${YELLOW}🌱 Seeding database...${NC}"
if [ -f "supabase/seed.sql" ]; then
    supabase db seed
    echo -e "${GREEN}✅ Database seeded${NC}"
else
    echo -e "${YELLOW}⚠️ No seed file found, skipping...${NC}"
fi

# Deploy Edge Functions
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}⚡ Edge Functions${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

echo -e "${YELLOW}📤 Deploying Edge Functions...${NC}"
supabase functions deploy

# Configure Authentication
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}🔐 Authentication Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

echo -e "${YELLOW}Configure OAuth providers in Supabase Dashboard:${NC}"
echo -e "${BLUE}${PROJECT_URL}/project/${PROJECT_REF}/auth/providers${NC}"
echo ""
echo "1. Enable Google Provider:"
echo "   - Client ID: Get from Google Cloud Console"
echo "   - Client Secret: Get from Google Cloud Console"
echo ""
echo "2. Enable Microsoft Provider:"
echo "   - Application ID: Get from Azure Portal"
echo "   - Secret Value: Get from Azure Portal"
echo ""
read -p "Press Enter when OAuth is configured..."

# Create .env.local file
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}📝 Creating Environment File${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

ENV_FILE="apps/web/.env.local"
echo -e "${YELLOW}Creating $ENV_FILE...${NC}"

cat > "$ENV_FILE" << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY

# Project Reference
SUPABASE_PROJECT_REF=$PROJECT_REF
EOF

echo -e "${GREEN}✅ Environment file created${NC}"

# Test connection
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Testing Connection${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

echo -e "${YELLOW}Testing database connection...${NC}"
if supabase db test >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
fi

# Final summary
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

echo -e "\n${GREEN}Your Supabase project is ready!${NC}"
echo -e "\n${YELLOW}Project Details:${NC}"
echo -e "  Project URL: ${BLUE}$PROJECT_URL${NC}"
echo -e "  Project Ref: ${BLUE}$PROJECT_REF${NC}"
echo -e "  Dashboard: ${BLUE}https://app.supabase.com/project/$PROJECT_REF${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Start the development server:"
echo -e "     ${BLUE}npm run dev --workspace=@game/web${NC}"
echo -e ""
echo -e "  2. Open in browser:"
echo -e "     ${BLUE}http://localhost:3000${NC}"
echo -e ""
echo -e "  3. Create a session as instructor:"
echo -e "     ${BLUE}http://localhost:3000/instructor${NC}"

echo -e "\n${YELLOW}Useful Commands:${NC}"
echo -e "  View logs: ${BLUE}supabase functions logs${NC}"
echo -e "  DB status: ${BLUE}supabase db status${NC}"
echo -e "  Reset DB: ${BLUE}supabase db reset${NC}"

echo -e "\n${GREEN}Happy Trading! 🚀${NC}"

# Save configuration for future reference
CONFIG_FILE=".supabase-config"
echo -e "\n${YELLOW}Saving configuration to $CONFIG_FILE...${NC}"
cat > "$CONFIG_FILE" << EOF
PROJECT_REF=$PROJECT_REF
PROJECT_URL=$PROJECT_URL
SETUP_DATE=$(date)
EOF

echo -e "${GREEN}✅ Configuration saved${NC}"

# Optional: Start the application
echo -e "\n${YELLOW}Would you like to start the application now? (y/n)${NC}"
read -p "> " start_app

if [ "$start_app" = "y" ] || [ "$start_app" = "Y" ]; then
    echo -e "${YELLOW}🚀 Starting application...${NC}"
    cd apps/web
    npm run dev
fi
