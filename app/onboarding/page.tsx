'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

type RatingValue = 'loved' | 'liked' | 'meh' | 'disliked' | 'havent_seen'

const RATING_OPTIONS: { value: RatingValue; emoji: string; label: string }[] = [
  { value: 'loved', emoji: '❤️', label: 'Loved' },
  { value: 'liked', emoji: '👍', label: 'Liked' },
  { value: 'meh', emoji: '😐', label: 'Meh' },
  { value: 'disliked', emoji: '👎', label: 'Disliked' },
  { value: 'havent_seen', emoji: '🤷', label: 'Haven\'t Seen' },
]

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'

export default function OnboardingPage() {
  const router = useRouter()
  const [titles, setTitles] = useState<Tables<'titles'>[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('titles')
      .select('*')
      .limit(20)
      .then(({ data }) => {
        setTitles(data ?? [])
        setLoading(false)
      })
  }, [])

  async function rate(value: RatingValue) {
    if (rating) return
    setRating(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const current = titles[currentIndex]
    if (!current) return

    await supabase.from('ratings').upsert({
      user_id: user.id,
      title_id: current.id,
      rating: value,
    }, { onConflict: 'user_id,title_id' })

    if (currentIndex >= titles.length - 1) {
      // Done — compute taste vector + mark onboarded
      await fetch('/api/recommendations', { method: 'GET' }) // triggers vector computation on first use

      await supabase.from('users').update({ onboarded: true }).eq('id', user.id)
      router.push('/discover')
    } else {
      setCurrentIndex((i) => i + 1)
      setRating(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading your first picks...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </main>
    )
  }

  const current = titles[currentIndex]
  if (!current) return null

  const progress = ((currentIndex) / titles.length) * 100

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-2xl font-bold text-saffron">KyaDekhe</h1>
          <span className="text-sm text-muted-foreground">{currentIndex + 1} / {titles.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'rgb(var(--saffron))' }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Tell us how you feel about these films to personalise your picks</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'rgb(var(--card))', border: '1px solid rgba(255,153,51,0.15)' }}>
        {/* Poster */}
        <div className="relative aspect-[2/3]">
          {current.poster_path ? (
            <Image
              src={`${TMDB_IMAGE_BASE}${current.poster_path}`}
              alt={current.title}
              fill
              className="object-cover"
              sizes="400px"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted text-8xl">🎬</div>
          )}
          <div className="absolute inset-0 poster-gradient" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="font-display text-2xl font-bold text-cream">{current.title}</h2>
            <p className="text-sm text-cream/70 mt-1">
              {current.year}
              {current.director.length > 0 && ` · ${current.director[0]}`}
            </p>
            {current.imdb_rating && (
              <p className="text-xs text-cream/60 mt-0.5">
                <span style={{ color: '#F5C518' }}>★</span> {Number(current.imdb_rating).toFixed(1)} IMDb
              </p>
            )}
          </div>
        </div>

        {/* Rating buttons */}
        <div className="p-4">
          <div className="grid grid-cols-5 gap-2">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => rate(opt.value)}
                disabled={rating}
                className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-colors hover:bg-muted disabled:opacity-50"
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="text-[10px] text-muted-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
