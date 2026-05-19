const TMDB_BASE = 'https://api.themoviedb.org/3'
const RATE_LIMIT_MS = 250

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) throw new Error('TMDB_API_KEY is not set')

  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', apiKey)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.status} ${response.statusText} for ${path}`)
  }
  return response.json() as Promise<T>
}

export interface TmdbMovie {
  id: number
  title: string
  original_title: string
  overview: string
  release_date: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  vote_count: number
  runtime: number | null
  imdb_id: string | null
  original_language: string
  origin_country?: string[]
  genres: Array<{ id: number; name: string }>
  credits?: {
    crew: Array<{ job: string; name: string }>
    cast: Array<{ name: string; order: number }>
  }
}

export interface TmdbTv {
  id: number
  name: string
  original_name: string
  overview: string
  first_air_date: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  vote_count: number
  episode_run_time: number[]
  external_ids?: { imdb_id: string | null }
  original_language: string
  origin_country: string[]
  genres: Array<{ id: number; name: string }>
  credits?: {
    crew: Array<{ job: string; name: string }>
    cast: Array<{ name: string; order: number }>
  }
}

export interface TmdbDiscoverResult<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface TmdbWatchProviders {
  results: Record<
    string,
    {
      link?: string
      flatrate?: Array<{ provider_name: string; logo_path: string }>
      rent?: Array<{ provider_name: string; logo_path: string }>
      buy?: Array<{ provider_name: string; logo_path: string }>
    }
  >
}

export async function discoverHindiMovies(page: number): Promise<TmdbDiscoverResult<TmdbMovie>> {
  await delay(RATE_LIMIT_MS)
  return tmdbFetch<TmdbDiscoverResult<TmdbMovie>>('/discover/movie', {
    with_origin_country: 'IN',
    with_original_language: 'hi',
    sort_by: 'vote_count.desc',
    page: String(page),
  })
}

export async function discoverHindiSeries(page: number): Promise<TmdbDiscoverResult<TmdbTv>> {
  await delay(RATE_LIMIT_MS)
  return tmdbFetch<TmdbDiscoverResult<TmdbTv>>('/discover/tv', {
    with_origin_country: 'IN',
    with_original_language: 'hi',
    sort_by: 'vote_count.desc',
    page: String(page),
  })
}

export async function discoverSouthIndianWithDub(
  page: number
): Promise<TmdbDiscoverResult<TmdbMovie>> {
  await delay(RATE_LIMIT_MS)
  return tmdbFetch<TmdbDiscoverResult<TmdbMovie>>('/discover/movie', {
    with_origin_country: 'IN',
    with_original_language: 'ta|te|kn|ml',
    sort_by: 'vote_count.desc',
    page: String(page),
  })
}

export async function getMovieDetails(tmdbId: number): Promise<TmdbMovie> {
  await delay(RATE_LIMIT_MS)
  return tmdbFetch<TmdbMovie>(`/movie/${tmdbId}`, {
    append_to_response: 'credits',
  })
}

export async function getTvDetails(tmdbId: number): Promise<TmdbTv & { external_ids: { imdb_id: string | null } }> {
  await delay(RATE_LIMIT_MS)
  return tmdbFetch<TmdbTv & { external_ids: { imdb_id: string | null } }>(`/tv/${tmdbId}`, {
    append_to_response: 'credits,external_ids',
  })
}

export async function getWatchProviders(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<TmdbWatchProviders> {
  await delay(RATE_LIMIT_MS)
  return tmdbFetch<TmdbWatchProviders>(`/${mediaType}/${tmdbId}/watch/providers`)
}

export function extractDirectors(crew: Array<{ job: string; name: string }>): string[] {
  return crew.filter((c) => c.job === 'Director').map((c) => c.name)
}

export function extractTopCast(cast: Array<{ name: string; order: number }>, limit = 5): string[] {
  return cast
    .sort((a, b) => a.order - b.order)
    .slice(0, limit)
    .map((c) => c.name)
}
