'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Tables } from '@/lib/supabase/types'

interface AskResult {
  results: Array<{ title: Tables<'titles'>; tags: Record<string, unknown>; streaming: Tables<'streaming_availability'>[]; score: number }>
  explanation: string
  parsedFilters: Record<string, unknown>
}

const EXAMPLES = [
  'Something like Dil Chahta Hai but in a small town',
  'Best 90s thrillers I probably haven\'t seen',
  'A short series I can finish in one evening',
  'Something devastating but worth it',
]

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'

export default function AskPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    if (!res.ok) {
      setError('Something went wrong. Try again.')
    } else {
      setResult(await res.json() as AskResult)
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen px-4 pt-10">
      <h1 className="font-display text-2xl font-bold text-saffron mb-1">Ask KyaDekhe</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Ask in plain language. We&apos;ll find it.
      </p>

      {/* Input */}
      <div className="space-y-3">
        <Textarea
          placeholder="Something like Zindagi Na Milegi Dobara but shorter and less road-trip-y..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), ask())}
          className="bg-card border-border min-h-[80px] text-base resize-none"
        />
        <Button
          onClick={ask}
          disabled={loading || !query.trim()}
          className="w-full font-semibold"
          style={{ background: 'var(--saffron)', color: '#0E0A0B' }}
        >
          {loading ? 'Asking...' : 'Find it'}
        </Button>
      </div>

      {/* Examples */}
      {!result && !loading && (
        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuery(ex)}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-muted"
                style={{ borderColor: 'rgba(255,153,51,0.2)', color: 'var(--muted-foreground)' }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* Results */}
      {result && (
        <div className="mt-8">
          <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,153,51,0.05)', border: '1px solid rgba(255,153,51,0.15)' }}>
            <p className="text-sm text-cream">{result.explanation}</p>
          </div>

          {result.results.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No matches found. Try rephrasing or a different query.
            </p>
          ) : (
            <div className="space-y-3">
              {result.results.map((item) => (
                <Link
                  key={item.title.id}
                  href={`/title/${item.title.id}`}
                  className="flex gap-4 p-3 rounded-xl hover:bg-muted transition-colors"
                  style={{ background: 'var(--card)', border: '1px solid rgba(255,153,51,0.08)' }}
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
                      <div className="absolute inset-0 flex items-center justify-center text-xl">🎬</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-cream text-sm line-clamp-1">{item.title.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.title.year}{item.title.director.length > 0 && ` · ${item.title.director[0]}`}
                    </p>
                    {item.title.imdb_rating && (
                      <p className="text-xs mt-0.5" style={{ color: '#F5C518' }}>★ {Number(item.title.imdb_rating).toFixed(1)}</p>
                    )}
                    {!!item.tags?.['emotional_weight'] && (
                      <span className="inline-block text-xs mt-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,153,51,0.1)', color: 'var(--saffron)' }}>
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
