import { NextResponse } from 'next/server'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'
const LANGUAGE_HINTS: Record<string, string[]> = {
  hi: ['hi', 'en'],
  gu: ['gu', 'hi', 'en'],
}

interface TmdbSearchResult {
  poster_path: string | null
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  original_language?: string
  origin_country?: string[]
  popularity?: number
  vote_count?: number
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function resultYear(result: TmdbSearchResult) {
  const date = result.release_date ?? result.first_air_date
  return date ? Number(date.slice(0, 4)) : null
}

function scoreResult(result: TmdbSearchResult, title: string, year: string | null, language: string | null) {
  if (!result.poster_path) return -100

  const targetTitle = normalizeTitle(title)
  const names = [result.title, result.name, result.original_title, result.original_name]
    .filter((value): value is string => !!value)
    .map(normalizeTitle)

  let score = 0
  if (names.includes(targetTitle)) score += 60
  else if (names.some((name) => name.startsWith(targetTitle) || targetTitle.startsWith(name))) score += 24
  else return -100

  const targetYear = year ? Number(year) : null
  const foundYear = resultYear(result)
  if (targetYear && foundYear) {
    const delta = Math.abs(targetYear - foundYear)
    if (delta === 0) score += 30
    else if (delta <= 3) score += 16
    else return -100
  }

  const languageHints = language ? LANGUAGE_HINTS[language] ?? [language] : []
  if (languageHints.length > 0) {
    if (result.original_language && languageHints.includes(result.original_language)) score += 18
    else score -= 12
  }

  if (result.origin_country?.includes('IN')) score += 8
  score += Math.min(8, (result.vote_count ?? 0) / 100)
  score += Math.min(4, (result.popularity ?? 0) / 20)
  return score
}

function fallbackPoster(title: string) {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2a1820"/>
      <stop offset="0.55" stop-color="#5c1e2e"/>
      <stop offset="1" stop-color="#0e0a0b"/>
    </linearGradient>
  </defs>
  <rect width="500" height="750" fill="url(#bg)"/>
  <circle cx="400" cy="120" r="110" fill="#ff9933" opacity="0.16"/>
  <rect x="54" y="72" width="392" height="606" rx="28" fill="none" stroke="#ff9933" stroke-opacity="0.35" stroke-width="2"/>
  <text x="250" y="330" fill="#fff8e7" font-family="Georgia, serif" font-size="44" font-weight="700" text-anchor="middle">${safeTitle}</text>
  <text x="250" y="640" fill="#ff9933" font-family="Arial, sans-serif" font-size="22" font-weight="700" text-anchor="middle">KyaDekhe</text>
</svg>`
}

async function tmdbSearch(title: string, year: string | null, type: string | null, language: string | null) {
  const apiKey = process.env.TMDB_API_KEY
  const readToken = process.env.TMDB_READ_ACCESS_TOKEN
  if (!apiKey && !readToken) return null

  const mediaType = type === 'series' ? 'tv' : 'movie'
  const url = new URL(`${TMDB_BASE}/search/${mediaType}`)
  url.searchParams.set('query', title)
  url.searchParams.set('include_adult', 'false')
  if (apiKey) url.searchParams.set('api_key', apiKey)

  const res = await fetch(url, {
    headers: readToken ? { Authorization: `Bearer ${readToken}` } : undefined,
    next: { revalidate: 60 * 60 * 24 * 30 },
  })
  if (!res.ok) return null

  const data = await res.json() as { results?: TmdbSearchResult[] }
  const best = (data.results ?? [])
    .map((result) => ({ result, score: scoreResult(result, title, year, language) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]

  return best?.result.poster_path ?? null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')?.trim() || 'KyaDekhe'
  const year = searchParams.get('year')
  const type = searchParams.get('type')
  const language = searchParams.get('language')

  const posterPath = await tmdbSearch(title, year, type, language).catch(() => null)
  if (posterPath) {
    return NextResponse.redirect(`${IMAGE_BASE}${posterPath}`, {
      headers: { 'Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=604800' },
    })
  }

  return new NextResponse(fallbackPoster(title), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=604800',
    },
  })
}
