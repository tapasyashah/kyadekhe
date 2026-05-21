import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecommendations } from '@/lib/recommender'
import { MOODS } from '@/lib/moods'
import type { Tables } from '@/lib/supabase/types'

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
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)
    const languageFilter = searchParams.get('language') ?? undefined
    const moodId = searchParams.get('mood')
    const eraFilter = searchParams.get('era') ?? undefined
    const platformFilter = searchParams.get('platform') ?? undefined
    const excludeTitleIds = (searchParams.get('exclude') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
      .slice(0, 100)

    let moodFilters: Record<string, string[]> | undefined
    if (moodId) {
      const mood = MOODS.find((m) => m.id === moodId)
      if (mood) moodFilters = mood.filters as unknown as Record<string, string[]>
    }

    if (!user) {
      // Guest mode: return top-rated titles without personalisation
      const candidateLimit = Math.min(300, Math.max(limit * 10, 80))
      let query = supabase
        .from('titles')
        .select('*')
        .not('imdb_rating', 'is', null)
        .order('imdb_rating', { ascending: false })
        .limit(candidateLimit)

      if (languageFilter && languageFilter !== 'All') {
        query = query.eq('language', languageFilter)
      }

      if (excludeTitleIds.length > 0) {
        query = query.not('id', 'in', `(${excludeTitleIds.join(',')})`)
      }

      const { data: titles } = await query
      if (!titles || titles.length === 0) return NextResponse.json([])

      const titleIds = titles.map((t) => t.id)
      const [tagRows, streamingRows] = await Promise.all([
        supabase.from('title_tags').select('title_id, tags').in('title_id', titleIds).limit(titleIds.length),
        supabase.from('streaming_availability').select('*').in('title_id', titleIds).eq('region', 'IN'),
      ])

      const tagsByTitleId = new Map<string, Record<string, unknown>>()
      for (const row of tagRows.data ?? []) {
        if (row.title_id) tagsByTitleId.set(row.title_id, row.tags as Record<string, unknown>)
      }

      const streamingByTitleId = new Map<string, Tables<'streaming_availability'>[]>()
      for (const row of streamingRows.data ?? []) {
        if (!row.title_id) continue
        const existing = streamingByTitleId.get(row.title_id) ?? []
        streamingByTitleId.set(row.title_id, [...existing, row])
      }

      let results = titles.map((title) => ({
        title,
        tags: tagsByTitleId.get(title.id) ?? {},
        score: Number(title.imdb_rating ?? 0),
        streaming: streamingByTitleId.get(title.id) ?? [],
      }))

      if (moodFilters && Object.keys(moodFilters).length > 0) {
        results = results.filter((result) => {
          for (const [field, allowed] of Object.entries(moodFilters)) {
            const value = result.tags[field]
            if (typeof value !== 'string' || !allowed.includes(value)) return false
          }
          return true
        })
      }

      if (eraFilter && eraFilter !== 'all') {
        results = results.filter((result) => result.tags['era'] === eraFilter)
      }

      if (platformFilter) {
        results = results.filter((result) => result.streaming.some((s) => s.platform === platformFilter))
      }

      return NextResponse.json(results.slice(0, limit))
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
