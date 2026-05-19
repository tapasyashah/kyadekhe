'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'

interface CollectionItem {
  id: string
  title: Tables<'titles'>
}

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [collection, setCollection] = useState<Tables<'collections'> | null>(null)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: col }, { data: its }] = await Promise.all([
        supabase.from('collections').select('*').eq('id', id).single(),
        supabase.from('collection_items').select('id, titles(*)').eq('collection_id', id).order('added_at', { ascending: false }),
      ])
      setCollection(col)
      setItems((its ?? []).map((i) => ({ id: i.id, title: i.titles as unknown as Tables<'titles'> })).filter((i) => i.title))
      setLoading(false)
    }
    load()
  }, [id])

  async function removeItem(itemId: string) {
    const supabase = createClient()
    await supabase.from('collection_items').delete().eq('id', itemId)
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></main>
  if (!collection) return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Not found.</p></main>

  return (
    <main className="min-h-screen px-4 pt-10">
      <Link href="/collections" className="text-xs text-muted-foreground mb-4 block">← Collections</Link>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">{collection.emoji}</span>
        <div>
          <h1 className="font-display text-2xl font-bold text-cream">{collection.name}</h1>
          <p className="text-sm text-muted-foreground">{items.length} title{items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-muted-foreground text-sm">Nothing saved here yet.<br />Swipe up on a card or tap + Add to Collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <Link href={`/title/${item.title.id}`}>
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)' }}>
                  <div className="relative aspect-[2/3] bg-muted">
                    {item.title.poster_path ? (
                      <Image src={`${TMDB_IMAGE_BASE}${item.title.poster_path}`} alt={item.title.title} fill className="object-cover" sizes="180px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">🎬</div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-cream line-clamp-1">{item.title.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.title.year}</p>
                  </div>
                </div>
              </Link>
              <button
                onClick={() => removeItem(item.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
