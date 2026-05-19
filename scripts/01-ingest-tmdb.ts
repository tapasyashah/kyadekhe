import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  discoverHindiMovies, discoverHindiSeries,
  getMovieDetails, getTvDetails,
  extractDirectors, extractTopCast,
} from '../lib/tmdb'
import type { Database } from '../lib/supabase/types'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const MAX_PAGES = 10 // Remove this cap for full ingest (~200 titles per 10 pages)
const PROGRESS_FILE = join(__dirname, '.ingest-progress.json')

interface Progress {
  lastMoviePage: number
  lastTvPage: number
  done: boolean
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')) as Progress
  }
  return { lastMoviePage: 0, lastTvPage: 0, done: false }
}

function saveProgress(p: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

async function main(): Promise<void> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const progress = loadProgress()
  let inserted = 0

  // --- Hindi Movies ---
  console.log('📽️  Ingesting Hindi movies...')
  for (let page = progress.lastMoviePage + 1; page <= MAX_PAGES; page++) {
    const result = await discoverHindiMovies(page)
    console.log(`  Movie page ${page}/${Math.min(result.total_pages, MAX_PAGES)}`)

    for (const movie of result.results) {
      try {
        const detail = await getMovieDetails(movie.id)

        // Bollywood-only: skip non-Hindi originals
        if (detail.original_language !== 'hi') {
          console.log(`  ↷ Skipped non-Hindi: ${detail.title} (${detail.original_language})`)
          continue
        }

        const directors = extractDirectors(detail.credits?.crew ?? [])
        const cast = extractTopCast(detail.credits?.cast ?? [])
        const year = detail.release_date ? new Date(detail.release_date).getFullYear() : null

        const { error } = await supabase.from('titles').upsert({
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
          genres: detail.genres.map((g) => g.name),
          language: detail.original_language,
          origin_country: detail.origin_country?.[0] ?? 'IN',
          hindi_dub: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tmdb_id' })

        if (error) {
          console.error(`  ✗ ${detail.title}: ${error.message}`)
        } else {
          console.log(`  ✓ ${detail.title} (${year})`)
          inserted++
        }
      } catch (err) {
        console.error(`  ✗ tmdb_id=${movie.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    progress.lastMoviePage = page
    saveProgress(progress)

    if (page >= result.total_pages) break
  }

  // --- Hindi TV Series ---
  console.log('\n📺  Ingesting Hindi series...')
  for (let page = progress.lastTvPage + 1; page <= MAX_PAGES; page++) {
    const result = await discoverHindiSeries(page)
    console.log(`  TV page ${page}/${Math.min(result.total_pages, MAX_PAGES)}`)

    for (const show of result.results) {
      try {
        const detail = await getTvDetails(show.id)

        // Bollywood-only: skip non-Hindi originals
        if (detail.original_language !== 'hi') {
          console.log(`  ↷ Skipped non-Hindi series: ${detail.name} (${detail.original_language})`)
          continue
        }

        const directors = extractDirectors(detail.credits?.crew ?? [])
        const cast = extractTopCast(detail.credits?.cast ?? [])
        const year = detail.first_air_date ? new Date(detail.first_air_date).getFullYear() : null

        const { error } = await supabase.from('titles').upsert({
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
          genres: detail.genres.map((g) => g.name),
          language: detail.original_language,
          origin_country: detail.origin_country?.[0] ?? 'IN',
          hindi_dub: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tmdb_id' })

        if (error) {
          console.error(`  ✗ ${detail.name}: ${error.message}`)
        } else {
          console.log(`  ✓ ${detail.name} (${year})`)
          inserted++
        }
      } catch (err) {
        console.error(`  ✗ tmdb_id=${show.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    progress.lastTvPage = page
    saveProgress(progress)

    if (page >= result.total_pages) break
  }

  console.log(`\n✅ Done. ${inserted} titles upserted.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
