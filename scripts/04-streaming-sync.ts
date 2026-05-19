import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { getWatchProviders } from '../lib/tmdb'
import type { Database } from '../lib/supabase/types'

const REGIONS = ['IN', 'CA', 'GB', 'US', 'AU']

async function main(): Promise<void> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('📡 Syncing streaming availability...')

  const { data: titles, error } = await supabase
    .from('titles')
    .select('id, tmdb_id, title, title_type')
    .not('tmdb_id', 'is', null)

  if (error || !titles) {
    console.error('Failed to fetch titles:', error?.message)
    process.exit(1)
  }

  console.log(`  Processing ${titles.length} titles...`)

  for (const title of titles) {
    if (!title.tmdb_id) continue
    const mediaType = title.title_type === 'movie' ? 'movie' : 'tv'

    try {
      const providers = await getWatchProviders(title.tmdb_id, mediaType)

      for (const region of REGIONS) {
        const regionData = providers.results[region]
        if (!regionData) continue

        const entries: Array<{
          title_id: string
          region: string
          platform: string
          availability_type: string
          link: string | null
          last_verified: string
        }> = []

        const link = regionData.link ?? null
        const now = new Date().toISOString()

        for (const p of regionData.flatrate ?? []) {
          entries.push({ title_id: title.id, region, platform: p.provider_name, availability_type: 'flatrate', link, last_verified: now })
        }
        for (const p of regionData.rent ?? []) {
          entries.push({ title_id: title.id, region, platform: p.provider_name, availability_type: 'rent', link, last_verified: now })
        }
        for (const p of regionData.buy ?? []) {
          entries.push({ title_id: title.id, region, platform: p.provider_name, availability_type: 'buy', link, last_verified: now })
        }

        if (entries.length > 0) {
          await supabase.from('streaming_availability').upsert(entries, {
            onConflict: 'title_id,region,platform',
            ignoreDuplicates: false,
          })
        }
      }

      console.log(`  ✓ ${title.title}`)
    } catch (err) {
      console.error(`  ✗ ${title.title}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log('\n✅ Streaming sync complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
