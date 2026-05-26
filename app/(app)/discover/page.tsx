'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { SwipeCard } from '@/components/swipe-card'
import { PosterImage } from '@/components/poster-image'
import { createClient } from '@/lib/supabase/client'
import {
  countTasteSignals,
  decideGuestRecommendation,
  encodeGuestTaste,
  rateGuestTitle,
  readGuestRecommendationDecisions,
  readGuestSavedTitles,
  readGuestTaste,
  type GuestRating,
  type GuestRecommendationDecision,
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
type Mode = 'training' | 'recommendations'

const TASTE_TARGET = 10
const ONBOARDING_KEY = 'kyadekhe_taste_onboarding_seen_v2'
const LANGUAGE_PREF_KEY = 'kyadekhe_language_pref'
const MODE_KEY = 'kyadekhe_discover_mode_v1'

const TRAINING_FEEDBACK: Record<GuestRating, string> = {
  not_watched: 'Skipped. Not counted in taste.',
  disliked: 'Got it. Less like this.',
  liked: 'Nice, more like this.',
  loved: 'Strong signal saved.',
}

const DECISION_FEEDBACK: Record<GuestRecommendationDecision, string> = {
  not_interested: 'Got it. We will move past this one.',
  maybe_later: 'Saved for later.',
  watch_tonight: 'Added to tonight.',
}

function dbRatingFor(rating: GuestRating): 'loved' | 'liked' | 'disliked' | 'havent_seen' {
  if (rating === 'not_watched') return 'havent_seen'
  if (rating === 'disliked') return 'disliked'
  return rating
}

function reasonFromTags(tags: Record<string, unknown>, language?: string | null) {
  const parts = [
    typeof tags.emotional_weight === 'string' ? tags.emotional_weight : null,
    typeof tags.watch_with === 'string' ? tags.watch_with : null,
    typeof tags.era === 'string' ? tags.era : null,
    language === 'hi' ? 'Hindi' : language === 'gu' ? 'Gujarati' : null,
  ].filter(Boolean)

  if (parts.length === 0) return 'Because it fits the taste signals you just gave.'
  return `Because it matches your taste for ${parts.slice(0, 3).join(', ')}.`
}

export default function DiscoverPage() {
  const seenTitleIdsRef = useRef<Set<string>>(new Set())
  const [stack, setStack] = useState<RecommendedTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('IN')
  const [language, setLanguage] = useState<Language>('All')
  const [mode, setMode] = useState<Mode>('training')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showReady, setShowReady] = useState(false)
  const [readyDismissed, setReadyDismissed] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [tasteProgress, setTasteProgress] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const taste = readGuestTaste()
    const progress = countTasteSignals(taste)
    const storedMode = localStorage.getItem(MODE_KEY)
    const initialMode: Mode = storedMode === 'recommendations' && progress >= TASTE_TARGET ? 'recommendations' : 'training'

    seenTitleIdsRef.current = new Set(taste.map((entry) => entry.titleId))
    setTasteProgress(progress)
    setMode(initialMode)
    setShowReady(progress >= TASTE_TARGET && initialMode === 'training')
    setSavedIds(new Set(readGuestSavedTitles().map((entry) => entry.title.id)))

    const storedLanguage = localStorage.getItem(LANGUAGE_PREF_KEY)
    if (storedLanguage === 'All' || storedLanguage === 'Hindi' || storedLanguage === 'Gujarati') {
      setLanguage(storedLanguage)
    }
    if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('region').eq('id', user.id).single().then(({ data }) => {
        if (data?.region) setRegion(data.region)
      })
    }).catch(() => null)
  }, [])

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 1800)
  }

  function dismissOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage)
    localStorage.setItem(LANGUAGE_PREF_KEY, nextLanguage)
  }

  function enterRecommendationMode() {
    setMode('recommendations')
    setShowReady(false)
    setReadyDismissed(true)
    localStorage.setItem(MODE_KEY, 'recommendations')
  }

  function keepTraining() {
    setShowReady(false)
    setReadyDismissed(true)
    setMode('training')
    localStorage.setItem(MODE_KEY, 'training')
  }

  function resetFilters() {
    chooseLanguage('All')
    setHasMore(true)
  }

  const fetchMore = useCallback(async () => {
    setLoading(true)
    const guestTaste = readGuestTaste()
    const encodedTaste = encodeGuestTaste(guestTaste)
    const decisionIds = readGuestRecommendationDecisions().map((entry) => entry.title.id)
    const exclude = Array.from(new Set([
      ...Array.from(seenTitleIdsRef.current),
      ...guestTaste.map((entry) => entry.titleId),
      ...(mode === 'recommendations' ? decisionIds : []),
    ])).slice(-220)

    const params = new URLSearchParams({ limit: mode === 'recommendations' ? '16' : '12' })
    if (language !== 'All') params.set('language', language)
    if (exclude.length > 0) params.set('exclude', exclude.join(','))
    if (encodedTaste.loved.length > 0) params.set('loved', encodedTaste.loved.join(','))
    if (encodedTaste.liked.length > 0) params.set('liked', encodedTaste.liked.join(','))
    if (encodedTaste.disliked.length > 0) params.set('disliked', encodedTaste.disliked.join(','))

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
  }, [language, mode])

  useEffect(() => {
    const taste = readGuestTaste()
    seenTitleIdsRef.current = new Set(taste.map((entry) => entry.titleId))
    setTasteProgress(countTasteSignals(taste))
    setHasMore(true)
    setStack([])
    fetchMore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, mode])

  useEffect(() => {
    if (stack.length < 3 && !loading && hasMore) fetchMore()
  }, [stack.length, loading, hasMore, fetchMore])

  async function handleTrainingAction(index: number, rating: GuestRating, action: string) {
    const item = stack[index]
    if (!item) return
    const titleId = item.title.id
    const previousProgress = tasteProgress
    const nextTaste = rateGuestTitle(titleId, rating)
    const nextProgress = countTasteSignals(nextTaste)

    seenTitleIdsRef.current.add(titleId)
    setStack((prev) => prev.filter((candidate) => candidate.title.id !== titleId))
    setTasteProgress(nextProgress)
    showFeedback(TRAINING_FEEDBACK[rating])

    if (nextProgress >= TASTE_TARGET && previousProgress < TASTE_TARGET && !readyDismissed) {
      setShowReady(true)
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await Promise.all([
      supabase.from('ratings').upsert({
        user_id: user.id,
        title_id: titleId,
        rating: dbRatingFor(rating),
      }, { onConflict: 'user_id,title_id' }),
      supabase.from('recommendation_log').insert({
        user_id: user.id,
        title_id: titleId,
        action,
        reason_tags: [],
      }),
    ])
  }

  function handleRecommendationDecision(index: number, decision: GuestRecommendationDecision) {
    const item = stack[index]
    if (!item) return
    decideGuestRecommendation(item.title, decision)
    seenTitleIdsRef.current.add(item.title.id)
    setStack((prev) => prev.filter((candidate) => candidate.title.id !== item.title.id))
    if (decision === 'maybe_later' || decision === 'watch_tonight') {
      setSavedIds((prev) => new Set([...Array.from(prev), item.title.id]))
    }
    showFeedback(DECISION_FEEDBACK[decision])
  }

  const progressLabel = `${Math.min(tasteProgress, TASTE_TARGET)}/${TASTE_TARGET}`

  return (
    <main className="min-h-screen">
      {showOnboarding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5 backdrop-blur-sm"
          onClick={dismissOnboarding}
        >
          <div
            className="w-full max-w-sm rounded-[18px] border p-5 text-left shadow-2xl"
            style={{ background: 'rgb(var(--card))', borderColor: 'rgba(255,153,51,0.22)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-saffron">Taste training</p>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-cream">Teach KyaDekhe your taste</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Rate movies you already know. After a few swipes, we&apos;ll recommend what to watch tonight.
            </p>
            <div className="mt-5 space-y-2 text-sm text-cream/85">
              <p><b>Not watched</b> skips from taste learning</p>
              <p><b>Didn&apos;t like</b> avoids similar picks</p>
              <p><b>Like</b> shows more like this</p>
              <p><b>Love</b> is a strong signal</p>
            </div>
            <button className="mt-5 w-full rounded-full bg-saffron px-6 py-3 text-sm font-semibold text-black" onClick={dismissOnboarding}>
              Start swiping
            </button>
          </div>
        </div>
      )}

      {showReady && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="w-full max-w-sm rounded-[18px] border p-5" style={{ background: 'rgb(var(--card))', borderColor: 'rgba(255,153,51,0.24)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-saffron">Taste learning: {progressLabel}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-cream">Your taste profile is ready.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">You&apos;ve given enough signals for KyaDekhe to suggest what to watch now.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={enterRecommendationMode} className="rounded-xl bg-saffron px-4 py-3 text-sm font-semibold text-black">
                Show my picks
              </button>
              <button type="button" onClick={keepTraining} className="rounded-xl border px-4 py-3 text-sm font-semibold text-cream" style={{ borderColor: 'rgba(255,248,231,0.22)' }}>
                Keep training
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed left-4 right-4 top-16 z-50 mx-auto max-w-sm rounded-full border px-4 py-2 text-center text-sm font-semibold text-cream shadow-2xl" style={{ background: 'rgba(14,10,11,0.92)', borderColor: 'rgba(255,153,51,0.35)' }}>
          {feedback}
        </div>
      )}

      <section className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-5xl flex-col px-4 pb-5 pt-3">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-saffron">
                {mode === 'training' ? 'Taste Training' : 'Recommendations'}
              </p>
              <h1 className="font-display text-[1.95rem] font-bold leading-none text-saffron">
                {mode === 'training' ? 'What should you watch?' : 'Your picks for tonight'}
              </h1>
              <p className="mt-1 max-w-[19rem] text-[13px] leading-snug text-muted-foreground">
                {mode === 'training'
                  ? 'Rate a few titles. We will learn your taste and suggest better picks.'
                  : 'Based on what you liked and loved.'}
              </p>
            </div>
            <div className="shrink-0 text-right text-[12px] text-muted-foreground">
              <p>Taste learning</p>
              <p className="font-semibold text-saffron">{progressLabel}</p>
              <Link href="/collections" className="text-saffron">{savedIds.size} saved</Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => chooseLanguage(lang)}
                className={`min-w-0 flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  language === lang ? 'bg-saffron text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {lang === 'All' ? 'Both' : lang}
              </button>
            ))}
          </div>

          {tasteProgress >= TASTE_TARGET && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border p-1" style={{ borderColor: 'rgba(255,153,51,0.16)' }}>
              <button type="button" onClick={keepTraining} className={`rounded-xl px-3 py-2 text-xs font-semibold ${mode === 'training' ? 'bg-saffron text-black' : 'text-muted-foreground'}`}>
                Keep training
              </button>
              <button type="button" onClick={enterRecommendationMode} className={`rounded-xl px-3 py-2 text-xs font-semibold ${mode === 'recommendations' ? 'bg-saffron text-black' : 'text-muted-foreground'}`}>
                Show my picks
              </button>
            </div>
          )}
        </header>

        {loading && stack.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
            <div className="text-4xl animate-pulse">🎬</div>
            <p className="text-sm text-muted-foreground">Finding your next picks...</p>
          </div>
        ) : stack.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-3 py-12 text-center">
            <div className="text-5xl">✨</div>
            <h2 className="font-display text-2xl font-bold text-cream">You&apos;ve rated today&apos;s batch.</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Show picks from what we learned, reset filters, or browse the full catalog.
            </p>
            <div className="grid w-full max-w-sm grid-cols-1 gap-2 sm:grid-cols-3">
              <button type="button" onClick={enterRecommendationMode} className="rounded-xl bg-saffron px-4 py-3 text-sm font-semibold text-black">
                Show my picks
              </button>
              <button type="button" onClick={resetFilters} className="rounded-xl border px-4 py-3 text-sm font-semibold text-cream" style={{ borderColor: 'rgba(255,153,51,0.24)' }}>
                Reset filters
              </button>
              <Link href="/feed" className="rounded-xl border px-4 py-3 text-sm font-semibold text-cream" style={{ borderColor: 'rgba(255,153,51,0.24)' }}>
                Browse all
              </Link>
            </div>
          </div>
        ) : mode === 'training' ? (
          <>
            <div className="mt-2 flex justify-center gap-4 text-[11px] text-muted-foreground">
              <span>← Didn&apos;t like</span>
              <span>↑ Love</span>
              <span>Like →</span>
            </div>
            <div
              className="relative mx-auto mt-2 w-full max-w-[390px]"
              style={{ height: 'clamp(390px, calc(100svh - 285px), 560px)' }}
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
                    showSaveAction={false}
                    onNotWatched={() => handleTrainingAction(i, 'not_watched', 'training_not_watched')}
                    onDislike={() => handleTrainingAction(i, 'disliked', 'training_disliked')}
                    onLike={() => handleTrainingAction(i, 'liked', 'training_liked')}
                    onLove={() => handleTrainingAction(i, 'loved', 'training_loved')}
                    onSave={() => handleRecommendationDecision(i, 'maybe_later')}
                  />
                </div>
              ))}
            </div>
            <div className="mx-auto mt-3 grid w-full max-w-[390px] grid-cols-4 gap-1.5 pb-2">
              <button type="button" onClick={() => handleTrainingAction(0, 'not_watched', 'button_not_watched')} className="rounded-xl border px-1.5 py-3 text-[12px] font-semibold text-cream" style={{ borderColor: 'rgba(255,248,231,0.2)', background: 'rgba(255,248,231,0.07)' }}>
                Not watched
              </button>
              <button type="button" onClick={() => handleTrainingAction(0, 'disliked', 'button_disliked')} className="rounded-xl border px-1.5 py-3 text-[12px] font-semibold text-red-200" style={{ borderColor: 'rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.22)' }}>
                Didn&apos;t like
              </button>
              <button type="button" onClick={() => handleTrainingAction(0, 'liked', 'button_like')} className="rounded-xl border px-1.5 py-3 text-[12px] font-semibold text-cream" style={{ borderColor: 'rgba(255,153,51,0.35)', background: 'rgba(255,153,51,0.16)' }}>
                Like
              </button>
              <button type="button" onClick={() => handleTrainingAction(0, 'loved', 'button_love')} className="rounded-xl border px-1.5 py-3 text-[12px] font-semibold text-amber-100" style={{ borderColor: 'rgba(251,191,36,0.45)', background: 'rgba(146,64,14,0.22)' }}>
                Love
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stack.map((item, index) => (
              <article key={item.title.id} className="overflow-hidden rounded-[18px] border" style={{ background: 'rgb(var(--card))', borderColor: 'rgba(255,153,51,0.12)' }}>
                <Link href={`/title/${item.title.id}`} className="flex gap-3 p-3">
                  <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                    <PosterImage title={item.title} className="object-cover" sizes="96px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl font-bold leading-tight text-cream">{item.title.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.title.year}{item.title.director.length > 0 && ` · ${item.title.director[0]}`}
                    </p>
                    {item.title.imdb_rating && (
                      <p className="mt-1 text-xs text-cream/70"><span style={{ color: '#F5C518' }}>★</span> {Number(item.title.imdb_rating).toFixed(1)} IMDb</p>
                    )}
                    {item.title.overview && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-cream/70">{item.title.overview}</p>}
                  </div>
                </Link>
                <p className="px-3 pb-2 text-xs leading-relaxed text-saffron">{reasonFromTags(item.tags, item.title.language)}</p>
                <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                  <button type="button" onClick={() => handleRecommendationDecision(index, 'not_interested')} className="rounded-xl border px-2 py-2 text-[11px] font-semibold text-muted-foreground" style={{ borderColor: 'rgba(255,248,231,0.16)' }}>
                    Not interested
                  </button>
                  <button type="button" onClick={() => handleRecommendationDecision(index, 'maybe_later')} className="rounded-xl border px-2 py-2 text-[11px] font-semibold text-cream" style={{ borderColor: 'rgba(255,153,51,0.24)' }}>
                    Maybe later
                  </button>
                  <button type="button" onClick={() => handleRecommendationDecision(index, 'watch_tonight')} className="rounded-xl bg-saffron px-2 py-2 text-[11px] font-semibold text-black">
                    Watch tonight
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
