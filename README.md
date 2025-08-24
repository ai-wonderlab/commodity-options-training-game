# 🎮 Commodity Options Training Game - ICE Brent

A professional-grade, desktop-first training application for commodity options trading on ICE Brent futures (BRN) and EU-style Brent options (BUL).

![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-Ready-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🚀 Features

### For Traders
- **Real-time Option Chain** - Live pricing for multiple strikes and expiries
- **Advanced Order Types** - Market and limit orders with instant execution
- **Risk Management** - Real-time Greeks calculation (Δ, Γ, ν, Θ, Vanna, Vomma)
- **VaR Monitoring** - 95% 1-day Value at Risk with visual warnings
- **Live Leaderboard** - Track performance against other participants
- **Position Management** - Monitor P&L and risk metrics in real-time

### For Instructors
- **Session Management** - Create and control multiple trading sessions
- **Player Monitoring** - Real-time oversight of all participants
- **Market Shocks** - Apply spot, volatility, and rate shocks
- **Risk Analytics** - Aggregate Greeks and risk metrics
- **Data Export** - CSV export for post-session analysis
- **Debrief Tools** - Comprehensive performance analytics

### Technical Features
- **Black-76 Pricing Model** - Accurate options pricing for commodity futures
- **Ornstein-Uhlenbeck Process** - Realistic price simulation
- **Volatility Smile** - Market-consistent implied volatility surface
- **Real-time Updates** - WebSocket-based live data streaming
- **SSO Authentication** - Google and Microsoft OAuth integration
- **EU Data Compliance** - GDPR-compliant with EU-region hosting

## 📦 Project Structure

```
commodity-options-training-game/
├── apps/
│   └── web/                    # Next.js web application
│       ├── app/                # App router pages
│       │   ├── instructor/     # Instructor console
│       │   └── session/        # Trading workspace
│       └── components/         # React components
├── packages/
│   └── shared/                 # Shared libraries
│       ├── src/
│       │   ├── black76.ts     # Options pricing
│       │   ├── dataProvider.ts # Market data
│       │   └── fillEngine.ts   # Order execution
│       └── test/              # Unit tests
├── supabase/
│   ├── functions/             # Edge Functions
│   └── migrations/            # Database schema
└── docs/                      # Documentation
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ and npm 9+
- Git
- Supabase account (for full functionality)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/ai-wonderlab/commodity-options-training-game.git
cd commodity-options-training-game

# Install dependencies
npm install

# Start development server
npm run dev --workspace=@game/web

# Open in browser
open http://localhost:3000
```

### Admin Quick Start

For instructors and administrators:

1. **Setup Supabase Backend**
   ```bash
   # Configure environment variables first (see Configuration section)
   ./scripts/setup-supabase.sh
   ```

2. **Access Instructor Console**
   ```
   http://localhost:3000/instructor
   ```

3. **Create a Session**
   - Click "Create Session" 
   - Set session parameters (duration, starting capital, margin requirements)
   - Share the session code with participants

4. **Monitor & Control**
   - View real-time player positions and P&L
   - Apply market shocks (spot, volatility, interest rates)
   - Export session data for analysis

5. **End Session & Debrief**
   - End session from instructor console
   - Access debrief page: `/session/[id]/debrief`
   - Review performance metrics and analytics

## 🔧 Configuration

### Environment Variables

Create `apps/web/.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Supabase Setup

1. **Create Project**
   ```bash
   ./scripts/setup-supabase.sh
   ```

2. **Configure OAuth**
   - Go to Supabase Dashboard → Authentication
   - Enable Google Provider
   - Enable Microsoft Provider
   - Add redirect URLs

3. **Push Database Schema**
   ```bash
   npx supabase db push
   ```

4. **Deploy Edge Functions**
   ```bash
   npx supabase functions deploy
   ```

## 🎮 Usage

### For Players

1. **Join a Session**
   - Navigate to http://localhost:3000
   - Enter Session ID provided by instructor
   - Enter your display name
   - Start trading!

2. **Place Orders**
   - Select strike and expiry from option chain
   - Choose BUY or SELL
   - Enter quantity
   - Submit order

3. **Monitor Risk**
   - Watch Greeks in real-time
   - Track VaR usage (must stay under limit)
   - Monitor P&L

### For Instructors

1. **Create Session**
   - Go to http://localhost:3000/instructor
   - Click "New Session"
   - Configure parameters (bankroll, VaR limit, etc.)
   - Share session ID with participants

2. **Manage Session**
   - Monitor all players in real-time
   - Apply market shocks when needed
   - Pause/resume trading
   - Export data for analysis

3. **Review Performance**
   - Access debrief at `/session/[id]/debrief`
   - Analyze performance metrics
   - Export final results

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific workspace tests
npm test --workspace=@game/shared

# Run with coverage
npm run test:coverage

# Run E2E tests (requires running app)
npm run test:e2e
```

## 📊 API Documentation

### Edge Functions

| Function | Method | Description |
|----------|--------|-------------|
| `/session-create` | POST | Create new trading session |
| `/session-join` | POST | Join existing session |
| `/session-state` | GET | Get current session state |
| `/order-submit` | POST | Submit trading order |
| `/host-shock` | POST | Apply market shock |
| `/export-csv` | GET | Export session data |

### WebSocket Channels

- `session:[id]` - Real-time session updates
- `player:[id]` - Individual player updates
- `market:[id]` - Market data stream

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel Dashboard
```

### Docker

```bash
# Build image
docker build -t commodity-options-game .

# Run container
docker run -p 3000:3000 commodity-options-game
```

### GitHub Pages (Static Export)

```bash
# Build for static export
npm run build:static

# Deploy to GitHub Pages
npm run deploy
```

## 📈 Performance

- **Response Time**: < 100ms for order execution
- **Concurrent Users**: Supports 100+ simultaneous traders
- **Real-time Updates**: < 50ms latency via WebSockets
- **Greeks Calculation**: < 10ms for full portfolio

## 🔐 Security

- **Authentication**: OAuth 2.0 with PKCE
- **Authorization**: Row-level security (RLS)
- **Data Encryption**: TLS 1.3 for all connections
- **Input Validation**: Strict TypeScript + Zod schemas
- **Rate Limiting**: Built-in DDoS protection

## 📚 Mathematical Models

### Black-76 Formula
Used for European option pricing on futures:

```
C = e^(-r*T) * [F*N(d1) - K*N(d2)]
P = e^(-r*T) * [K*N(-d2) - F*N(-d1)]

where:
d1 = [ln(F/K) + (σ²/2)*T] / (σ*√T)
d2 = d1 - σ*√T
```

### Greeks Calculations
- **Delta (Δ)**: Rate of change of option price with respect to underlying
- **Gamma (Γ)**: Rate of change of delta
- **Vega (ν)**: Sensitivity to volatility
- **Theta (Θ)**: Time decay
- **Vanna**: ∂²V/∂S∂σ
- **Vomma**: ∂²V/∂σ²

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- ICE (Intercontinental Exchange) for market data specifications
- Black-Scholes-Merton model contributors
- Supabase team for the amazing backend platform
- Next.js and Vercel teams for the framework

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/ai-wonderlab/commodity-options-training-game/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ai-wonderlab/commodity-options-training-game/discussions)

## 🌟 Status

- ✅ Core Trading Engine
- ✅ Instructor Console
- ✅ Risk Management
- ✅ Real-time Updates
- ✅ Authentication
- ✅ Debrief Analytics
- 🔄 Production Deployment
- 📋 Additional Markets (Coming Soon)

---

**Built with ❤️ for the next generation of commodity traders**