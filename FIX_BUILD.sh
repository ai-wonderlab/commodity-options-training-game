#!/bin/bash

echo "🔧 Διόρθωση Build Issues για Commodity Options Training Game"
echo "================================================"

# 1. Fix TypeScript error in page.tsx
echo "📝 Διόρθωση TypeScript errors..."
sed -i '' "s/toast.error(error.message || 'Failed to create session')/toast.error((error as any).message || 'Failed to create session')/g" apps/web/app/page.tsx
sed -i '' "s/toast.error(error.message || 'Failed to join session')/toast.error((error as any).message || 'Failed to join session')/g" apps/web/app/page.tsx

# 2. Install missing ESLint
echo "📦 Εγκατάσταση ESLint..."
cd apps/web && npm install --save-dev eslint && cd ../..

# 3. Create .env.example
echo "🔐 Δημιουργία .env.example..."
cat > .env.example << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# GitHub Actions Secrets (add to repo settings)
SUPABASE_ACCESS_TOKEN=your_access_token_here
PROJECT_REF=your_project_ref_here
EOF

# 4. Create proper tailwind config
echo "🎨 Διόρθωση Tailwind configuration..."
cat > apps/web/tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brent-blue': '#003366',
        'brent-green': '#00a652',
        'brent-red': '#dc2626',
        'brent-orange': '#f97316',
      },
    },
  },
  plugins: [],
}
export default config
EOF

# 5. Test build
echo "🏗️ Testing build..."
npm run build --workspaces

echo "✅ Build fixes complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env.local and fill in values"
echo "2. Setup Supabase project"
echo "3. Run 'npm run dev' to test locally"
