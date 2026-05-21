import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 60%, rgba(92, 30, 46, 0.4) 0%, transparent 70%)',
        }}
      />

      {/* Logo */}
      <div className="relative z-10 mb-6">
        <h1 className="font-display text-6xl sm:text-7xl font-bold text-saffron tracking-tight">
          KyaDekhe
        </h1>
        <p className="text-lg text-muted-foreground mt-1 font-display italic">क्या देखे</p>
      </div>

      {/* Tagline */}
      <p className="relative z-10 text-xl sm:text-2xl text-cream max-w-xl leading-relaxed mb-4">
        Your guide to Indian cinema. Bollywood, Gujarati, and everything in between.
      </p>
      <p className="relative z-10 text-sm text-muted-foreground max-w-md mb-10">
        Not just &ldquo;you liked a thriller, here&apos;s another thriller.&rdquo; We understand{' '}
        <em>why</em> you&apos;ll love something.
      </p>

      {/* Features */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 max-w-2xl w-full">
        {[
          { emoji: '🎴', title: 'Swipe to Discover', desc: 'Rate films you know. Get Bollywood and Gujarati picks you haven\'t seen.' },
          { emoji: '🎭', title: 'Mood-Based Picks', desc: 'Diwali vibes? Missing home? Post-breakup feels? We match the moment.' },
          { emoji: '💬', title: 'Ask KyaDekhe', desc: '"Like Dil Chahta Hai but grittier." Or something Gujarati with heart. We find it.' },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl p-4 text-left"
            style={{ background: 'rgba(255,153,51,0.05)', border: '1px solid rgba(255,153,51,0.15)' }}
          >
            <div className="text-2xl mb-2">{f.emoji}</div>
            <div className="font-semibold text-cream text-sm mb-1">{f.title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-3">
        <Link
          href="/auth/signup"
          className={cn(buttonVariants({ size: 'lg' }), 'text-base px-8 font-semibold')}
          style={{ background: 'rgb(var(--saffron))', color: '#0E0A0B' }}
        >
          Start Discovering
        </Link>
        <Link
          href="/auth/login"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'text-base px-8')}
        >
          Sign In
        </Link>
      </div>

      {/* Guest mode */}
      <div className="relative z-10 mt-5">
        <Link
          href="/discover"
          className="text-sm text-muted-foreground hover:text-saffron transition-colors underline underline-offset-4"
        >
          Browse without signing in
        </Link>
      </div>

      {/* Footer note */}
      <p className="relative z-10 mt-8 text-xs text-muted-foreground">
        Built for people who&apos;ve seen every SRK film and are ready for what&apos;s next.
      </p>
    </main>
  )
}
