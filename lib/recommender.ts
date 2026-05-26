import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/supabase/types'
import { getTasteVector } from '@/lib/taste-vector'

export interface RecommendedTitle {
  title: Tables<'titles'>
  tags: Record<string, unknown>
  score: number
  streaming: Tables<'streaming_availability'>[]
}

export interface RecommendOptions {
  limit?: number
  moodFilters?: Record<string, string[]>
  platformFilter?: string
  eraFilter?: string
  region?: string
  languageFilter?: string
  excludeTitleIds?: string[]
}

export interface AnonymousSignal {
  titleId: string
  rating: 'not_watched' | 'disliked' | 'liked' | 'loved' | 'skip'
}

function languageCode(languageFilter?: string) {
  if (!languageFilter || languageFilter === 'All') return null
  if (languageFilter === 'Hindi') return 'hi'
  if (languageFilter === 'Gujarati') return 'gu'
  return languageFilter
}

function titleQualityScore(title: Tables<'titles'>) {
  if (typeof title.imdb_rating === 'number') return title.imdb_rating / 10

  if (typeof title.tmdb_rating === 'number') {
    const confidence = Math.min(1, Number(title.tmdb_vote_count ?? 0) / 120)
    return ((title.tmdb_rating * confidence) + (6.8 * (1 - confidence))) / 10
  }

  return 0.68
}

function interleaveByLanguage(
  scored: Array<{ title: Tables<'titles'>; tags: Record<string, unknown>; score: number }>,
  limit: number
) {
  const byLanguage = new Map<string, typeof scored>()
  for (const item of scored) {
    const language = item.title.language ?? 'unknown'
    byLanguage.set(language, [...(byLanguage.get(language) ?? []), item])
  }

  const preferredOrder = ['hi', 'gu', ...Array.from(byLanguage.keys()).filter((language) => !['hi', 'gu'].includes(language))]
  const mixed: typeof scored = []

  while (mixed.length < limit && byLanguage.size > 0) {
    let added = false
    for (const language of preferredOrder) {
      const bucket = byLanguage.get(language)
      if (!bucket || bucket.length === 0) continue
      const next = bucket.shift()
      if (next) {
        mixed.push(next)
        added = true
      }
      if (bucket.length === 0) byLanguage.delete(language)
      if (mixed.length >= limit) break
    }
    if (!added) break
  }

  return mixed
}

async function fetchTitleTagsByIds(
  supabase: SupabaseClient<Database>,
  titleIds: string[]
) {
  const rows: Array<{ title_id: string | null; tags: unknown }> = []
  const uniqueIds = Array.from(new Set(titleIds)).filter(Boolean)

  for (let i = 0; i < uniqueIds.length; i += 80) {
    const chunk = uniqueIds.slice(i, i + 80)
    const { data } = await supabase
      .from('title_tags')
      .select('title_id, tags')
      .in('title_id', chunk)

    rows.push(...(data ?? []))
  }

  return rows
}

export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>
): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (const [key, val] of Object.entries(a)) {
    dot += val * (b[key] ?? 0)
    normA += val * val
  }
  for (const val of Object.values(b)) {
    normB += val * val
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function buildTagVector(tags: Record<string, unknown>): Record<string, number> {
  const v: Record<string, number> = {}
  const stringFields = [
    'era', 'format', 'language_register', 'emotional_weight', 'humour_style',
    'romance_type', 'family_dynamics', 'attention_required', 'watch_with',
    'rewatch_value', 'runtime_feel', 'writing_quality', 'direction_style',
    'music_centrality', 'spectacle_factor', 'setting', 'class_lens',
    'social_commentary', 'nostalgia_trigger',
  ]
  for (const field of stringFields) {
    const val = tags[field]
    if (typeof val === 'string') v[`${field}:${val}`] = 1
  }
  return v
}

export function matchesMoodFilters(tags: Record<string, unknown>, moodFilters: Record<string, string[]>): boolean {
  for (const [field, allowed] of Object.entries(moodFilters)) {
    const val = tags[field]
    if (typeof val !== 'string') continue
    if (!allowed.includes(val)) return false
  }
  return true
}

function buildAnonymousTasteVector(
  signals: AnonymousSignal[],
  tagsByTitleId: Map<string, Record<string, unknown>>
): Record<string, number> {
  const weights: Record<AnonymousSignal['rating'], number> = {
    loved: 3,
    liked: 1.4,
    disliked: -1.5,
    skip: -1.5,
    not_watched: 0,
  }
  const vector: Record<string, number> = {}

  for (const signal of signals) {
    if (signal.rating === 'not_watched') continue
    const tags = tagsByTitleId.get(signal.titleId)
    if (!tags) continue
    const tagVector = buildTagVector(tags)
    const weight = weights[signal.rating]
    for (const key of Object.keys(tagVector)) {
      vector[key] = (vector[key] ?? 0) + weight
    }
  }

  const maxAbs = Math.max(1, ...Object.values(vector).map(Math.abs))
  return Object.fromEntries(Object.entries(vector).map(([key, value]) => [key, value / maxAbs]))
}

export async function getAnonymousRecommendations(
  supabase: SupabaseClient<Database>,
  opts: RecommendOptions & { signals?: AnonymousSignal[] } = {}
): Promise<RecommendedTitle[]> {
  const {
    limit = 20,
    moodFilters,
    platformFilter,
    eraFilter,
    region = 'IN',
    languageFilter,
    excludeTitleIds = [],
    signals = [],
  } = opts
  const signalTitleIds = Array.from(new Set(signals.map((signal) => signal.titleId)))
  const requestedLanguage = languageCode(languageFilter)

  let titlesQuery = supabase
    .from('titles')
    .select('*')
    .order('created_at', { ascending: true })

  if (requestedLanguage) {
    titlesQuery = titlesQuery.eq('language', requestedLanguage)
  }

  if (excludeTitleIds.length > 0) {
    titlesQuery = titlesQuery.not('id', 'in', `(${excludeTitleIds.slice(-120).join(',')})`)
  }

  const { data: titles } = await titlesQuery.limit(800)
  if (!titles) return []

  const tagsByTitleId = new Map<string, Record<string, unknown>>()
  const titleIds = titles.map((title) => title.id)
  const titleTagRows = await fetchTitleTagsByIds(supabase, [...titleIds, ...signalTitleIds])
  for (const row of titleTagRows) {
    if (row.title_id) {
      tagsByTitleId.set(row.title_id, row.tags as Record<string, unknown>)
    }
  }

  const tasteVector = buildAnonymousTasteVector(signals, tagsByTitleId)
  const scored: Array<{ title: Tables<'titles'>; tags: Record<string, unknown>; score: number }> = []
  for (const title of titles) {
    const tags = tagsByTitleId.get(title.id) ?? {}
    if (moodFilters && Object.keys(moodFilters).length > 0 && !matchesMoodFilters(tags, moodFilters)) continue
    if (eraFilter && eraFilter !== 'all' && tags['era'] !== eraFilter) continue

    const tagVector = buildTagVector(tags)
    const tasteScore = Object.keys(tasteVector).length > 0 ? cosineSimilarity(tasteVector, tagVector) : 0
    const noveltyBoost = signalTitleIds.length > 0 && !signalTitleIds.includes(title.id) ? 0.15 : 0
    const qualityScore = titleQualityScore(title)
    const languageMixBoost = !requestedLanguage
      ? title.language === 'hi' ? 0.08 : title.language === 'gu' ? 0.06 : 0
      : 0
    scored.push({
      title,
      tags,
      score: tasteScore * 0.7 + qualityScore * 0.22 + noveltyBoost + languageMixBoost,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  const top = requestedLanguage
    ? scored.slice(0, limit * 4)
    : interleaveByLanguage(scored, limit * 4)

  const topIds = top.map((item) => item.title.id)
  const { data: streamingRows } = await supabase
    .from('streaming_availability')
    .select('*')
    .in('title_id', topIds)
    .eq('region', region)

  const streamingByTitleId = new Map<string, Tables<'streaming_availability'>[]>()
  for (const row of streamingRows ?? []) {
    if (!row.title_id) continue
    const existing = streamingByTitleId.get(row.title_id) ?? []
    streamingByTitleId.set(row.title_id, [...existing, row])
  }

  let results: RecommendedTitle[] = top.map((item) => ({
    ...item,
    streaming: streamingByTitleId.get(item.title.id) ?? [],
  }))

  if (platformFilter) {
    results = results.filter((result) => result.streaming.some((stream) => stream.platform === platformFilter))
  }

  return results.slice(0, limit)
}

export async function getRecommendations(
  userId: string,
  supabase: SupabaseClient<Database>,
  opts: RecommendOptions = {}
): Promise<RecommendedTitle[]> {
  const {
    limit = 20,
    moodFilters,
    platformFilter,
    eraFilter,
    region = 'IN',
    languageFilter,
    excludeTitleIds = [],
  } = opts
  const excludedIds = new Set(excludeTitleIds)
  const requestedLanguage = languageCode(languageFilter)

  const tasteVector = await getTasteVector(userId, supabase)

  // Get already rated title IDs
  const { data: ratedRows } = await supabase
    .from('ratings')
    .select('title_id, rating')
    .eq('user_id', userId)

  const ratedIds = new Set(ratedRows?.map((r) => r.title_id).filter(Boolean) as string[])

  // Get titles skipped 3+ times (tracked in recommendation_log)
  const { data: logRows } = await supabase
    .from('recommendation_log')
    .select('title_id, action')
    .eq('user_id', userId)
    .eq('action', 'swiped_skip')

  const skipCounts: Record<string, number> = {}
  for (const row of logRows ?? []) {
    if (row.title_id) skipCounts[row.title_id] = (skipCounts[row.title_id] ?? 0) + 1
  }
  const hardSkippedIds = new Set(Object.entries(skipCounts).filter(([, c]) => c >= 3).map(([id]) => id))

  // Fetch candidate titles with tags
  const { data: titleTagRows, error } = await supabase
    .from('title_tags')
    .select('title_id, tags')
    .limit(500)

  if (error || !titleTagRows) return []

  const eligibleTitleIds = titleTagRows
    .map((r) => r.title_id)
    .filter((id): id is string => !!id && !ratedIds.has(id) && !hardSkippedIds.has(id) && !excludedIds.has(id))

  if (eligibleTitleIds.length === 0) return []

  let titlesQuery = supabase
    .from('titles')
    .select('*')
    .in('id', eligibleTitleIds)

  if (requestedLanguage) {
    titlesQuery = titlesQuery.eq('language', requestedLanguage)
  }

  const { data: titles } = await titlesQuery.limit(300)

  if (!titles) return []

  const tagsByTitleId = new Map<string, Record<string, unknown>>()
  for (const row of titleTagRows) {
    if (row.title_id) tagsByTitleId.set(row.title_id, row.tags as Record<string, unknown>)
  }

  // Build candidates + score
  const scored: Array<{ title: Tables<'titles'>; tags: Record<string, unknown>; score: number }> = []

  for (const title of titles) {
    const tags = tagsByTitleId.get(title.id)
    if (!tags) continue

    // Apply mood filters
    if (moodFilters && Object.keys(moodFilters).length > 0) {
      if (!matchesMoodFilters(tags, moodFilters)) continue
    }

    // Apply era filter
    if (eraFilter && tags['era'] !== eraFilter) continue

    const tagVector = buildTagVector(tags)
    const score = Object.keys(tasteVector).length > 0
      ? cosineSimilarity(tasteVector, tagVector)
      : Math.random() * 0.3 + 0.5 // random score for cold-start

    scored.push({ title, tags, score })
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, limit * 3) // fetch more for platform filtering

  // Fetch streaming availability for top candidates
  const topIds = top.map((t) => t.title.id)
  const { data: streamingRows } = await supabase
    .from('streaming_availability')
    .select('*')
    .in('title_id', topIds)
    .eq('region', region)

  const streamingByTitleId = new Map<string, Tables<'streaming_availability'>[]>()
  for (const row of streamingRows ?? []) {
    if (!row.title_id) continue
    const existing = streamingByTitleId.get(row.title_id) ?? []
    streamingByTitleId.set(row.title_id, [...existing, row])
  }

  let results: RecommendedTitle[] = top.map((t) => ({
    ...t,
    streaming: streamingByTitleId.get(t.title.id) ?? [],
  }))

  // Apply platform filter after streaming fetch
  if (platformFilter) {
    results = results.filter((r) => r.streaming.some((s) => s.platform === platformFilter))
  }

  return results.slice(0, limit)
}

// TODO Phase 2: add collaborative filtering layer here
// When user base > 500 active users, add item-based CF:
// - Build item co-rating matrix
// - Find items frequently rated similarly by taste-similar users
// - Weight: 40% collaborative + 60% content-based
