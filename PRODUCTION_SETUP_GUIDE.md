# 🚀 PRODUCTION SETUP GUIDE - Commodity Options Training Game

## ✅ ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ

### Ολοκληρωμένα (100%)
- ✅ UI/UX Design System
- ✅ Database Schema & Migrations
- ✅ Supabase Client Configuration
- ✅ Environment Template
- ✅ Setup Scripts
- ✅ Real-time Components Created

### Έτοιμα για Σύνδεση (80%)
- ⚡ MarketDataLive Component
- ⚡ LeaderboardLive Component
- ⚡ Instructor Page (Real Counts)
- ⚡ Supabase Types & Interfaces

### Απαιτούν Supabase (0%)
- ❌ Authentication (OAuth)
- ❌ Real Orders Processing
- ❌ Position Tracking
- ❌ Greek Calculations
- ❌ Risk Management

---

## 📋 ΟΔΗΓΙΕΣ ΕΓΚΑΤΑΣΤΑΣΗΣ

### ΒΗΜΑ 1: Δημιουργία Supabase Project (10 λεπτά)

1. **Πήγαινε στο** https://app.supabase.com
2. **Κάνε Sign Up/Login**
3. **Πάτα "New Project"**
4. **Συμπλήρωσε:**
   ```
   Name: commodity-options-game
   Database Password: [ΚΡΑΤΑ ΤΟ ΑΣΦΑΛΕΣ!]
   Region: Europe (Frankfurt) - EU  ⚠️ ΣΗΜΑΝΤΙΚΟ!
   ```
5. **Περίμενε 2-3 λεπτά να δημιουργηθεί**

### ΒΗΜΑ 2: Αντιγραφή Credentials (2 λεπτά)

Από το Supabase Dashboard:
1. **Πήγαινε:** Settings → API
2. **Αντίγραψε:**
   - Project URL: `https://xxxxx.supabase.co`
   - Anon/Public Key: `eyJhbGciOiJ...`
   - Service Role Key: `eyJhbGciOiJ...`
3. **Αποθήκευσε σε ασφαλές μέρος!**

### ΒΗΜΑ 3: Setup Environment (5 λεπτά)

```bash
# 1. Αντίγραψε το template
cp ENV_TEMPLATE.txt apps/web/.env.local

# 2. Άνοιξε και συμπλήρωσε
nano apps/web/.env.local

# Βάλε τα credentials που αντέγραψες:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
```

### ΒΗΜΑ 4: Εκτέλεση Setup Script (15 λεπτά)

```bash
# 1. Κάνε το script εκτελέσιμο
chmod +x scripts/complete-supabase-setup.sh

# 2. Τρέξε το
./scripts/complete-supabase-setup.sh

# 3. Θα σου ζητήσει:
# - Project Reference ID (από Supabase Dashboard)
# - Database Password
# - URLs και Keys
```

### ΒΗΜΑ 5: Manual Database Setup (Αν αποτύχει το script)

```bash
# 1. Εγκατάσταση Supabase CLI
brew install supabase/tap/supabase

# 2. Login
supabase login

# 3. Link project
supabase link --project-ref YOUR_PROJECT_REF

# 4. Push migrations
supabase db push

# 5. Enable realtime
supabase db execute -f supabase/sql/enable-realtime.sql
```

### ΒΗΜΑ 6: Deploy Edge Functions (10 λεπτά)

```bash
cd supabase/functions

# Deploy κάθε function
supabase functions deploy session-create --no-verify-jwt
supabase functions deploy session-join --no-verify-jwt
supabase functions deploy session-state --no-verify-jwt
supabase functions deploy order-submit --no-verify-jwt
supabase functions deploy host-shock --no-verify-jwt
supabase functions deploy export-csv --no-verify-jwt

cd ../..
```

### ΒΗΜΑ 7: Ενεργοποίηση OAuth (Optional - 10 λεπτά)

Στο Supabase Dashboard:
1. **Authentication → Providers**
2. **Enable Google:**
   - Client ID: από Google Cloud Console
   - Client Secret: από Google Cloud Console
3. **Enable Microsoft:**
   - Client ID: από Azure Portal
   - Client Secret: από Azure Portal

### ΒΗΜΑ 8: Test Locally (5 λεπτά)

```bash
# 1. Σταμάτα τον τρέχων server
# Ctrl+C στο terminal που τρέχει

# 2. Ξεκίνα ξανά
cd apps/web
npm run dev

# 3. Άνοιξε
http://localhost:3000
```

---

## 🧪 ΔΟΚΙΜΑΣΤΙΚΗ ΧΡΗΣΗ

### Test 1: Instructor Dashboard
1. Πήγαινε: http://localhost:3000/instructor
2. Πάτα "New Session"
3. Δημιούργησε session με:
   - Mode: Live
   - Bankroll: 100000
   - VaR Limit: 5000
4. Θα πρέπει να δεις το session ID

### Test 2: Join Session
1. Αντίγραψε το Session ID
2. Πήγαινε: http://localhost:3000
3. Πάτα "Join Session"
4. Βάλε το ID και όνομα

### Test 3: Market Data
1. Στο session page
2. Θα πρέπει να δεις:
   - Live indicator (πράσινο)
   - Real-time prices
   - Bid/Ask/Mid updates

### Test 4: Submit Order
1. Στο Order Ticket
2. Επίλεξε BUY
3. Βάλε quantity: 5
4. Submit Order
5. Δες το στο Positions

---

## 🔥 ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ

### Phase 3: Real Trading (4 ώρες)
```typescript
// 1. Fix OrderTicket submission
// 2. Connect fill engine
// 3. Update positions real-time
// 4. Calculate P&L
```

### Phase 4: Authentication (2 ώρες)
```typescript
// 1. Setup OAuth providers
// 2. Add login flow
// 3. Protect routes
```

### Phase 5: Testing (2 ώρες)
```typescript
// 1. End-to-end tests
// 2. Performance optimization
// 3. Bug fixes
```

### Phase 6: Deployment (1 ώρα)
```bash
# Deploy to Vercel
vercel deploy --prod
```

---

## ⚠️ ΣΥΧΝΑ ΠΡΟΒΛΗΜΑΤΑ

### "Supabase not configured"
✅ Έλεγξε ότι το `.env.local` υπάρχει και έχει τα σωστά keys

### "Database connection failed"
✅ Έλεγξε ότι το project δεν είναι paused (Free tier)

### "Edge function not found"
✅ Deploy ξανά με `--no-verify-jwt` flag

### "No data showing"
✅ Τρέξε το seed script:
```bash
supabase db execute -f supabase/seed.sql
```

---

## 📞 ΥΠΟΣΤΗΡΙΞΗ

- **Supabase Status**: https://status.supabase.com
- **Documentation**: https://supabase.com/docs
- **Discord**: https://discord.supabase.com

---

## ✅ CHECKLIST ΟΛΟΚΛΗΡΩΣΗΣ

- [ ] Supabase Project Created (EU Region)
- [ ] Environment Variables Set
- [ ] Database Migrations Run
- [ ] Edge Functions Deployed
- [ ] Realtime Enabled
- [ ] OAuth Configured (Optional)
- [ ] Local Testing Successful
- [ ] First Session Created
- [ ] First Order Submitted

---

## 🎯 DEFINITION OF DONE

Όταν όλα τα παραπάνω είναι ✅, το παιχνίδι είναι **PRODUCTION READY**!

---

**ΚΑΛΗ ΕΠΙΤΥΧΙΑ! 🚀**
