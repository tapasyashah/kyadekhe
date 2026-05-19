'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/discover', label: 'Discover', icon: '🎴' },
  { href: '/feed', label: 'Feed', icon: '📋' },
  { href: '/mood', label: 'Mood', icon: '🎭' },
  { href: '/ask', label: 'Ask', icon: '💬' },
  { href: '/collections', label: 'Saved', icon: '🔖' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{ background: 'rgba(14,10,11,0.95)', borderColor: 'rgba(255,153,51,0.15)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors"
              style={{ color: isActive ? 'var(--saffron)' : 'var(--muted-foreground)' }}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
