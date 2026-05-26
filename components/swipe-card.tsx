'use client'

import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import Link from 'next/link'
import type { Tables } from '@/lib/supabase/types'
import { StreamingPills } from '@/components/streaming-pills'
import { PosterImage } from '@/components/poster-image'

interface SwipeCardProps {
  title: Tables<'titles'>
  tags?: Record<string, unknown>
  streaming?: Tables<'streaming_availability'>[]
  region?: string
  isTop: boolean
  isSaved?: boolean
  showSaveAction?: boolean
  onLike: () => void
  onLove: () => void
  onDislike: () => void
  onNotWatched: () => void
  onSave: () => void
}

const SWIPE_THRESHOLD = 100

const EMOTIONAL_WEIGHT_COLORS: Record<string, string> = {
  'featherlight': '#22c55e',
  'breezy': '#86efac',
  'emotionally engaging': '#facc15',
  'heavy': '#f97316',
  'devastating': '#ef4444',
}

export function SwipeCard({
  title, tags, streaming = [], region = 'IN',
  isTop, isSaved = false, showSaveAction = true, onLike, onLove, onDislike, onNotWatched, onSave,
}: SwipeCardProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-20, 0, 20])

  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  const dislikeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])
  const loveOpacity = useTransform(y, [-SWIPE_THRESHOLD, 0], [1, 0])
  const notWatchedOpacity = useTransform(y, [0, SWIPE_THRESHOLD], [0, 1])

  const emotionalWeight = tags?.['emotional_weight'] as string | undefined
  const era = tags?.['era'] as string | undefined
  const watchWith = tags?.['watch_with'] as string | undefined
  const whyHint = tags?.['writing_quality'] as string | undefined

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info
    const swipeX = Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 500
    const swipeUp = offset.y < -SWIPE_THRESHOLD || velocity.y < -500
    const swipeDown = offset.y > SWIPE_THRESHOLD || velocity.y > 500

    if (swipeUp) { onLove(); return }
    if (swipeDown) { onNotWatched(); return }
    if (swipeX && offset.x > 0) { onLike(); return }
    if (swipeX && offset.x < 0) { onDislike(); return }
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate, touchAction: 'none' }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 1.02 }}
    >
      {/* Card */}
      <div className="relative h-full overflow-hidden rounded-[18px] select-none"
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>

        {/* Poster */}
        <PosterImage
          title={title}
          className="object-cover pointer-events-none"
          sizes="(max-width: 480px) 100vw, 400px"
          priority={isTop}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 poster-gradient" />

        {/* Swipe indicators */}
        <motion.div
          className="absolute top-8 left-6 font-display text-3xl font-bold text-green-400 border-4 border-green-400 px-3 py-1 rounded-lg rotate-[-15deg]"
          style={{ opacity: likeOpacity }}
        >
          LIKE
        </motion.div>
        <motion.div
          className="absolute top-8 right-6 font-display text-3xl font-bold text-red-400 border-4 border-red-400 px-3 py-1 rounded-lg rotate-[15deg]"
          style={{ opacity: dislikeOpacity }}
        >
          NOPE
        </motion.div>
        <motion.div
          className="absolute top-8 left-1/2 -translate-x-1/2 font-display text-3xl font-bold text-amber-300 border-4 border-amber-300 px-3 py-1 rounded-lg"
          style={{ opacity: loveOpacity }}
        >
          LOVE
        </motion.div>
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 font-display text-2xl font-bold text-cream border-4 border-cream/70 px-3 py-1 rounded-lg"
          style={{ opacity: notWatchedOpacity }}
        >
          NOT WATCHED
        </motion.div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 space-y-2 p-4 sm:p-5">
          {/* Streaming */}
          <StreamingPills streaming={streaming} region={region} />

          {/* Title */}
          <h2 className="font-display text-[1.65rem] font-bold text-cream leading-tight">
            {title.title}
          </h2>

          {/* Meta */}
          <p className="text-sm text-cream/70">
            {title.year}
            {title.director.length > 0 && ` · ${title.director[0]}`}
            {title.top_cast.length > 0 && ` · ${title.top_cast.slice(0, 2).join(', ')}`}
          </p>

          {/* Tags row */}
          <div className="flex flex-wrap gap-1.5">
            {emotionalWeight && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${EMOTIONAL_WEIGHT_COLORS[emotionalWeight] ?? '#6b7280'}25`, color: EMOTIONAL_WEIGHT_COLORS[emotionalWeight] ?? '#9ca3af', border: `1px solid ${EMOTIONAL_WEIGHT_COLORS[emotionalWeight] ?? '#6b7280'}55` }}
              >
                {emotionalWeight}
              </span>
            )}
            {era && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(212,175,55,0.15)', color: 'rgb(var(--gold))', border: '1px solid rgba(212,175,55,0.3)' }}>
                {era}
              </span>
            )}
            {watchWith && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,153,51,0.1)', color: 'rgb(var(--saffron))', border: '1px solid rgba(255,153,51,0.2)' }}>
                {watchWith}
              </span>
            )}
          </div>

          {/* IMDb */}
          {title.imdb_rating && (
            <p className="text-xs text-cream/60">
              <span style={{ color: '#F5C518' }}>★</span> {Number(title.imdb_rating).toFixed(1)} IMDb
              {whyHint && <span className="ml-2 opacity-70">· Writing: {whyHint}</span>}
            </p>
          )}
          {title.overview && (
            <p className="line-clamp-2 text-xs leading-relaxed text-cream/70">
              {title.overview}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={`/title/${title.id}`}
              onClick={(event) => event.stopPropagation()}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold text-cream/90"
              style={{ borderColor: 'rgba(255,153,51,0.35)', background: 'rgba(14,10,11,0.45)' }}
            >
              More details
            </Link>
            {showSaveAction && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onSave()
                }}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold text-cream/85"
                style={{
                  borderColor: isSaved ? 'rgba(34,197,94,0.55)' : 'rgba(255,248,231,0.25)',
                  background: isSaved ? 'rgba(22,101,52,0.28)' : 'rgba(14,10,11,0.45)',
                }}
              >
                {isSaved ? 'Saved' : 'Save for later'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
