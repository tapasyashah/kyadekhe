import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createReadStream, existsSync } from 'fs'
import { createInterface } from 'readline'
import { createGunzip } from 'zlib'
import { join } from 'path'
import type { Database } from '../lib/supabase/types'

const IMDB_DIR = join(__dirname, 'imdb-cache')

async function readTsvGz(filePath: string): Promise<Map<string, Record<string, string>>> {
  return new Promise((resolve, reject) => {
    const rows = new Map<string, Record<string, string>>()
    let headers: string[] = []
    let isFirst = true

    const stream = createReadStream(filePath).pipe(createGunzip())
    const rl = createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      const fields = line.split('\t')
      if (isFirst) {
        headers = fields
        isFirst = false
        return
      }
      const id = fields[0]
      if (!id) return
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = fields[i] ?? '' })
      rows.set(id, row)
    })

    rl.on('close', () => resolve(rows))
    rl.on('error', reject)
    stream.on('error', reject)
  })
}

async function main(): Promise<void> {
  const basicsPath = join(IMDB_DIR, 'title.basics.tsv.gz')
  const ratingsPath = join(IMDB_DIR, 'title.ratings.tsv.gz')

  if (!existsSync(basicsPath) || !existsSync(ratingsPath)) {
    console.log(`
IMDb dataset files not found in ${IMDB_DIR}/

Download them from: https://datasets.imdbws.com/
  - title.basics.tsv.gz
  - title.ratings.tsv.gz

Place them in scripts/imdb-cache/ and re-run this script.
    `)
    process.exit(0)
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('📖 Fetching titles with imdb_id from DB...')
  const { data: titles, error } = await supabase
    .from('titles')
    .select('id, imdb_id')
    .not('imdb_id', 'is', null)

  if (error || !titles) {
    console.error('Failed to fetch titles:', error?.message)
    process.exit(1)
  }

  const imdbIdToDbId = new Map(titles.map((t) => [t.imdb_id!, t.id]))
  console.log(`  Found ${imdbIdToDbId.size} titles with IMDb IDs`)

  console.log('📦 Reading IMDb ratings...')
  const ratingsMap = await readTsvGz(ratingsPath)
  console.log(`  Loaded ${ratingsMap.size} IMDb rating rows`)

  let updated = 0
  for (const [imdbId, dbId] of Array.from(imdbIdToDbId.entries())) {
    const ratingRow = ratingsMap.get(imdbId)
    if (!ratingRow) continue

    const imdb_rating = parseFloat(ratingRow['averageRating'] ?? '')
    const imdb_vote_count = parseInt(ratingRow['numVotes'] ?? '', 10)
    if (isNaN(imdb_rating) && isNaN(imdb_vote_count)) continue

    const { error: updateError } = await supabase
      .from('titles')
      .update({
        imdb_rating: isNaN(imdb_rating) ? null : imdb_rating,
        imdb_vote_count: isNaN(imdb_vote_count) ? null : imdb_vote_count,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbId)

    if (updateError) {
      console.error(`  ✗ ${imdbId}: ${updateError.message}`)
    } else {
      updated++
    }
  }

  console.log(`\n✅ Done. ${updated} titles enriched with IMDb ratings.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
