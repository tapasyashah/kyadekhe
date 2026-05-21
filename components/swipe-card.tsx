'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import Image from 'next/image'
import type { Tables } from '@/lib/supabase/types'
import { StreamingPills } from '@/components/streaming-pills'

interface SwipeCardProps {
  title: Tables<'titles'>
  tags?: Record<string, unknown>
  streaming?: Tables<'streaming_availability'>[]
  region?: string
  isTop: boolean
  onSwipeRight: () => void
  onSwipeLeft: () => void
  onSwipeUp: () => void
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'
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
  isTop, onSwipeRight, onSwipeLeft, onSwipeUp,
}: SwipeCardProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-20, 0, 20])

  const loveOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  const skipOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])
  const saveOpacity = useTransform(y, [-SWIPE_THRESHOLD, 0], [1, 0])

  const emotionalWeight = tags?.['emotional_weight'] as string | undefined
  const era = tags?.['era'] as string | undefined
  const watchWith = tags?.['watch_with'] as string | undefined
  const whyHint = tags?.['writing_quality'] as string | undefined

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info
    const swipeX = Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 500
    const swipeUp = offset.y < -SWIPE_THRESHOLD || velocity.y < -500

    if (swipeUp) { onSwipeUp(); return }
    if (swipeX && offset.x > 0) { onSwipeRight(); return }
    if (swipeX && offset.x < 0) { onSwipeLeft(); return }
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
      <div className="relative h-full rounded-2xl overflow-hidden select-none"
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>

        {/* Poster */}
        {title.poster_path ? (
          <Image
            src={`${TMDB_IMAGE_BASE}${title.poster_path}`}
            alt={title.title}
            fill
            className="object-cover pointer-events-none"
            sizes="(max-width: 480px) 100vw, 400px"
            priority={isTop}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-card text-8xl">🎬</div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 poster-gradient" />

        {/* Swipe indicators */}
        <motion.div
          className="absolute top-8 left-6 font-display text-3xl font-bold text-green-400 border-4 border-green-400 px-3 py-1 rounded-lg rotate-[-15deg]"
          style={{ opacity: loveOpacity }}
        >
          LOVED
        </motion.div>
        <motion.div
          className="absolute top-8 right-6 font-display text-3xl font-bold text-red-400 border-4 border-red-400 px-3 py-1 rounded-lg rotate-[15deg]"
          style={{ opacity: skipOpacity }}
        >
          SKIP
        </motion.div>
        <motion.div
          className="absolute top-8 left-1/2 -translate-x-1/2 font-display text-3xl font-bold text-blue-400 border-4 border-blue-400 px-3 py-1 rounded-lg"
          style={{ opacity: saveOpacity }}
        >
          SAVE
        </motion.div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
          {/* Streaming */}
          <StreamingPills streaming={streaming} region={region} />

          {/* Title */}
          <h2 className="font-display text-2xl font-bold text-cream leading-tight">
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
        </div>
      </div>
    </motion.div>
  )
}
