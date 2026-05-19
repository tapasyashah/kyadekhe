import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWhy } from '@/lib/claude'
import { getTasteVector, tasteClusterKey } from '@/lib/taste-vector'
import type { TitleTags } from '@/lib/claude'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { titleId?: string }
    const { titleId } = body
    if (!titleId) return NextResponse.json({ error: 'titleId required' }, { status: 400 })

    const tasteVector = await getTasteVector(user.id, supabase)
    const cluster = tasteClusterKey(tasteVector)

    // Check cache first
    const { data: cached } = await supabase
      .from('why_cache')
      .select('explanation')
      .eq('title_id', titleId)
      .eq('taste_cluster', cluster)
      .single()

    if (cached) return NextResponse.json({ explanation: cached.explanation })

    // Generate new
    const [{ data: titleRow }, { data: tagRow }] = await Promise.all([
      supabase.from('titles').select('title, year').eq('id', titleId).single(),
      supabase.from('title_tags').select('tags').eq('title_id', titleId).single(),
    ])

    if (!titleRow) return NextResponse.json({ error: 'Title not found' }, { status: 404 })

    // Get user's top loved titles
    const { data: lovedRatings } = await supabase
      .from('ratings')
      .select('title_id')
      .eq('user_id', user.id)
      .eq('rating', 'loved')
      .limit(5)

    const lovedIds = lovedRatings?.map((r) => r.title_id).filter(Boolean) as string[]
    let lovedTitles: string[] = []
    if (lovedIds.length > 0) {
      const { data: lovedTitleRows } = await supabase.from('titles').select('title').in('id', lovedIds)
      lovedTitles = lovedTitleRows?.map((t) => t.title) ?? []
    }

    const explanation = await generateWhy(
      { title: titleRow.title, year: titleRow.year, tags: (tagRow?.tags as Partial<TitleTags>) ?? {} },
      lovedTitles
    )

    // Cache it
    await supabase.from('why_cache').upsert({
      title_id: titleId,
      taste_cluster: cluster,
      explanation,
    }, { onConflict: 'title_id,taste_cluster' })

    return NextResponse.json({ explanation })
  } catch (err) {
    console.error('why error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
