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
  title: 'KyaDekhe: Your Indian Cinema Guide',
  description: 'Discover Bollywood, Gujarati, and Indian films you\'ll love. Swipe, rate, and get recommendations that actually match your taste.',
  metadataBase: new URL('https://kyadekhe.vercel.app'),
  openGraph: {
    title: 'KyaDekhe: Your Indian Cinema Guide',
    description: 'Swipe through Bollywood and Gujarati cinema. Get picks that actually match your taste.',
    url: 'https://kyadekhe.vercel.app',
    siteName: 'KyaDekhe',
    type: 'website',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'KyaDekhe: Bollywood and Indian cinema discovery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KyaDekhe: Your Indian Cinema Guide',
    description: 'Swipe through Bollywood and Gujarati cinema. Get picks that actually match your taste.',
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
