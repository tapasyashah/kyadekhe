'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/discover', label: 'Discover' },
  { href: '/ask', label: 'Ask' },
  { href: '/mood', label: 'Mood' },
  { href: '/feed', label: 'All picks' },
  { href: '/collections', label: 'Saved' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="sticky top-0 z-40 border-b"
      style={{ background: 'rgba(14,10,11,0.92)', borderColor: 'rgba(255,153,51,0.15)', backdropFilter: 'blur(14px)' }}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 overflow-x-auto px-4 scrollbar-none">
        <Link href="/discover" className="mr-2 whitespace-nowrap font-display text-lg font-bold text-saffron">
          KyaDekhe
        </Link>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                color: isActive ? '#0E0A0B' : 'rgb(var(--muted-foreground))',
                background: isActive ? 'rgb(var(--saffron))' : 'transparent',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
