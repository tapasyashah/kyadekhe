'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { SwipeCard } from '@/components/swipe-card'
import { createClient } from '@/lib/supabase/client'
import {
  encodeGuestTaste,
  rateGuestTitle,
  readGuestSavedTitles,
  readGuestTaste,
  saveGuestTitle,
  type GuestRating,
} from '@/lib/guest-taste'
import type { Tables } from '@/lib/supabase/types'

interface RecommendedTitle {
  title: Tables<'titles'>
  tags: Record<string, unknown>
  streaming: Tables<'streaming_availability'>[]
  score: number
}

const LANGUAGES = ['All', 'Hindi', 'Gujarati'] as const
type Language = typeof LANGUAGES[number]

const SWIPE_HINT_KEY = 'kyadekhe_swipe_hint_seen'
const LANGUAGE_PREF_KEY = 'kyadekhe_language_pref'

export default function DiscoverPage() {
  const seenTitleIdsRef = useRef<Set<string>>(new Set())
  const [stack, setStack] = useState<RecommendedTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('IN')
  const [swiped, setSwiped] = useState(0)
  const [language, setLanguage] = useState<Language>('All')
  const [showHint, setShowHint] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

  useEffect(() => {
    const taste = readGuestTaste()
    seenTitleIdsRef.current = new Set(taste.map((entry) => entry.titleId))
    setSwiped(taste.length)
    setSavedIds(new Set(readGuestSavedTitles().map((entry) => entry.title.id)))
    const storedLanguage = localStorage.getItem(LANGUAGE_PREF_KEY)
    if (storedLanguage === 'All' || storedLanguage === 'Hindi' || storedLanguage === 'Gujarati') {
      setLanguage(storedLanguage)
    }
    if (!localStorage.getItem(SWIPE_HINT_KEY)) setShowHint(true)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('region').eq('id', user.id).single().then(({ data }) => {
        if (data?.region) setRegion(data.region)
      })
    }).catch(() => null)
  }, [])

  function dismissHint() {
    localStorage.setItem(SWIPE_HINT_KEY, '1')
    setShowHint(false)
  }

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage)
    localStorage.setItem(LANGUAGE_PREF_KEY, nextLanguage)
  }

  const fetchMore = useCallback(async () => {
    setLoading(true)
    const guestTaste = readGuestTaste()
    const encodedTaste = encodeGuestTaste(guestTaste)
    const exclude = Array.from(new Set([
      ...Array.from(seenTitleIdsRef.current),
      ...guestTaste.map((entry) => entry.titleId),
    ])).slice(-220)

    const params = new URLSearchParams({ limit: '12' })
    if (language !== 'All') params.set('language', language)
    if (exclude.length > 0) params.set('exclude', exclude.join(','))
    if (encodedTaste.loved.length > 0) params.set('loved', encodedTaste.loved.join(','))
    if (encodedTaste.liked.length > 0) params.set('liked', encodedTaste.liked.join(','))
    if (encodedTaste.skip.length > 0) params.set('skip', encodedTaste.skip.join(','))

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
    seenTitleIdsRef.current = new Set(readGuestTaste().map((entry) => entry.titleId))
    setHasMore(true)
    setStack([])
    fetchMore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  useEffect(() => {
    if (stack.length < 3 && !loading && hasMore) fetchMore()
  }, [stack.length, loading, hasMore, fetchMore])

  async function handleSwipe(index: number, rating: GuestRating, action: string) {
    const item = stack[index]
    if (!item) return
    const titleId = item.title.id

    rateGuestTitle(titleId, rating)
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

  async function handleSave(index: number) {
    const item = stack[index]
    if (!item) return
    const titleId = item.title.id

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      saveGuestTitle(item.title)
      setSavedIds((prev) => new Set([...Array.from(prev), titleId]))
      setSavedNotice(`Saved ${item.title.title} for later`)
      window.setTimeout(() => setSavedNotice(null), 2200)
      return
    }

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
      setSavedNotice(`Saved ${item.title.title} for later`)
      window.setTimeout(() => setSavedNotice(null), 2200)
    }
  }

  if (loading && stack.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-pulse">🎬</div>
        <p className="text-muted-foreground">Finding your next picks...</p>
      </main>
    )
  }

  if (!loading && stack.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-5xl">✨</div>
        <h2 className="font-display text-2xl font-bold text-cream">You&apos;re caught up for now</h2>
        <p className="text-muted-foreground">
          Your browser has remembered these swipes. Try Ask KyaDekhe or another language filter for a fresh lane.
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col">
      {showHint && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/80 px-8 text-center backdrop-blur-sm"
          onClick={dismissHint}
        >
          <div className="text-5xl">👋</div>
          <h2 className="font-display text-2xl font-bold text-cream">Tune your picks</h2>
          <div className="flex flex-col gap-3 text-left text-sm text-muted-foreground">
            <div className="flex items-center gap-3"><span className="w-10 text-2xl">←</span><span>Pass titles you would not watch tonight.</span></div>
            <div className="flex items-center gap-3"><span className="w-10 text-2xl">Save</span><span>Keep a maybe-list without creating an account.</span></div>
            <div className="flex items-center gap-3"><span className="w-10 text-2xl">→</span><span>Like titles that look interesting.</span></div>
            <div className="flex items-center gap-3"><span className="w-10 text-2xl">↑</span><span>Love titles that feel exactly right.</span></div>
          </div>
          <button className="mt-2 rounded-full bg-saffron px-6 py-2 text-sm font-semibold text-black" onClick={dismissHint}>
            Start swiping
          </button>
        </div>
      )}

      {savedNotice && (
        <div className="fixed left-4 right-4 top-16 z-50 mx-auto max-w-sm rounded-full border px-4 py-2 text-center text-sm font-semibold text-cream shadow-2xl" style={{ background: 'rgba(22,101,52,0.92)', borderColor: 'rgba(34,197,94,0.4)' }}>
          {savedNotice}
        </div>
      )}

      <div className="flex items-start justify-between gap-5 px-5 pb-3 pt-5">
        <div>
          <h1 className="font-display text-[2rem] font-bold leading-none text-saffron">Discover</h1>
          <p className="mt-1 max-w-[18rem] text-sm leading-snug text-muted-foreground">
            Pick a mix, swipe a few titles, then open one that looks promising.
          </p>
        </div>
        <div className="pt-1 text-right text-xs text-muted-foreground">
          <p>{swiped} signals</p>
          <Link href="/collections" className="text-saffron">{savedIds.size} saved</Link>
        </div>
      </div>

      <div className="px-5 pb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What should we mix in?</p>
        <div className="grid grid-cols-3 gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => chooseLanguage(lang)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              language === lang ? 'bg-saffron text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {lang === 'All' ? 'Both' : lang}
          </button>
        ))}
        </div>
      </div>

      <div className="mx-5 mb-3 grid grid-cols-4 gap-1.5 rounded-2xl border p-2 text-center text-[11px] leading-tight text-muted-foreground" style={{ borderColor: 'rgba(255,153,51,0.14)', background: 'rgba(255,153,51,0.045)' }}>
        <span><b className="block text-cream">Pass</b>not for me</span>
        <span><b className="block text-cream">Save</b>maybe later</span>
        <span><b className="block text-cream">Like</b>interesting</span>
        <span><b className="block text-cream">Love</b>more of this</span>
      </div>

      <div className="mb-2 flex justify-center gap-5 px-5 text-xs text-muted-foreground">
        <span>← Pass</span>
        <span>↑ Love</span>
        <span>Like →</span>
      </div>

      <div
        className="relative mx-auto w-full max-w-[390px] px-5 pb-3"
        style={{ height: 'clamp(360px, calc(100svh - 390px), 520px)' }}
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
              isTop={i === 0}
              isSaved={savedIds.has(item.title.id)}
              onLike={() => handleSwipe(i, 'liked', 'swiped_like')}
              onLove={() => handleSwipe(i, 'loved', 'swiped_love')}
              onHate={() => handleSwipe(i, 'skip', 'swiped_skip')}
              onSave={() => handleSave(i)}
            />
          </div>
        ))}
      </div>

      <div className="mx-auto mt-3 grid w-full max-w-[390px] grid-cols-4 gap-2 px-5 pb-6">
        <button type="button" onClick={() => handleSwipe(0, 'skip', 'button_skip')} className="rounded-xl border px-2 py-3 text-sm font-semibold text-red-200" style={{ borderColor: 'rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.22)' }}>
          Pass
        </button>
        <button type="button" onClick={() => handleSave(0)} className="rounded-xl border px-2 py-3 text-sm font-semibold text-cream" style={{ borderColor: 'rgba(255,248,231,0.24)', background: 'rgba(255,248,231,0.08)' }}>
          Save
        </button>
        <button type="button" onClick={() => handleSwipe(0, 'liked', 'button_like')} className="rounded-xl border px-2 py-3 text-sm font-semibold text-cream" style={{ borderColor: 'rgba(255,153,51,0.35)', background: 'rgba(255,153,51,0.16)' }}>
          Like it
        </button>
        <button type="button" onClick={() => handleSwipe(0, 'loved', 'button_love')} className="rounded-xl border px-2 py-3 text-sm font-semibold text-amber-100" style={{ borderColor: 'rgba(251,191,36,0.45)', background: 'rgba(146,64,14,0.22)' }}>
          Love
        </button>
      </div>
    </main>
  )
}
