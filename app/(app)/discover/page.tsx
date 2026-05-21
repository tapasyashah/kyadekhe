'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { SwipeCard } from '@/components/swipe-card'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

interface RecommendedTitle {
  title: Tables<'titles'>
  tags: Record<string, unknown>
  streaming: Tables<'streaming_availability'>[]
  score: number
}

const LANGUAGES = ['All', 'Hindi', 'Gujarati'] as const
type Language = typeof LANGUAGES[number]
type AuthPrompt = 'save' | null

const SWIPE_HINT_KEY = 'kyadekhe_swipe_hint_seen'

export default function DiscoverPage() {
  const seenTitleIdsRef = useRef<Set<string>>(new Set())
  const [stack, setStack] = useState<RecommendedTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('IN')
  const [swiped, setSwiped] = useState(0)
  const [language, setLanguage] = useState<Language>('All')
  const [showHint, setShowHint] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [authPrompt, setAuthPrompt] = useState<AuthPrompt>(null)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    try {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          setIsGuest(true)
          return
        }
        supabase.from('users').select('region').eq('id', user.id).single().then(({ data }) => {
          if (data?.region) setRegion(data.region)
        })
      }).catch(() => setIsGuest(true))
    } catch {
      setIsGuest(true)
    }
  }, [])

  useEffect(() => {
    if (!localStorage.getItem(SWIPE_HINT_KEY)) {
      setShowHint(true)
    }
  }, [])

  function dismissHint() {
    localStorage.setItem(SWIPE_HINT_KEY, '1')
    setShowHint(false)
  }

  const fetchMore = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '12' })
    if (language !== 'All') params.set('language', language)
    const exclude = Array.from(seenTitleIdsRef.current).slice(-100)
    if (exclude.length > 0) params.set('exclude', exclude.join(','))

    const res = await fetch(`/api/recommendations?${params}`)
    if (res.ok) {
      const data = await res.json() as RecommendedTitle[]
      if (data.length === 0) setHasMore(false)
      setStack((prev) => {
        const existingIds = new Set(prev.map((item) => item.title.id))
        const fresh = data.filter((item) => !existingIds.has(item.title.id) && !seenTitleIdsRef.current.has(item.title.id))
        return [...prev, ...fresh]
      })
    } else {
      setHasMore(false)
    }
    setLoading(false)
  }, [language])

  useEffect(() => {
    seenTitleIdsRef.current.clear()
    setHasMore(true)
    setStack([])
    fetchMore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // When stack runs low, fetch more
  useEffect(() => {
    if (stack.length < 3 && !loading && hasMore) fetchMore()
  }, [stack.length, loading, hasMore, fetchMore])

  async function handleSwipe(index: number, rating: 'loved' | 'liked' | 'skip', action: string) {
    const item = stack[index]
    if (!item) return
    const titleId = item.title.id

    seenTitleIdsRef.current.add(titleId)
    setStack((prev) => prev.filter((candidate) => candidate.title.id !== titleId))
    setSwiped((n) => n + 1)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await Promise.all([
      supabase.from('ratings').upsert({
        user_id: user.id,
        title_id: titleId,
        rating,
      }, { onConflict: 'user_id,title_id' }),
      supabase.from('recommendation_log').insert({
        user_id: user.id,
        title_id: titleId,
        action,
        reason_tags: [],
      }),
    ])
  }

  async function handleSwipeUp(index: number) {
    const item = stack[index]
    if (!item) return
    const titleId = item.title.id

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAuthPrompt('save')
      return
    }

    // Add to Watch Next collection
    const { data: watchNext } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Watch Next')
      .single()

    let collectionId = watchNext?.id
    if (!collectionId) {
      const { data: created } = await supabase
        .from('collections')
        .insert({
          user_id: user.id,
          name: 'Watch Next',
          emoji: '🎬',
          description: 'Films and series to watch soon',
        })
        .select('id')
        .single()
      collectionId = created?.id
    }

    if (collectionId) {
      await supabase.from('collection_items').upsert({
        collection_id: collectionId,
        title_id: titleId,
      }, { onConflict: 'collection_id,title_id', ignoreDuplicates: true })
    }

    seenTitleIdsRef.current.add(titleId)
    setStack((prev) => prev.filter((candidate) => candidate.title.id !== titleId))
    setSwiped((n) => n + 1)
  }

  const topIndex = 0

  if (loading && stack.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-pulse">🎬</div>
        <p className="text-muted-foreground">Finding your picks...</p>
      </main>
    )
  }

  if (!loading && stack.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-5xl">✨</div>
        <h2 className="font-display text-2xl font-bold text-cream">You&apos;ve seen it all</h2>
        <p className="text-muted-foreground">Rate more films to get fresh picks, or explore the feed.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Swipe hint overlay — first visit only */}
      {showHint && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm px-8 text-center"
          onClick={dismissHint}
        >
          <div className="text-5xl">👋</div>
          <h2 className="font-display text-2xl font-bold text-cream">How to discover</h2>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="text-2xl">←</span>
              <span>Swipe left to skip</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">→</span>
              <span>Swipe right to love it</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">↑</span>
              <span>Swipe up to save for later</span>
            </div>
          </div>
          <button
            className="mt-2 rounded-full bg-saffron px-6 py-2 text-sm font-semibold text-black"
            onClick={dismissHint}
          >
            Got it
          </button>
        </div>
      )}

      {/* Guest banner */}
      {isGuest && (
        <div
          className="mx-5 mt-4 mb-2 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-sm"
          style={{ background: 'rgba(255,153,51,0.08)', border: '1px solid rgba(255,153,51,0.2)' }}
        >
          <span className="text-muted-foreground text-xs leading-snug">
            Sign in to save picks and get personalised recommendations.
          </span>
          <Link
            href="/auth/signup"
            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-black"
            style={{ background: 'rgb(var(--saffron))' }}
          >
            Sign up
          </Link>
        </div>
      )}

      {/* Account prompt */}
      {authPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: 'rgb(var(--card))', border: '1px solid rgba(255,153,51,0.2)' }}
          >
            <h2 className="font-display text-2xl font-bold text-cream">Save this pick?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Create a free account to keep a Watch Next list and turn your swipes into better recommendations.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setAuthPrompt(null)}
                className="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold text-muted-foreground"
                style={{ borderColor: 'rgba(255,153,51,0.18)' }}
              >
                Keep browsing
              </button>
              <Link
                href="/auth/signup?next=/discover"
                className="flex-1 rounded-xl bg-saffron px-4 py-3 text-center text-sm font-semibold text-black"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold text-saffron">KyaDekhe</h1>
        <span className="text-xs text-muted-foreground">{swiped} swiped</span>
      </div>

      {/* Language filter chips */}
      <div className="flex gap-2 px-5 mb-3">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`rounded-full px-4 py-1 text-xs font-medium transition-colors ${
              language === lang
                ? 'bg-saffron text-black'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Swipe direction hint */}
      <div className="flex justify-center gap-6 text-xs text-muted-foreground px-5 mb-4">
        <span>← Skip</span>
        <span>↑ Save</span>
        <span>Loved →</span>
      </div>

      {/* Card stack */}
      <div
        className="relative mx-auto w-full max-w-[400px] px-5 pb-3"
        style={{ height: 'clamp(380px, calc(100svh - 320px), 560px)' }}
      >
        {stack.slice(0, 4).map((item, i) => (
          <div
            key={item.title.id}
            className="absolute inset-0"
            style={{
              transform: `scale(${1 - i * 0.04}) translateY(${i * 12}px)`,
              zIndex: stack.length - i,
              pointerEvents: i === 0 ? 'auto' : 'none',
            }}
          >
            <SwipeCard
              title={item.title}
              tags={item.tags}
              streaming={item.streaming}
              region={region}
              isTop={i === topIndex}
              onSwipeRight={() => handleSwipe(i, 'loved', 'swiped_love')}
              onSwipeLeft={() => handleSwipe(i, 'skip', 'swiped_skip')}
              onSwipeUp={() => handleSwipeUp(i)}
            />
          </div>
        ))}
      </div>

      {/* Bottom padding for nav */}
      <div className="h-8" />
    </main>
  )
}
