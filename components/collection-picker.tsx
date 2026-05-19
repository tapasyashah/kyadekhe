'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

interface CollectionPickerProps {
  titleId: string
  open: boolean
  onClose: () => void
}

export function CollectionPicker({ titleId, open, onClose }: CollectionPickerProps) {
  const [collections, setCollections] = useState<Tables<'collections'>[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.from('collections').select('*').order('created_at')
      .then(({ data }) => {
        setCollections(data ?? [])
        setLoading(false)
      })
  }, [open])

  async function addToCollection(collectionId: string) {
    setAdding(collectionId)
    const supabase = createClient()
    const { error } = await supabase.from('collection_items').upsert({
      collection_id: collectionId,
      title_id: titleId,
    }, { onConflict: 'collection_id,title_id', ignoreDuplicates: true })

    if (error) {
      setFeedback('Failed to add. Try again.')
    } else {
      setFeedback('Added!')
      setTimeout(() => { setFeedback(null); onClose() }, 800)
    }
    setAdding(null)
  }

  async function createCollection() {
    if (!newName.trim()) return
    setCreating(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('collections').insert({
      name: newName.trim(),
      emoji: '🎬',
    }).select().single()

    if (!error && data) {
      setCollections((prev) => [...prev, data])
      setNewName('')
      await addToCollection(data.id)
    }
    setCreating(false)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl" style={{ background: 'var(--card)', borderColor: 'rgba(255,153,51,0.15)' }}>
        <SheetHeader>
          <SheetTitle className="text-cream font-display">Add to collection</SheetTitle>
        </SheetHeader>

        {feedback && (
          <p className="text-center text-sm text-saffron py-2">{feedback}</p>
        )}

        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-4">Loading...</p>
          ) : (
            collections.map((col) => (
              <button
                key={col.id}
                onClick={() => addToCollection(col.id)}
                disabled={adding === col.id}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors hover:bg-muted"
              >
                <span className="text-xl">{col.emoji}</span>
                <span className="text-cream text-sm font-medium">{col.name}</span>
                {adding === col.id && <span className="ml-auto text-xs text-muted-foreground">Adding...</span>}
              </button>
            ))
          )}
        </div>

        {/* Create new */}
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="New collection name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createCollection()}
            className="bg-muted border-border"
          />
          <Button
            onClick={createCollection}
            disabled={creating || !newName.trim()}
            style={{ background: 'var(--saffron)', color: '#0E0A0B' }}
          >
            {creating ? '...' : 'Create'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
