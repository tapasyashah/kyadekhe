import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWatchProviders } from '@/lib/tmdb'

const REGIONS = ['IN', 'CA', 'GB', 'US', 'AU']

export async function GET(request: Request) {
  const cronSecret = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const { data: titles } = await supabase
      .from('titles')
      .select('id, tmdb_id, title, title_type')
      .not('tmdb_id', 'is', null)
      .limit(50) // Small batch — run nightly via Vercel cron

    let updated = 0

    for (const title of titles ?? []) {
      if (!title.tmdb_id) continue
      const mediaType = title.title_type === 'movie' ? 'movie' : 'tv'

      try {
        const providers = await getWatchProviders(title.tmdb_id, mediaType)
        const now = new Date().toISOString()

        for (const region of REGIONS) {
          const regionData = providers.results[region]
          if (!regionData) continue

          const entries = [
            ...(regionData.flatrate ?? []).map((p) => ({ title_id: title.id, region, platform: p.provider_name, availability_type: 'flatrate', link: regionData.link ?? null, last_verified: now })),
            ...(regionData.rent ?? []).map((p) => ({ title_id: title.id, region, platform: p.provider_name, availability_type: 'rent', link: regionData.link ?? null, last_verified: now })),
          ]

          if (entries.length > 0) {
            await supabase.from('streaming_availability').upsert(entries, { onConflict: 'title_id,region,platform' })
          }
        }
        updated++
      } catch { /* continue */ }
    }

    return NextResponse.json({ updated })
  } catch (err) {
    console.error('cron error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
