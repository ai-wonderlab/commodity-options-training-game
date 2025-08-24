export const metadata = {
  title: 'Commodity Options Training Game',
  description: 'Education-only training game for ICE Brent options (Black-76).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, Arial, sans-serif', color: '#0f172a' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Commodity Options Training Game</h1>
            <p style={{ fontSize: 12, color: '#334155' }}>
              Education only. Prices are delayed placeholders. EU data residency only. ICE delayed
              attribution placeholder.
            </p>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}