import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseAskQuery } from '@/lib/claude'
import { getRecommendations } from '@/lib/recommender'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { query?: string }
    const query = body.query?.trim()
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

    const { tagFilters, explanation } = await parseAskQuery(query)

    const moodFilters: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(tagFilters)) {
      moodFilters[k] = Array.isArray(v) ? v : [v]
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
