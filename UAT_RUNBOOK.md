# 🎯 UAT Runbook - Commodity Options Training Game

## Περιεχόμενα
1. [Προετοιμασία Περιβάλλοντος](#προετοιμασία-περιβάλλοντος)
2. [Test Scenarios](#test-scenarios)
3. [Acceptance Criteria](#acceptance-criteria)
4. [Checklist Ελέγχου](#checklist-ελέγχου)

---

## Προετοιμασία Περιβάλλοντος

### 1. Προαπαιτούμενα
- [ ] Node.js 18+ εγκατεστημένο
- [ ] Supabase project (EU region) δημιουργημένο
- [ ] GitHub repository με secrets configured
- [ ] SSO providers (Google/Microsoft) configured

### 2. Setup Commands
```bash
# Clone και install
git clone https://github.com/YOUR_ORG/commodity-options-training-game
cd commodity-options-training-game
npm ci

# Environment setup
cp env.example .env.local
# Edit .env.local με τα Supabase credentials

# Database setup
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy

# Local development
npm run dev
```

---

## Test Scenarios

### 📚 Scenario 1: Instructor Session Creation
**Ως εκπαιδευτής, θέλω να δημιουργήσω μια νέα εκπαιδευτική συνεδρία**

1. Login με Google/Microsoft SSO
2. Navigate to `/instructor`
3. Click "Νέα Συνεδρία"
4. Συμπληρώστε:
   - Όνομα: "Options Training - Test"
   - Συμμετέχοντες: 10
   - Διάρκεια: 60 λεπτά
   - Bankroll: $1,000,000
   - Mode: Live
   - Risk Limits: Delta 10000, Gamma 1000, Vega 50000, VaR $100k
5. Click "Δημιουργία & Έναρξη"

**Expected Results:**
- ✅ Session δημιουργείται με status "waiting"
- ✅ Instructor auto-joined ως participant
- ✅ Session controls εμφανίζονται
- ✅ Unique session code generated

### 🎮 Scenario 2: Participant Trading Flow
**Ως συμμετέχων, θέλω να εκτελέσω trades και να δω real-time updates**

1. Join session με τον κωδικό
2. Δείτε live market data (BRN @ $82.50)
3. Submit Market Order:
   - BUY 10 BRN Futures
   - Verify fill @ ask price
   - Check fees calculation
4. Submit Options Order:
   - BUY 5 BUL $85 Calls (1M expiry)
   - Set IV override to 27%
   - Verify Black-76 pricing
5. Monitor positions table updates
6. Check risk meters (Delta, Gamma, Vega, Theta)
7. View leaderboard ranking

**Expected Results:**
- ✅ Orders execute με proper fills
- ✅ Positions update σε real-time
- ✅ Greeks υπολογίζονται σωστά
- ✅ P&L updates live
- ✅ Risk breaches detected αν υπερβούν limits

### ⚡ Scenario 3: Market Shock Application
**Ως instructor, θέλω να εφαρμόσω market shock**

1. Με active session και participants
2. Navigate to Session Controls
3. Click "Market Shocks"
4. Apply "Bear -5%" shock
5. Observe:
   - Price drops to ~$78.38
   - IV increases by 10 pts
   - All positions revalue
   - Risk metrics update
   - Participants receive alert

**Expected Results:**
- ✅ Shock applies instantly
- ✅ All participants see price jump
- ✅ Greeks recalculate
- ✅ VaR updates
- ✅ Alert banner appears

### 📊 Scenario 4: What-If Analysis
**Ως participant, θέλω να αναλύσω scenarios**

1. Με ανοιχτές θέσεις
2. Navigate to "What-If Analysis"
3. Set scenario:
   - Price Change: +10%
   - Vol Change: -5 pts
   - Time Decay: 1 day
4. View results:
   - Total P&L projection
   - Greeks changes
   - VaR impact

**Expected Results:**
- ✅ Calculations complete < 500ms
- ✅ Position-by-position breakdown
- ✅ Risk warnings αν P&L > $100k

### 🏗️ Scenario 5: Strategy Builder
**Ως participant, θέλω να χτίσω option strategies**

1. Navigate to "Strategy Builder"
2. Select template "Bull Call Spread"
3. Verify auto-populated strikes
4. Adjust quantities
5. Execute strategy

**Expected Results:**
- ✅ Multiple orders submitted
- ✅ Spread logic applied
- ✅ Net premium calculated
- ✅ Max profit/loss shown

### 📥 Scenario 6: Data Export
**Ως instructor, θέλω να εξάγω δεδομένα**

1. Complete session
2. Navigate to Export Manager
3. Select "Full Session Export"
4. Download CSV

**Expected Results:**
- ✅ CSV contains all trades
- ✅ Leaderboard final scores
- ✅ Risk snapshots included
- ✅ UTF-8 encoding σωστό

---

## Acceptance Criteria

### ✅ Core Functionality
| Feature | Requirement | Pass/Fail |
|---------|------------|-----------|
| **Pricing** | Black-76 European options | ⬜ |
| **Greeks** | Δ, Γ, V, Θ (FD for Θ) | ⬜ |
| **Risk** | VaR 95% scenario grid | ⬜ |
| **Breaches** | Allow-but-penalize | ⬜ |
| **Scoring** | Risk-adjusted με weights | ⬜ |
| **Data** | 15-min delayed mock/live | ⬜ |
| **Fills** | Market/Limit με mid±spread | ⬜ |
| **Capacity** | 25 concurrent participants | ⬜ |

### 🔒 Security & Compliance
| Requirement | Status | Notes |
|-------------|--------|-------|
| SSO Google+Microsoft | ⬜ | |
| EU Data Hosting | ⬜ | Supabase EU |
| GDPR Compliant | ⬜ | |
| Educational Disclaimers | ⬜ | All pages |
| Data Delay Notice | ⬜ | 15-min |

### 🎨 UI/UX Requirements
| Component | Desktop | Mobile | Dark Mode |
|-----------|---------|--------|-----------|
| Session Builder | ⬜ | N/A | ⬜ |
| Trading Interface | ⬜ | ⬜ | ⬜ |
| Risk Meters | ⬜ | ⬜ | ⬜ |
| Leaderboard | ⬜ | ⬜ | ⬜ |
| What-If Analysis | ⬜ | N/A | ⬜ |

### ⚡ Performance Targets
| Metric | Target | Actual | Pass |
|--------|--------|--------|------|
| Black-76 calc | < 1ms | ___ms | ⬜ |
| Greeks calc | < 2ms | ___ms | ⬜ |
| VaR calc | < 100ms | ___ms | ⬜ |
| Order fill | < 200ms | ___ms | ⬜ |
| UI update | < 100ms | ___ms | ⬜ |
| Page load | < 2s | ___s | ⬜ |

---

## Checklist Ελέγχου

### 🚀 Pre-Launch Checklist
- [ ] **Environment Variables**
  - [ ] SUPABASE_URL set
  - [ ] SUPABASE_ANON_KEY set
  - [ ] SUPABASE_SERVICE_ROLE_KEY secured
  - [ ] PROJECT_REF configured

- [ ] **Database**
  - [ ] All migrations applied
  - [ ] RLS policies active
  - [ ] Indexes created
  - [ ] Seed data loaded

- [ ] **Authentication**
  - [ ] Google OAuth configured
  - [ ] Microsoft OAuth configured
  - [ ] Redirect URLs whitelisted

- [ ] **Functions**
  - [ ] session-create deployed
  - [ ] session-join deployed
  - [ ] order-submit deployed
  - [ ] host-shock deployed
  - [ ] export-csv deployed

- [ ] **Realtime**
  - [ ] Channels configured
  - [ ] Broadcasting working
  - [ ] Throttling active

- [ ] **UI Components**
  - [ ] SessionBuilder tested
  - [ ] OrderTicket with IV override
  - [ ] MarketDataRealtime updates
  - [ ] LeaderboardRealtime sorting
  - [ ] WhatIfAnalysis calculations
  - [ ] StrategyBuilder templates
  - [ ] ComplianceBanner visible

### 📋 Session Test Flow
1. **Create Session** (Instructor)
   - [ ] Form validates
   - [ ] Session created
   - [ ] Status = "waiting"

2. **Join Session** (Participants)
   - [ ] Join code works
   - [ ] Max 25 participants
   - [ ] Seat assignment

3. **Start Trading**
   - [ ] Market data streams
   - [ ] Orders execute
   - [ ] Positions update
   - [ ] Greeks calculate
   - [ ] Breaches detect

4. **Apply Shocks** (Instructor)
   - [ ] Shock applies
   - [ ] Broadcast works
   - [ ] Recalculation triggers

5. **Complete Session**
   - [ ] Final scores
   - [ ] Export available
   - [ ] Data persisted

### 🐛 Known Issues / Limitations
1. **Data Provider**: Only mock data currently implemented
2. **Mobile**: Limited functionality on small screens
3. **Browser Support**: Chrome/Edge recommended
4. **Concurrent Sessions**: Max 10 per instructor

---

## Test Data

### Sample Trades for Testing
```javascript
// Futures Trade
{
  side: "BUY",
  type: "MKT",
  symbol: "BRN",
  quantity: 10
}

// Options Trade
{
  side: "BUY",
  type: "LMT",
  symbol: "BUL",
  strike: 85,
  expiry: "2024-01-19",
  optType: "C",
  quantity: 5,
  limitPrice: 2.50,
  ivOverride: 0.27
}
```

### Risk Breach Scenarios
1. **Delta Breach**: BUY 15 futures (exceeds 10k cap)
2. **Vega Breach**: BUY 100 ATM options
3. **VaR Breach**: Concentrated position in OTM options

---

## Contact & Support

**Technical Issues**: tech-support@commodity-options.training
**Training Questions**: education@commodity-options.training
**Emergency**: +30 xxx xxxx (Office hours)

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Lead Developer | | | |
| QA Lead | | | |
| Instructor Representative | | | |
| Compliance Officer | | | |

**UAT Status**: ⬜ PENDING / ⬜ PASSED / ⬜ FAILED

**Go-Live Decision**: ⬜ APPROVED / ⬜ DEFERRED

---

*Last Updated: December 2024*
*Version: 1.0.0*
