import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecommendations } from '@/lib/recommender'
import { MOODS } from '@/lib/moods'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)
    const moodId = searchParams.get('mood')
    const eraFilter = searchParams.get('era') ?? undefined
    const platformFilter = searchParams.get('platform') ?? undefined

    const { data: profile } = await supabase.from('users').select('region').eq('id', user.id).single()
    const region = profile?.region ?? 'IN'

    let moodFilters: Record<string, string[]> | undefined
    if (moodId) {
      const mood = MOODS.find((m) => m.id === moodId)
      if (mood) moodFilters = mood.filters as unknown as Record<string, string[]>
    }

    const results = await getRecommendations(user.id, supabase, {
      limit, moodFilters, eraFilter, platformFilter, region,
    })

    return NextResponse.json(results)
  } catch (err) {
    console.error('recommendations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
