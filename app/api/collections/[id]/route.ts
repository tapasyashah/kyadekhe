import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: col } = await supabase
      .from('collections')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
    if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: items } = await supabase
      .from('collection_items')
      .select('*, titles(*)')
      .eq('collection_id', params.id)
      .order('added_at', { ascending: false })

    return NextResponse.json({ collection: col, items: items ?? [] })
  } catch (err) {
    console.error('collection GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { titleId?: string; note?: string }
    if (!body.titleId) return NextResponse.json({ error: 'titleId required' }, { status: 400 })

    const { data: col } = await supabase
      .from('collections')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
    if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error } = await supabase.from('collection_items').upsert({
      collection_id: params.id,
      title_id: body.titleId,
      note: body.note ?? null,
    }, { onConflict: 'collection_id,title_id', ignoreDuplicates: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('collection POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('collections').delete().eq('id', params.id).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('collection DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
