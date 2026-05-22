import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseAskQuery } from '@/lib/claude'
import { getAnonymousRecommendations, getRecommendations, type AnonymousSignal } from '@/lib/recommender'

const VALID_RATINGS = new Set(['loved', 'liked', 'skip'])

function parseSignals(value: unknown): AnonymousSignal[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is AnonymousSignal => (
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as AnonymousSignal).titleId === 'string' &&
        /^[0-9a-f-]{36}$/i.test((entry as AnonymousSignal).titleId) &&
        VALID_RATINGS.has((entry as AnonymousSignal).rating)
      ))
      .slice(-250)
  }

  if (typeof value === 'object' && value !== null) {
    const signals: AnonymousSignal[] = []
    for (const rating of ['loved', 'liked', 'skip'] as const) {
      const ids = (value as Partial<Record<typeof rating, unknown>>)[rating]
      if (!Array.isArray(ids)) continue
      for (const titleId of ids) {
        if (typeof titleId === 'string' && /^[0-9a-f-]{36}$/i.test(titleId)) {
          signals.push({ titleId, rating })
        }
      }
    }
    return signals.slice(-250)
  }

  return []
}

function fallbackParseAskQuery(query: string) {
  const q = query.toLowerCase()
  const tagFilters: Record<string, string | string[]> = {}

  if (q.includes('cry') || q.includes('sad') || q.includes('devastating') || q.includes('heavy')) {
    tagFilters.emotional_weight = ['heavy', 'devastating']
  } else if (q.includes('fun') || q.includes('light') || q.includes('easy')) {
    tagFilters.emotional_weight = ['featherlight', 'breezy', 'emotionally engaging']
  }

  if (q.includes('small town')) tagFilters.setting = 'small town'
  if (q.includes('rural') || q.includes('village')) tagFilters.setting = 'rural'
  if (q.includes('nri') || q.includes('diaspora')) tagFilters.setting = 'NRI/diaspora'
  if (q.includes('90s')) tagFilters.era = '90s blockbuster'
  if (q.includes('classic')) tagFilters.era = '40s-60s classic'
  if (q.includes('series') || q.includes('show')) tagFilters.format = 'web series'
  if (q.includes('family') || q.includes('parents')) tagFilters.watch_with = ['with family', 'with parents specifically']
  if (q.includes('thriller') || q.includes('gritty')) tagFilters.attention_required = 'full focus required'

  return {
    tagFilters,
    explanation: 'Matched from your words using KyaDekhe tags.',
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json() as { query?: string; signals?: unknown }
    const query = body.query?.trim()
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

    const { tagFilters, explanation } = await parseAskQuery(query).catch(() => fallbackParseAskQuery(query))

    const moodFilters: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(tagFilters)) {
      moodFilters[k] = Array.isArray(v) ? v : [v]
    }

    if (!user) {
      const results = await getAnonymousRecommendations(supabase, {
        limit: 10,
        moodFilters,
        signals: parseSignals(body.signals),
      })
      return NextResponse.json({ results, explanation, parsedFilters: tagFilters })
    }

    const { data: profile } = await supabase.from('users').select('region').eq('id', user.id).single()
    const region = profile?.region ?? 'IN'
    const results = await getRecommendations(user.id, supabase, { limit: 10, moodFilters, region })

    return NextResponse.json({ results, explanation, parsedFilters: tagFilters })
  } catch (err) {
    console.error('ask error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
