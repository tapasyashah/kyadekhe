import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/types'

const ALLOWED_PLATFORMS = new Set(['Netflix', 'Amazon Prime Video', 'Disney+ Hotstar', 'Zee5', 'SonyLIV'])

async function main(): Promise<void> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('🔍 Running quality gate...')

  const { data: titles, error } = await supabase
    .from('titles')
    .select('id, title, imdb_vote_count, tmdb_vote_count')

  if (error || !titles) {
    console.error('Failed to fetch titles:', error?.message)
    process.exit(1)
  }

  // Find titles with any streaming availability on major platforms
  const { data: streaming } = await supabase
    .from('streaming_availability')
    .select('title_id, platform')

  const titlesWithStreaming = new Set(
    (streaming ?? [])
      .filter((s) => ALLOWED_PLATFORMS.has(s.platform))
      .map((s) => s.title_id)
      .filter(Boolean) as string[]
  )

  const toKeep: string[] = []
  const toRemove: string[] = []

  for (const title of titles) {
    const passesVoteCount =
      (title.imdb_vote_count ?? 0) >= 500 ||
      (title.tmdb_vote_count ?? 0) >= 200

    const passesStreaming = titlesWithStreaming.has(title.id)

    if (passesVoteCount || passesStreaming) {
      toKeep.push(title.id)
    } else {
      toRemove.push(title.id)
      console.log(`  ✗ Removing: ${title.title} (imdb=${title.imdb_vote_count ?? 0}, tmdb=${title.tmdb_vote_count ?? 0})`)
    }
  }

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('titles')
      .delete()
      .in('id', toRemove)

    if (deleteError) {
      console.error('Failed to delete titles:', deleteError.message)
      process.exit(1)
    }
  }

  console.log(`\n✅ Done. Kept: ${toKeep.length}, Removed: ${toRemove.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
