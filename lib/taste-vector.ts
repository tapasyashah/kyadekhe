import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { createHash } from 'crypto'

const RATING_WEIGHTS: Record<string, number> = {
  loved: 3,
  liked: 1,
  meh: -0.5,
  disliked: -2,
  havent_seen: 0,
  skip: 0,
}

const TAG_FIELDS = [
  'era', 'format', 'language_register', 'emotional_weight', 'humour_style',
  'romance_type', 'family_dynamics', 'attention_required', 'watch_with',
  'rewatch_value', 'runtime_feel', 'writing_quality', 'direction_style',
  'music_centrality', 'spectacle_factor', 'setting', 'class_lens',
  'social_commentary', 'nostalgia_trigger',
]

function getServiceClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function computeTasteVector(
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<Record<string, number>> {
  const { data: ratings, error } = await supabase
    .from('ratings')
    .select('rating, title_id')
    .eq('user_id', userId)
    .in('rating', ['loved', 'liked', 'meh', 'disliked'])

  if (error) throw new Error(`Failed to fetch ratings: ${error.message}`)
  if (!ratings || ratings.length === 0) return {}

  const titleIds = ratings.map((r) => r.title_id).filter(Boolean) as string[]

  const { data: tags, error: tagsError } = await supabase
    .from('title_tags')
    .select('title_id, tags')
    .in('title_id', titleIds)

  if (tagsError) throw new Error(`Failed to fetch tags: ${tagsError.message}`)

  const tagsByTitleId = new Map<string, Record<string, unknown>>()
  for (const t of tags ?? []) {
    if (t.title_id) tagsByTitleId.set(t.title_id, t.tags as Record<string, unknown>)
  }

  const vector: Record<string, number> = {}
  const counts: Record<string, number> = {}

  for (const rating of ratings) {
    if (!rating.title_id) continue
    const titleTags = tagsByTitleId.get(rating.title_id)
    if (!titleTags) continue

    const weight = RATING_WEIGHTS[rating.rating] ?? 0
    if (weight === 0) continue

    for (const field of TAG_FIELDS) {
      const value = titleTags[field]
      if (typeof value !== 'string') continue

      const key = `${field}:${value}`
      vector[key] = (vector[key] ?? 0) + weight
      counts[key] = (counts[key] ?? 0) + 1
    }
  }

  // Normalise to [-1, 1]
  const maxAbs = Math.max(1, ...Object.values(vector).map(Math.abs))
  const normalised: Record<string, number> = {}
  for (const [key, val] of Object.entries(vector)) {
    normalised[key] = val / maxAbs
  }

  const { error: upsertError } = await supabase.from('user_taste_vectors').upsert({
    user_id: userId,
    vector: normalised,
    computed_at: new Date().toISOString(),
    rating_count: ratings.length,
  })

  if (upsertError) throw new Error(`Failed to upsert taste vector: ${upsertError.message}`)

  return normalised
}

export async function getTasteVector(
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('user_taste_vectors')
    .select('vector, computed_at, rating_count')
    .eq('user_id', userId)
    .single()

  if (!data) return computeTasteVector(userId, supabase)

  const { data: latestRating } = await supabase
    .from('ratings')
    .select('rated_at')
    .eq('user_id', userId)
    .order('rated_at', { ascending: false })
    .limit(1)
    .single()

  const vectorAge = new Date(data.computed_at)
  const latestRatingTime = latestRating ? new Date(latestRating.rated_at) : vectorAge

  // Recompute if vector is stale (newer ratings exist)
  if (latestRatingTime > vectorAge) {
    return computeTasteVector(userId, supabase)
  }

  return data.vector as Record<string, number>
}

export function tasteClusterKey(vector: Record<string, number>): string {
  const topEntries = Object.entries(vector)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 5)
    .map(([k, v]) => `${k}=${v.toFixed(2)}`)
    .join(',')

  return createHash('sha256').update(topEntries).digest('hex').slice(0, 8)
}
