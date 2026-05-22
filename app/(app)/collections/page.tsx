'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PosterImage } from '@/components/poster-image'
import { readGuestSavedTitles, removeGuestSavedTitle, type GuestSavedTitle } from '@/lib/guest-taste'
import type { Tables } from '@/lib/supabase/types'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<(Tables<'collections'> & { count: number })[]>([])
  const [guestSaved, setGuestSaved] = useState<GuestSavedTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [isGuest, setIsGuest] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsGuest(true)
      setGuestSaved(readGuestSavedTitles())
      setLoading(false)
      return
    }

    const { data } = await supabase.from('collections').select('*, collection_items(count)').order('created_at')
    setCollections((data ?? []).map((c) => ({
      ...c,
      count: (c.collection_items as unknown as [{ count: number }])?.[0]?.count ?? 0,
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!newName.trim()) return
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('collections').insert({
        user_id: user.id,
        name: newName.trim(),
        emoji: '🎬',
      })
      setNewName('')
    }
    setCreating(false)
    load()
  }

  function removeGuestSaved(titleId: string) {
    setGuestSaved(removeGuestSavedTitle(titleId))
  }

  return (
    <main className="min-h-screen px-4 pt-10">
      <h1 className="font-display text-2xl font-bold text-saffron mb-1">Saved</h1>
      <p className="mb-5 text-sm text-muted-foreground">Your short-list for titles worth checking next.</p>

      {isGuest ? (
        <>
          {guestSaved.length === 0 ? (
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,153,51,0.08)', border: '1px solid rgba(255,153,51,0.2)' }}>
              <p className="text-sm font-semibold text-cream">Nothing saved yet.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Tap Save while swiping to keep a local maybe-list. Create an account later only if you want syncing.
              </p>
              <Link href="/discover" className="mt-4 inline-flex rounded-full bg-saffron px-4 py-2 text-xs font-semibold text-black">
                Start discovering
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {guestSaved.map((item) => (
                <div key={item.title.id} className="flex gap-3 rounded-2xl border p-3" style={{ background: 'rgb(var(--card))', borderColor: 'rgba(255,153,51,0.1)' }}>
                  <Link href={`/title/${item.title.id}`} className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                    <PosterImage title={item.title} className="object-cover" sizes="64px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/title/${item.title.id}`} className="font-display text-base font-semibold text-cream line-clamp-1">
                      {item.title.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.title.year}{item.title.language && ` · ${item.title.language.toUpperCase()}`}
                    </p>
                    {item.title.overview && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-cream/70">{item.title.overview}</p>}
                    <button
                      type="button"
                      onClick={() => removeGuestSaved(item.title.id)}
                      className="mt-2 text-xs font-semibold text-muted-foreground"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <Link href="/auth/signup?next=/collections" className="block rounded-full border px-4 py-3 text-center text-sm font-semibold text-saffron" style={{ borderColor: 'rgba(255,153,51,0.22)' }}>
                Create account to sync this list
              </Link>
            </div>
          )}
        </>
      ) : loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {collections.map((col) => (
            <Link
              key={col.id}
              href={`/collections/${col.id}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted transition-colors"
              style={{ background: 'rgb(var(--card))', border: '1px solid rgba(255,153,51,0.1)' }}
            >
              <span className="text-2xl">{col.emoji}</span>
              <div className="flex-1">
                <p className="font-semibold text-cream text-sm">{col.name}</p>
                <p className="text-xs text-muted-foreground">{col.count} title{col.count !== 1 ? 's' : ''}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!isGuest && (
        <div className="mt-6 flex gap-2">
          <Input
            placeholder="New collection name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="bg-card border-border"
          />
          <Button onClick={create} disabled={creating || !newName.trim()} style={{ background: 'rgb(var(--saffron))', color: '#0E0A0B' }}>
            {creating ? '...' : 'Create'}
          </Button>
        </div>
      )}
    </main>
  )
}
