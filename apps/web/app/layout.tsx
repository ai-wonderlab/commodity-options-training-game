import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../components/AuthProvider';
import AuthButton from '../components/AuthButton';
import AuthButtonEnhanced from '../components/AuthButtonEnhanced';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import QuickNav from '../components/QuickNav';
import ComplianceBanner from '../components/ComplianceBanner';

export const metadata = {
  title: 'Commodity Options Training Game - ICE Brent',
  description: 'Desktop-first training game for EU-style Brent options (BUL) on ICE Brent futures (BRN)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground font-sans">
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <header className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/95">
              <div className="max-w-screen-2xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-h4 font-serif font-bold text-foreground">
                      Commodity Options Training Game
                    </h1>
                    <p className="text-caption text-muted-foreground">
                      Education only • ICE Brent (BRN) & Options (BUL) • 15-min delayed • EU region only
                    </p>
                  </div>
                                <div className="flex items-center gap-4">
                <div id="auth-button">
                  {isSupabaseConfigured() ? <AuthButtonEnhanced /> : <AuthButton />}
                </div>
              </div>
                </div>
              </div>
            </header>
            <main className="flex-1 bg-background">
              {children}
            </main>
          </div>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
          <QuickNav />
          <ComplianceBanner />
        </AuthProvider>
      </body>
    </html>
  );
}