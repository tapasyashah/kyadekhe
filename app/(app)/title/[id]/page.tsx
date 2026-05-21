'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StreamingPills } from '@/components/streaming-pills'
import { CollectionPicker } from '@/components/collection-picker'
import type { Tables } from '@/lib/supabase/types'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780'

export default function TitlePage() {
  const { id } = useParams<{ id: string }>()
  const [title, setTitle] = useState<Tables<'titles'> | null>(null)
  const [tags, setTags] = useState<Record<string, unknown> | null>(null)
  const [streaming, setStreaming] = useState<Tables<'streaming_availability'>[]>([])
  const [why, setWhy] = useState<string | null>(null)
  const [similar, setSimilar] = useState<Tables<'titles'>[]>([])
  const [region, setRegion] = useState('IN')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [authPrompt, setAuthPrompt] = useState<'rating' | 'collection' | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsGuest(!user)

      const [{ data: t }, { data: regionRow }] = await Promise.all([
        supabase.from('titles').select('*').eq('id', id).single(),
        user
          ? supabase.from('users').select('region').eq('id', user.id).single()
          : Promise.resolve({ data: null }),
      ])

      if (!t) { setLoading(false); return }
      setTitle(t)
      setRegion(regionRow?.region ?? 'IN')

      const [{ data: tagRow }, { data: streamRows }, ratingResult] = await Promise.all([
        supabase.from('title_tags').select('tags').eq('title_id', id).single(),
        supabase.from('streaming_availability').select('*').eq('title_id', id),
        user
          ? supabase.from('ratings').select('rating').eq('user_id', user.id).eq('title_id', id).single()
          : Promise.resolve({ data: null }),
      ])

      setTags(tagRow?.tags as Record<string, unknown> ?? null)
      setStreaming(streamRows ?? [])
      setRating(ratingResult.data?.rating ?? null)
      setLoading(false)

      // Load "why" async
      if (user) {
        fetch('/api/why', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titleId: id }),
        }).then((r) => r.json()).then((d: { explanation: string }) => setWhy(d.explanation)).catch(() => null)
      }
    }
    load()
  }, [id])

  async function rateTitle(r: 'loved' | 'liked' | 'meh' | 'disliked' | 'havent_seen' | 'skip') {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAuthPrompt('rating')
      return
    }
    if (!title) return
    await supabase.from('ratings').upsert({ user_id: user.id, title_id: title.id, rating: r }, { onConflict: 'user_id,title_id' })
    setRating(r)
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></main>
  if (!title) return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Not found.</p></main>

  return (
    <main className="min-h-screen">
      {/* Backdrop */}
      <div className="relative h-64 sm:h-80">
        {title.backdrop_path ? (
          <Image src={`${TMDB_IMAGE_BASE}${title.backdrop_path}`} alt="" fill className="object-cover opacity-40" sizes="100vw" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-burgundy/30 to-transparent" />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgb(var(--background)))' }} />
      </div>

      <div className="px-5 -mt-24 relative z-10 pb-8">
        {/* Title info */}
        <h1 className="font-display text-3xl font-bold text-cream leading-tight">{title.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {title.year} · {title.title_type}
          {title.director.length > 0 && ` · Dir. ${title.director.join(', ')}`}
        </p>

        {/* Ratings row */}
        <div className="flex gap-4 mt-3 items-center">
          {title.imdb_rating && <span className="text-sm font-semibold" style={{ color: '#F5C518' }}>★ {Number(title.imdb_rating).toFixed(1)} IMDb</span>}
          {title.tmdb_rating && <span className="text-sm text-muted-foreground">TMDb {Number(title.tmdb_rating).toFixed(1)}</span>}
        </div>

        {/* Streaming */}
        <div className="mt-3">
          <StreamingPills streaming={streaming} region={region} />
        </div>

        {/* Tags */}
        {tags && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {(['era', 'emotional_weight', 'watch_with', 'setting', 'writing_quality'] as const).map((field) => {
              const val = tags[field]
              if (typeof val !== 'string') return null
              return (
                <span key={field} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,153,51,0.1)', color: 'rgb(var(--saffron))', border: '1px solid rgba(255,153,51,0.2)' }}>
                  {val}
                </span>
              )
            })}
          </div>
        )}

        {/* Why */}
        {why && (
          <div className="mt-5 rounded-xl p-4" style={{ background: 'rgba(255,153,51,0.05)', border: '1px solid rgba(255,153,51,0.15)' }}>
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Why you&apos;ll like this</p>
            <div className="text-sm text-cream whitespace-pre-line leading-relaxed">{why}</div>
          </div>
        )}

        {/* Overview */}
        {title.overview && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Plot</p>
            <p className="text-sm text-cream/80 leading-relaxed">{title.overview}</p>
          </div>
        )}

        {/* Cast */}
        {title.top_cast.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Cast</p>
            <p className="text-sm text-cream/80">{title.top_cast.join(' · ')}</p>
          </div>
        )}

        {/* Rate it */}
        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Your rating</p>
          <div className="flex gap-2">
            {[['loved','❤️'],['liked','👍'],['meh','😐'],['disliked','👎'],['havent_seen','🤷']].map(([r, emoji]) => (
              <button
                key={r}
                onClick={() => rateTitle(r as 'loved' | 'liked' | 'meh' | 'disliked' | 'havent_seen' | 'skip')}
                className="flex-1 py-2 rounded-xl text-xl transition-all border"
                style={{
                  background: rating === r ? 'rgba(255,153,51,0.15)' : 'rgb(var(--card))',
                  borderColor: rating === r ? 'rgb(var(--saffron))' : 'rgba(255,153,51,0.1)',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Add to collection */}
        <button
          onClick={() => isGuest ? setAuthPrompt('collection') : setPickerOpen(true)}
          className="mt-4 w-full py-3 rounded-xl text-sm font-semibold border transition-colors hover:bg-muted"
          style={{ borderColor: 'rgba(255,153,51,0.2)', color: 'rgb(var(--saffron))' }}
        >
          + Add to Collection
        </button>
      </div>

      {authPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: 'rgb(var(--card))', border: '1px solid rgba(255,153,51,0.2)' }}
          >
            <h2 className="font-display text-2xl font-bold text-cream">
              {authPrompt === 'rating' ? 'Rate this title?' : 'Save this title?'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Create a free account to save ratings, build collections, and get better recommendations.
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
                href={`/auth/signup?next=/title/${id}`}
                className="flex-1 rounded-xl bg-saffron px-4 py-3 text-center text-sm font-semibold text-black"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      )}

      <CollectionPicker titleId={id} open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </main>
  )
}
