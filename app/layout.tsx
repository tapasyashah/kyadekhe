import type { Metadata } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'KyaDekhe — What to Watch in Bollywood',
  description: 'Discover Hindi and Gujarati films you haven\'t seen — intelligently. Swipe, rate, and get culturally aware recommendations.',
  metadataBase: new URL('https://kyadekhe.vercel.app'),
  openGraph: {
    title: 'KyaDekhe — What to Watch in Bollywood',
    description: 'Swipe through Bollywood. Get picks that actually match your taste.',
    url: 'https://kyadekhe.vercel.app',
    siteName: 'KyaDekhe',
    type: 'website',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'KyaDekhe — Bollywood discovery app',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KyaDekhe — What to Watch in Bollywood',
    description: 'Swipe through Bollywood. Get picks that actually match your taste.',
    images: ['/api/og'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
