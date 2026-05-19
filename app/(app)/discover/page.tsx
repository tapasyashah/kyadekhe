'use client'

import { useState, useEffect, useCallback } from 'react'
import { SwipeCard } from '@/components/swipe-card'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

interface RecommendedTitle {
  title: Tables<'titles'>
  tags: Record<string, unknown>
  streaming: Tables<'streaming_availability'>[]
  score: number
}

export default function DiscoverPage() {
  const [stack, setStack] = useState<RecommendedTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('IN')
  const [swiped, setSwiped] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('users').select('region').single().then(({ data }) => {
      if (data?.region) setRegion(data.region)
    })
  }, [])

  const fetchMore = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/recommendations?limit=10')
    if (res.ok) {
      const data = await res.json() as RecommendedTitle[]
      setStack((prev) => [...prev, ...data])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchMore() }, [fetchMore])

  // When stack runs low, fetch more
  useEffect(() => {
    if (stack.length < 3 && !loading) fetchMore()
  }, [stack.length, loading, fetchMore])

  async function handleSwipe(index: number, rating: 'loved' | 'liked' | 'skip', action: string) {
    const item = stack[index]
    if (!item) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await Promise.all([
      supabase.from('ratings').upsert({
        user_id: user.id,
        title_id: item.title.id,
        rating,
      }, { onConflict: 'user_id,title_id' }),
      supabase.from('recommendation_log').insert({
        user_id: user.id,
        title_id: item.title.id,
        action,
        reason_tags: [],
      }),
    ])

    setStack((prev) => prev.filter((_, i) => i !== index))
    setSwiped((n) => n + 1)
  }

  async function handleSwipeUp(index: number) {
    const item = stack[index]
    if (!item) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Add to Watch Next collection
    const { data: watchNext } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Watch Next')
      .single()

    if (watchNext) {
      await supabase.from('collection_items').upsert({
        collection_id: watchNext.id,
        title_id: item.title.id,
      }, { onConflict: 'collection_id,title_id', ignoreDuplicates: true })
    }

    setStack((prev) => prev.filter((_, i) => i !== index))
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
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4">
        <h1 className="font-display text-2xl font-bold text-saffron">KyaDekhe</h1>
        <span className="text-xs text-muted-foreground">{swiped} rated</span>
      </div>

      {/* Swipe hint */}
      <div className="flex justify-center gap-6 text-xs text-muted-foreground px-5 mb-4">
        <span>← Skip</span>
        <span>↑ Save</span>
        <span>Loved →</span>
      </div>

      {/* Card stack */}
      <div className="flex-1 relative mx-5 max-w-sm mx-auto" style={{ maxWidth: 400 }}>
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
