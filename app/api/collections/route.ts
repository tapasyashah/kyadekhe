import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase.from('collections').select('*').eq('user_id', user.id).order('created_at')
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('collections GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { name?: string; emoji?: string; description?: string }
    if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const { data, error } = await supabase.from('collections').insert({
      user_id: user.id,
      name: body.name.trim(),
      emoji: body.emoji ?? '🎬',
      description: body.description ?? null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('collections POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
