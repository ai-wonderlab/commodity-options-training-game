import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../components/AuthProvider';
import AuthButton from '../components/AuthButton';
import QuickNav from '../components/QuickNav';

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
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="max-w-screen-2xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                      Commodity Options Training Game
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Education only • ICE Brent (BRN) & Options (BUL) • 15-min delayed • EU region only
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <AuthButton />
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
          </div>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
          <QuickNav />
        </AuthProvider>
      </body>
    </html>
  );
}