import type { Metadata, Viewport } from 'next'

import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { CapacitorSetup } from '@/components/capacitor-setup'

import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Dani Cosméticos',
  description: 'Sistema de controle de vendas e estoque',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <CapacitorSetup />
        <Providers>
          {children}
          <Toaster />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
