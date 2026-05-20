import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecommendations } from '@/lib/recommender'
import { MOODS } from '@/lib/moods'

// Simple in-memory rate limit: 20 req/min per user
// Resets on cold starts — acceptable for a single-instance launch
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

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

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (isRateLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)
    const moodId = searchParams.get('mood')
    const eraFilter = searchParams.get('era') ?? undefined
    const platformFilter = searchParams.get('platform') ?? undefined
    const languageFilter = searchParams.get('language') ?? undefined

    const { data: profile } = await supabase.from('users').select('region').eq('id', user.id).single()
    const region = profile?.region ?? 'IN'

    let moodFilters: Record<string, string[]> | undefined
    if (moodId) {
      const mood = MOODS.find((m) => m.id === moodId)
      if (mood) moodFilters = mood.filters as unknown as Record<string, string[]>
    }

    const results = await getRecommendations(user.id, supabase, {
      limit, moodFilters, eraFilter, platformFilter, region, languageFilter,
    })

    return NextResponse.json(results)
  } catch (err) {
    console.error('recommendations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
