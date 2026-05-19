import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeTasteVector } from '@/lib/taste-vector'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { titleId?: string; rating?: string }
    const { titleId, rating } = body

    const validRatings = ['loved', 'liked', 'meh', 'disliked', 'havent_seen', 'skip']
    if (!titleId || !rating || !validRatings.includes(rating)) {
      return NextResponse.json({ error: 'titleId and valid rating required' }, { status: 400 })
    }

    const { error } = await supabase.from('ratings').upsert({
      user_id: user.id,
      title_id: titleId,
      rating: rating as 'loved' | 'liked' | 'meh' | 'disliked' | 'havent_seen' | 'skip',
    }, { onConflict: 'user_id,title_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Recompute taste vector every 5 ratings
    const { count } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) % 5 === 0) {
      await computeTasteVector(user.id, supabase).catch(() => null)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('ratings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase.from('ratings').select('*, titles(title, year)').eq('user_id', user.id)
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('ratings GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
