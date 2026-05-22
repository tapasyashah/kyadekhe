import type { Tables } from '@/lib/supabase/types'

export const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500'
export const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780'

export function posterSrc(title: Pick<Tables<'titles'>, 'poster_path' | 'title' | 'year' | 'title_type' | 'language'>): string {
  if (title.poster_path) return `${TMDB_POSTER_BASE}${title.poster_path}`

  const params = new URLSearchParams({
    title: title.title,
    type: title.title_type,
  })
  if (title.year) params.set('year', String(title.year))
  if (title.language) params.set('language', title.language)

  return `/api/poster?${params.toString()}`
}

export function backdropSrc(title: Pick<Tables<'titles'>, 'backdrop_path' | 'poster_path' | 'title' | 'year' | 'title_type' | 'language'>): string {
  if (title.backdrop_path) return `${TMDB_BACKDROP_BASE}${title.backdrop_path}`
  return posterSrc(title)
}
