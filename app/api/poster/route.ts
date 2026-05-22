import { NextResponse } from 'next/server'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

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

async function tmdbSearch(title: string, year: string | null, type: string | null) {
  const apiKey = process.env.TMDB_API_KEY
  const readToken = process.env.TMDB_READ_ACCESS_TOKEN
  if (!apiKey && !readToken) return null

  const mediaType = type === 'series' ? 'tv' : 'movie'
  const url = new URL(`${TMDB_BASE}/search/${mediaType}`)
  url.searchParams.set('query', title)
  url.searchParams.set('include_adult', 'false')
  if (year && mediaType === 'movie') url.searchParams.set('year', year)
  if (year && mediaType === 'tv') url.searchParams.set('first_air_date_year', year)
  if (apiKey) url.searchParams.set('api_key', apiKey)

  const res = await fetch(url, {
    headers: readToken ? { Authorization: `Bearer ${readToken}` } : undefined,
    next: { revalidate: 60 * 60 * 24 * 30 },
  })
  if (!res.ok) return null

  const data = await res.json() as { results?: Array<{ poster_path: string | null }> }
  return data.results?.find((result) => result.poster_path)?.poster_path ?? null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')?.trim() || 'KyaDekhe'
  const year = searchParams.get('year')
  const type = searchParams.get('type')

  const posterPath = await tmdbSearch(title, year, type).catch(() => null)
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
