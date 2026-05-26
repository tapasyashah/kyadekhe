'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MOODS, type MoodId } from '@/lib/moods'
import { PosterImage } from '@/components/poster-image'
import {
  decideGuestRecommendation,
  readGuestRecommendationDecisions,
  readGuestTaste,
  encodeGuestTaste,
  type GuestRecommendationDecision,
} from '@/lib/guest-taste'
import type { Tables } from '@/lib/supabase/types'

interface RecommendedTitle {
  title: Tables<'titles'>
  tags: Record<string, unknown>
  streaming: Tables<'streaming_availability'>[]
  score: number
}

const SELECTED_MOOD_KEY = 'kyadekhe_selected_mood_v1'

const DECISION_FEEDBACK: Record<GuestRecommendationDecision, string> = {
  not_interested: 'Got it. We will move past this one.',
  maybe_later: 'Saved for later.',
  watch_tonight: 'Added to tonight.',
}

function reasonFromTags(tags: Record<string, unknown>, moodLabel?: string) {
  const parts = [
    typeof tags.emotional_weight === 'string' ? tags.emotional_weight : null,
    typeof tags.watch_with === 'string' ? tags.watch_with : null,
    typeof tags.era === 'string' ? tags.era : null,
  ].filter(Boolean)

  if (parts.length === 0) return moodLabel ? `Picked for ${moodLabel}.` : 'Picked for this mood.'
  return `Picked for ${moodLabel ?? 'this mood'}: ${parts.slice(0, 3).join(', ')}.`
}

export default function MoodPage() {
  const [selected, setSelected] = useState<MoodId | null>(null)
  const [results, setResults] = useState<RecommendedTitle[]>([])
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(SELECTED_MOOD_KEY) as MoodId | null
    if (stored && MOODS.some((mood) => mood.id === stored)) {
      selectMood(stored)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 1800)
  }

  async function selectMood(moodId: MoodId) {
    setSelected(moodId)
    localStorage.setItem(SELECTED_MOOD_KEY, moodId)
    setLoading(true)

    const taste = readGuestTaste()
    const encodedTaste = encodeGuestTaste(taste)
    const decisionIds = readGuestRecommendationDecisions().map((entry) => entry.title.id)
    const exclude = Array.from(new Set([
      ...taste.map((entry) => entry.titleId),
      ...decisionIds,
    ])).slice(-220)

    const params = new URLSearchParams({ mood: moodId, limit: '12' })
    if (exclude.length > 0) params.set('exclude', exclude.join(','))
    if (encodedTaste.loved.length > 0) params.set('loved', encodedTaste.loved.join(','))
    if (encodedTaste.liked.length > 0) params.set('liked', encodedTaste.liked.join(','))
    if (encodedTaste.disliked.length > 0) params.set('disliked', encodedTaste.disliked.join(','))

    const res = await fetch(`/api/recommendations?${params}`)
    if (res.ok) {
      const data = await res.json() as RecommendedTitle[]
      setResults(data)
    } else {
      setResults([])
    }
    setLoading(false)
  }

  function decide(index: number, decision: GuestRecommendationDecision) {
    const item = results[index]
    if (!item) return
    decideGuestRecommendation(item.title, decision)
    setResults((prev) => prev.filter((candidate) => candidate.title.id !== item.title.id))
    showFeedback(DECISION_FEEDBACK[decision])
  }

  const activeMood = MOODS.find((m) => m.id === selected)

  return (
    <main className="min-h-screen px-4 pb-8 pt-6">
      {feedback && (
        <div className="fixed left-4 right-4 top-16 z-50 mx-auto max-w-sm rounded-full border px-4 py-2 text-center text-sm font-semibold text-cream shadow-2xl" style={{ background: 'rgba(14,10,11,0.92)', borderColor: 'rgba(255,153,51,0.35)' }}>
          {feedback}
        </div>
      )}

      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-saffron">Mood shortcut</p>
        <h1 className="font-display text-[2rem] font-bold leading-none text-saffron">What&apos;s the mood?</h1>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          Mood is a shortcut when you already know the vibe.
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {MOODS.map((mood) => {
          const isSelected = selected === mood.id
          return (
            <button
              key={mood.id}
              onClick={() => selectMood(mood.id)}
              className="flex min-h-28 flex-col items-start rounded-[18px] border p-3 text-left transition-all"
              style={{
                background: isSelected ? 'rgba(255,153,51,0.12)' : 'rgb(var(--card))',
                borderColor: isSelected ? 'rgb(var(--saffron))' : 'rgba(255,153,51,0.1)',
                boxShadow: isSelected ? '0 0 0 1px rgba(255,153,51,0.35)' : 'none',
              }}
            >
              <span className="text-3xl">{mood.emoji}</span>
              <span className="mt-3 text-sm font-semibold leading-tight text-cream">{mood.label}</span>
              <span className="mt-1 text-xs leading-snug text-muted-foreground">{mood.description}</span>
            </button>
          )
        })}
      </div>

      {selected && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-saffron">
                Showing: {activeMood?.label}
              </p>
              <h2 className="font-display text-xl font-semibold text-cream">
                {activeMood?.emoji} Picks for this mood
              </h2>
            </div>
            <Link href="/discover" className="rounded-full border px-3 py-1.5 text-xs font-semibold text-muted-foreground" style={{ borderColor: 'rgba(255,153,51,0.2)' }}>
              Train taste
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-[18px] bg-card animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-[18px] border p-5 text-center" style={{ background: 'rgb(var(--card))', borderColor: 'rgba(255,153,51,0.12)' }}>
              <p className="font-display text-xl font-semibold text-cream">No matches left for this mood.</p>
              <p className="mt-2 text-sm text-muted-foreground">Try another mood or train your taste for sharper picks.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((item, index) => (
                <article key={item.title.id} className="overflow-hidden rounded-[18px] border" style={{ background: 'rgb(var(--card))', borderColor: 'rgba(255,153,51,0.12)' }}>
                  <Link href={`/title/${item.title.id}`} className="flex gap-3 p-3">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                      <PosterImage title={item.title} className="object-cover" sizes="80px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-semibold leading-tight text-cream line-clamp-2">
                        {item.title.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.title.year}
                        {item.title.director.length > 0 && ` · ${item.title.director[0]}`}
                      </p>
                      {item.title.imdb_rating && (
                        <p className="mt-1 text-xs" style={{ color: '#F5C518' }}>
                          ★ {Number(item.title.imdb_rating).toFixed(1)}
                        </p>
                      )}
                      {item.title.overview && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-cream/70">{item.title.overview}</p>}
                    </div>
                  </Link>
                  <p className="px-3 pb-2 text-xs leading-relaxed text-saffron">{reasonFromTags(item.tags, activeMood?.label)}</p>
                  <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                    <button type="button" onClick={() => decide(index, 'not_interested')} className="rounded-xl border px-2 py-2 text-[11px] font-semibold text-muted-foreground" style={{ borderColor: 'rgba(255,248,231,0.16)' }}>
                      Not interested
                    </button>
                    <button type="button" onClick={() => decide(index, 'maybe_later')} className="rounded-xl border px-2 py-2 text-[11px] font-semibold text-cream" style={{ borderColor: 'rgba(255,153,51,0.24)' }}>
                      Maybe later
                    </button>
                    <button type="button" onClick={() => decide(index, 'watch_tonight')} className="rounded-xl bg-saffron px-2 py-2 text-[11px] font-semibold text-black">
                      Watch tonight
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
