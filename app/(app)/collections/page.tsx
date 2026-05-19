'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Tables } from '@/lib/supabase/types'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<(Tables<'collections'> & { count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    const supabase = createClient()
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
    await supabase.from('collections').insert({ name: newName.trim(), emoji: '🎬' })
    setNewName('')
    setCreating(false)
    load()
  }

  return (
    <main className="min-h-screen px-4 pt-10">
      <h1 className="font-display text-2xl font-bold text-saffron mb-5">Collections</h1>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {collections.map((col) => (
            <Link
              key={col.id}
              href={`/collections/${col.id}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted transition-colors"
              style={{ background: 'var(--card)', border: '1px solid rgba(255,153,51,0.1)' }}
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

      <div className="mt-6 flex gap-2">
        <Input
          placeholder="New collection name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          className="bg-card border-border"
        />
        <Button onClick={create} disabled={creating || !newName.trim()} style={{ background: 'var(--saffron)', color: '#0E0A0B' }}>
          {creating ? '...' : 'Create'}
        </Button>
      </div>
    </main>
  )
}
