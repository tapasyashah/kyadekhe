import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { tagTitle } from '../lib/claude'
import type { Database, Json } from '../lib/supabase/types'

const BATCH_SIZE = 5
const DELAY_BETWEEN_BATCHES_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main(): Promise<void> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('🤖 Claude tagging pipeline...')

  // Fetch titles not yet tagged
  const { data: alreadyTagged } = await supabase.from('title_tags').select('title_id')
  const taggedIds = new Set((alreadyTagged ?? []).map((t) => t.title_id).filter(Boolean) as string[])

  const { data: titles, error } = await supabase
    .from('titles')
    .select('id, title, year, director, top_cast, overview, imdb_rating, imdb_vote_count, genres')

  if (error || !titles) {
    console.error('Failed to fetch titles:', error?.message)
    process.exit(1)
  }

  const untagged = titles.filter((t) => !taggedIds.has(t.id))
  console.log(`  ${taggedIds.size} already tagged. ${untagged.length} to process.`)

  let success = 0
  let failed = 0

  for (let i = 0; i < untagged.length; i += BATCH_SIZE) {
    const batch = untagged.slice(i, i + BATCH_SIZE)
    console.log(`\n  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(untagged.length / BATCH_SIZE)}`)

    for (const title of batch) {
      try {
        const tags = await tagTitle({
          title: title.title,
          year: title.year,
          director: title.director ?? [],
          top_cast: title.top_cast ?? [],
          overview: title.overview,
          imdb_rating: title.imdb_rating ? Number(title.imdb_rating) : null,
          vote_count: title.imdb_vote_count,
          genres: title.genres ?? [],
        })

        const { error: insertError } = await supabase.from('title_tags').insert({
          title_id: title.id,
          tags: tags as unknown as Json,
          tagged_by: 'claude-sonnet-4-6',
          tagged_at: new Date().toISOString(),
          version: 1,
        })

        if (insertError) {
          console.error(`  ✗ ${title.title}: ${insertError.message}`)
          failed++
        } else {
          console.log(`  ✓ ${title.title} (${title.year})`)
          success++
        }
      } catch (err) {
        console.error(`  ✗ ${title.title}: ${err instanceof Error ? err.message : String(err)}`)
        failed++
      }

      await sleep(500)
    }

    if (i + BATCH_SIZE < untagged.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS)
    }
  }

  console.log(`\n✅ Done. Tagged: ${success}, Failed: ${failed}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
