'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MOODS, type MoodId } from '@/lib/moods'
import type { Tables } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

interface RecommendedTitle {
  title: Tables<'titles'>
  tags: Record<string, unknown>
  streaming: Tables<'streaming_availability'>[]
  score: number
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'

export default function MoodPage() {
  const [selected, setSelected] = useState<MoodId | null>(null)
  const [results, setResults] = useState<RecommendedTitle[]>([])
  const [loading, setLoading] = useState(false)
  const [region, setRegion] = useState('IN')

  async function selectMood(moodId: MoodId) {
    setSelected(moodId)
    setLoading(true)

    const supabase = createClient()
    const { data: userData } = await supabase.from('users').select('region').single()
    const r = userData?.region ?? 'IN'
    setRegion(r)

    const res = await fetch(`/api/recommendations?mood=${moodId}&limit=12`)
    if (res.ok) {
      const data = await res.json() as RecommendedTitle[]
      setResults(data)
    }
    setLoading(false)
  }

  const activeMood = MOODS.find((m) => m.id === selected)

  return (
    <main className="min-h-screen px-4 pt-10">
      <h1 className="font-display text-2xl font-bold text-saffron mb-1">What&apos;s the mood?</h1>
      <p className="text-sm text-muted-foreground mb-6">Pick a vibe, we&apos;ll match the film</p>

      {/* Mood grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            onClick={() => selectMood(mood.id)}
            className="flex flex-col items-start p-4 rounded-xl border transition-all text-left"
            style={{
              background: selected === mood.id ? 'rgba(255,153,51,0.1)' : 'rgb(var(--card))',
              borderColor: selected === mood.id ? 'rgb(var(--saffron))' : 'rgba(255,153,51,0.1)',
            }}
          >
            <span className="text-3xl mb-2">{mood.emoji}</span>
            <span className="text-sm font-semibold text-cream">{mood.label}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{mood.description}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      {selected && (
        <div>
          <h2 className="font-display text-lg font-semibold text-cream mb-4">
            {activeMood?.emoji} {activeMood?.label} picks for you
          </h2>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground text-sm">No matches for this mood yet. Rate more films to improve your picks.</p>
          ) : (
            <div className="space-y-3">
              {results.map((item) => (
                <Link
                  key={item.title.id}
                  href={`/title/${item.title.id}`}
                  className="flex gap-4 p-3 rounded-xl hover:bg-muted transition-colors"
                  style={{ background: 'rgb(var(--card))', border: '1px solid rgba(255,153,51,0.08)' }}
                >
                  <div className="relative w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                    {item.title.poster_path ? (
                      <Image
                        src={`${TMDB_IMAGE_BASE}${item.title.poster_path}`}
                        alt={item.title.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-2xl">🎬</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-cream text-sm leading-tight line-clamp-1">
                      {item.title.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.title.year}
                      {item.title.director.length > 0 && ` · ${item.title.director[0]}`}
                    </p>
                    {item.title.imdb_rating && (
                      <p className="text-xs mt-1" style={{ color: '#F5C518' }}>
                        ★ {Number(item.title.imdb_rating).toFixed(1)}
                      </p>
                    )}
                    {!!item.tags?.['emotional_weight'] && (
                      <span className="inline-block text-xs mt-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,153,51,0.1)', color: 'rgb(var(--saffron))' }}>
                        {String(item.tags['emotional_weight'])}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
