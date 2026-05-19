import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getMovieDetails, getTvDetails, extractDirectors, extractTopCast } from '../lib/tmdb'
import { tagTitle } from '../lib/claude'
import type { Database, Json } from '../lib/supabase/types'

interface SeedEntry {
  tmdb_id: number
  title: string
  year: number
}

async function main(): Promise<void> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const seedPath = join(__dirname, '../seed/onboarding.json')
  const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedEntry[]

  console.log(`🌱 Seeding ${seed.length} onboarding titles...`)

  for (const entry of seed) {
    // Check if already in DB
    const { data: existing } = await supabase
      .from('titles')
      .select('id, title')
      .eq('tmdb_id', entry.tmdb_id)
      .single()

    let titleId: string

    if (existing) {
      console.log(`  ⏭  Already exists: ${existing.title}`)
      titleId = existing.id
    } else {
      // Fetch from TMDb — try movie first, then TV
      let titleRow: Record<string, unknown> | null = null

      try {
        const detail = await getMovieDetails(entry.tmdb_id)
        const directors = extractDirectors(detail.credits?.crew ?? [])
        const cast = extractTopCast(detail.credits?.cast ?? [])
        const year = detail.release_date ? new Date(detail.release_date).getFullYear() : entry.year

        titleRow = {
          tmdb_id: detail.id,
          imdb_id: detail.imdb_id,
          title: detail.title,
          original_title: detail.original_title,
          title_type: 'movie',
          year,
          runtime_minutes: detail.runtime,
          overview: detail.overview,
          poster_path: detail.poster_path,
          backdrop_path: detail.backdrop_path,
          tmdb_rating: detail.vote_average,
          tmdb_vote_count: detail.vote_count,
          director: directors,
          top_cast: cast,
          genres: detail.genres.map((g: { name: string }) => g.name),
          language: detail.original_language,
          origin_country: 'IN',
          hindi_dub: false,
          updated_at: new Date().toISOString(),
        }
      } catch {
        // Try as TV series
        try {
          const detail = await getTvDetails(entry.tmdb_id)
          const directors = extractDirectors(detail.credits?.crew ?? [])
          const cast = extractTopCast(detail.credits?.cast ?? [])
          const year = detail.first_air_date ? new Date(detail.first_air_date).getFullYear() : entry.year

          titleRow = {
            tmdb_id: detail.id,
            imdb_id: detail.external_ids?.imdb_id ?? null,
            title: detail.name,
            original_title: detail.original_name,
            title_type: 'series',
            year,
            runtime_minutes: detail.episode_run_time?.[0] ?? null,
            overview: detail.overview,
            poster_path: detail.poster_path,
            backdrop_path: detail.backdrop_path,
            tmdb_rating: detail.vote_average,
            tmdb_vote_count: detail.vote_count,
            director: directors,
            top_cast: cast,
            genres: detail.genres.map((g: { name: string }) => g.name),
            language: detail.original_language,
            origin_country: 'IN',
            hindi_dub: false,
            updated_at: new Date().toISOString(),
          }
        } catch (tvErr) {
          console.error(`  ✗ Could not fetch ${entry.title}: ${tvErr instanceof Error ? tvErr.message : String(tvErr)}`)
          continue
        }
      }

      if (!titleRow) continue

      const { data: inserted, error: insertError } = await supabase
        .from('titles')
        .upsert(titleRow as Parameters<typeof supabase.from>[0] extends never ? never : never, { onConflict: 'tmdb_id' })
        .select('id')
        .single()

      if (insertError || !inserted) {
        console.error(`  ✗ Insert failed for ${entry.title}: ${insertError?.message}`)
        continue
      }

      console.log(`  ✓ Inserted: ${entry.title}`)
      titleId = inserted.id
    }

    // Ensure it's tagged
    const { data: existingTag } = await supabase
      .from('title_tags')
      .select('id')
      .eq('title_id', titleId)
      .single()

    if (existingTag) {
      console.log(`  ✓ Already tagged: ${entry.title}`)
      continue
    }

    // Fetch full title for tagging
    const { data: fullTitle } = await supabase
      .from('titles')
      .select('*')
      .eq('id', titleId)
      .single()

    if (!fullTitle) continue

    try {
      const tags = await tagTitle({
        title: fullTitle.title,
        year: fullTitle.year,
        director: fullTitle.director ?? [],
        top_cast: fullTitle.top_cast ?? [],
        overview: fullTitle.overview,
        imdb_rating: fullTitle.imdb_rating ? Number(fullTitle.imdb_rating) : null,
        vote_count: fullTitle.imdb_vote_count,
        genres: fullTitle.genres ?? [],
      })

      await supabase.from('title_tags').insert({
        title_id: titleId,
        tags: tags as unknown as Json,
        tagged_by: 'claude-sonnet-4-6',
        version: 1,
      })

      console.log(`  🏷️  Tagged: ${entry.title}`)
    } catch (tagErr) {
      console.error(`  ✗ Tag failed for ${entry.title}: ${tagErr instanceof Error ? tagErr.message : String(tagErr)}`)
    }
  }

  console.log('\n✅ Seed complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
