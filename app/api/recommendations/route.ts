import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnonymousRecommendations, getRecommendations, type AnonymousSignal } from '@/lib/recommender'
import { MOODS } from '@/lib/moods'

// Simple in-memory rate limit: 20 req/min per user
// Resets on cold starts — acceptable for a single-instance launch
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const VALID_RATINGS = new Set(['loved', 'liked', 'skip'])

export const dynamic = 'force-dynamic'

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
}

function parseUuidList(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 250)
}

function parseSignals(searchParams: URLSearchParams): AnonymousSignal[] {
  const signals: AnonymousSignal[] = []
  for (const rating of ['loved', 'liked', 'skip'] as const) {
    for (const titleId of parseUuidList(searchParams.get(rating))) {
      signals.push({ titleId, rating })
    }
  }

  const compact = searchParams.get('signals')
  if (compact) {
    for (const part of compact.split(',')) {
      const [titleId, rating] = part.split(':')
      if (/^[0-9a-f-]{36}$/i.test(titleId) && VALID_RATINGS.has(rating)) {
        signals.push({ titleId, rating: rating as AnonymousSignal['rating'] })
      }
    }
  }

  return signals.slice(-250)
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)
    const languageFilter = searchParams.get('language') ?? undefined
    const moodId = searchParams.get('mood')
    const eraFilter = searchParams.get('era') ?? undefined
    const platformFilter = searchParams.get('platform') ?? undefined
    const excludeTitleIds = parseUuidList(searchParams.get('exclude'))
    const signals = parseSignals(searchParams)

    let moodFilters: Record<string, string[]> | undefined
    if (moodId) {
      const mood = MOODS.find((m) => m.id === moodId)
      if (mood) moodFilters = mood.filters as unknown as Record<string, string[]>
    }

    if (!user) {
      const results = await getAnonymousRecommendations(supabase, {
        limit, moodFilters, eraFilter, platformFilter, languageFilter, excludeTitleIds, signals,
      })
      return NextResponse.json(results)
    }

    if (isRateLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { data: profile } = await supabase.from('users').select('region').eq('id', user.id).single()
    const region = profile?.region ?? 'IN'

    const results = await getRecommendations(user.id, supabase, {
      limit, moodFilters, eraFilter, platformFilter, region, languageFilter, excludeTitleIds,
    })

    return NextResponse.json(results)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('recommendations error:', msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
