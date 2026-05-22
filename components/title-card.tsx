import Link from 'next/link'
import type { Tables } from '@/lib/supabase/types'
import { StreamingPills } from '@/components/streaming-pills'
import { PosterImage } from '@/components/poster-image'

interface TitleCardProps {
  title: Tables<'titles'>
  tags?: Record<string, unknown>
  streaming?: Tables<'streaming_availability'>[]
  region?: string
}

const TAG_COLORS: Record<string, string> = {
  'featherlight': '#22c55e',
  'breezy': '#86efac',
  'emotionally engaging': '#facc15',
  'heavy': '#f97316',
  'devastating': '#ef4444',
}

export function TitleCard({ title, tags, streaming = [], region = 'IN' }: TitleCardProps) {
  const emotionalWeight = tags?.['emotional_weight'] as string | undefined
  const era = tags?.['era'] as string | undefined
  const watchWith = tags?.['watch_with'] as string | undefined

  return (
    <Link href={`/title/${title.id}`}>
      <div
        className="rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] group"
        style={{ background: 'rgb(var(--card))', border: '1px solid rgba(255,153,51,0.1)' }}
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] bg-muted">
          <PosterImage title={title} className="object-cover" sizes="(max-width: 640px) 50vw, 180px" />

          {/* IMDb badge */}
          {title.imdb_rating && (
            <div
              className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: '#F5C518', color: '#000' }}
            >
              ★ {Number(title.imdb_rating).toFixed(1)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 space-y-1.5">
          <h3 className="font-display font-semibold text-sm text-cream leading-tight line-clamp-1">
            {title.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {title.year}{title.director.length > 0 && ` · ${title.director[0]}`}
          </p>

          {/* Tags */}
          {(emotionalWeight || era || watchWith) && (
            <div className="flex flex-wrap gap-1">
              {emotionalWeight && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${TAG_COLORS[emotionalWeight] ?? '#6b7280'}22`, color: TAG_COLORS[emotionalWeight] ?? '#9ca3af', border: `1px solid ${TAG_COLORS[emotionalWeight] ?? '#6b7280'}44` }}
                >
                  {emotionalWeight}
                </span>
              )}
              {era && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(212,175,55,0.1)', color: 'rgb(var(--gold))', border: '1px solid rgba(212,175,55,0.2)' }}>
                  {era}
                </span>
              )}
            </div>
          )}

          <StreamingPills streaming={streaming} region={region} />
        </div>
      </div>
    </Link>
  )
}
