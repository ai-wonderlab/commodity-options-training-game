import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Commodity Options Training Game - ICE Brent',
  description: 'Professional options trading simulator for ICE Brent crude oil futures and options. Education only.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
        <div className="fixed bottom-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
          Education only • 15-min delayed • EU data residency
        </div>
      </body>
    </html>
  )
}