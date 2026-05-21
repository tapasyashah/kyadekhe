'use client'

import { useState, useEffect, useCallback } from 'react'
import { TitleCard } from '@/components/title-card'
import type { Tables } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

interface RecommendedTitle {
  title: Tables<'titles'>
  tags: Record<string, unknown>
  streaming: Tables<'streaming_availability'>[]
  score: number
}

const ERA_OPTIONS = ['all', '40s-60s classic', '70s-80s masala', '90s blockbuster', '2000s cool', '2010s new wave', '2020s present']
const FORMAT_OPTIONS = ['all', 'theatrical', 'web series', 'direct-to-OTT']
const WEIGHT_OPTIONS = ['all', 'featherlight', 'breezy', 'emotionally engaging', 'heavy', 'devastating']

export default function FeedPage() {
  const [results, setResults] = useState<RecommendedTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [era, setEra] = useState('all')
  const [region, setRegion] = useState('IN')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('users').select('region').single().then(({ data }) => {
      if (data?.region) setRegion(data.region)
    })
  }, [])

  const fetchRecs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '40' })
    if (era !== 'all') params.set('era', era)
    const res = await fetch(`/api/recommendations?${params}`)
    if (res.ok) {
      const data = await res.json() as RecommendedTitle[]
      setResults(data)
    }
    setLoading(false)
  }, [era])

  useEffect(() => { fetchRecs() }, [fetchRecs])

  return (
    <main className="min-h-screen px-4 pt-10">
      <h1 className="font-display text-2xl font-bold text-saffron mb-1">Your Picks</h1>
      <p className="text-sm text-muted-foreground mb-5">Personalised recommendations based on your taste</p>

      {/* Filter bar */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-none">
        {ERA_OPTIONS.map((e) => (
          <button
            key={e}
            onClick={() => setEra(e)}
            className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-colors flex-shrink-0"
            style={{
              background: era === e ? 'rgb(var(--saffron))' : 'transparent',
              color: era === e ? '#0E0A0B' : 'rgb(var(--muted-foreground))',
              borderColor: era === e ? 'rgb(var(--saffron))' : 'rgba(255,153,51,0.2)',
            }}
          >
            {e === 'all' ? 'All eras' : e}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-card aspect-[2/3] animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-muted-foreground">No picks match your filters. Try a different era.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((item) => (
            <TitleCard
              key={item.title.id}
              title={item.title}
              tags={item.tags}
              streaming={item.streaming}
              region={region}
            />
          ))}
        </div>
      )}
    </main>
  )
}
