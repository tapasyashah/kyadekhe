import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-6'

const tagsSchema = z.object({
  era: z.enum(['40s-60s classic', '70s-80s masala', '90s blockbuster', '2000s cool', '2010s new wave', '2020s present']),
  format: z.enum(['theatrical', 'direct-to-OTT', 'web series', 'anthology', 'short film']),
  language_register: z.enum(['Hindi only', 'Hindi-Urdu heavy', 'Hindi-English mix', 'dialect-heavy']),
  emotional_weight: z.enum(['featherlight', 'breezy', 'emotionally engaging', 'heavy', 'devastating']),
  humour_style: z.enum(['none', 'dry wit', 'slapstick', 'absurdist', 'satire', 'dark comedy']),
  romance_type: z.enum(['none', 'subplot', 'central', 'melodramatic', 'grounded', 'slow burn']),
  family_dynamics: z.enum(['absent', 'present', 'central conflict', 'warm family drama']),
  attention_required: z.enum(['background-able', 'half-attentive', 'full focus required', 'rewatch reveals more']),
  watch_with: z.enum(['alone', 'with partner', 'with family', 'with friends', 'with parents specifically']),
  rewatch_value: z.enum(['low', 'moderate', 'high', 'classic-tier']),
  runtime_feel: z.enum(['breezy for length', 'felt right', 'drags at points']),
  writing_quality: z.enum(['weak', 'functional', 'strong', 'exceptional']),
  direction_style: z.enum(['conventional', 'stylised', 'auteur', 'experimental']),
  performance_driven: z.boolean(),
  music_centrality: z.enum(['incidental', 'present', 'prominent', 'the film IS the music']),
  spectacle_factor: z.enum(['none', 'some', 'high', 'pure spectacle']),
  setting: z.enum(['urban metro', 'small town', 'rural', 'NRI/diaspora', 'period/historical', 'fantasy']),
  class_lens: z.enum(['working class', 'middle class', 'upper class', 'cross-class tension']),
  social_commentary: z.enum(['none', 'light', 'moderate', 'the point of the film']),
  nostalgia_trigger: z.enum(['none', 'mild', 'high nostalgia value for Indian audience']),
  spiritual_siblings: z.array(z.string()),
  director_signature: z.string(),
  star_vehicle: z.boolean(),
})

export type TitleTags = z.infer<typeof tagsSchema>

export interface TitleTagInput {
  title: string
  year: number | null
  director: string[]
  top_cast: string[]
  overview: string | null
  imdb_rating: number | null
  vote_count: number | null
  genres: string[]
}

function buildTaggingPrompt(input: TitleTagInput): string {
  return `You are an expert in Hindi cinema with deep knowledge spanning 1940s classics through contemporary OTT originals.
Tag the following film/series across the schema below. Be specific and honest — if a film is weak in writing but strong in performance, say so. Do not default to flattering tags.

Title: ${input.title}
Year: ${input.year ?? 'Unknown'}
Director: ${input.director.join(', ') || 'Unknown'}
Cast: ${input.top_cast.slice(0, 5).join(', ') || 'Unknown'}
Plot: ${input.overview || 'No plot available'}
IMDb Rating: ${input.imdb_rating ?? 'N/A'} (${input.vote_count ?? 0} votes)
Genres: ${input.genres.join(', ') || 'Unknown'}

Return ONLY valid JSON with these exact fields:
- era: one of "40s-60s classic" | "70s-80s masala" | "90s blockbuster" | "2000s cool" | "2010s new wave" | "2020s present"
- format: one of "theatrical" | "direct-to-OTT" | "web series" | "anthology" | "short film"
- language_register: one of "Hindi only" | "Hindi-Urdu heavy" | "Hindi-English mix" | "dialect-heavy"
- emotional_weight: one of "featherlight" | "breezy" | "emotionally engaging" | "heavy" | "devastating"
- humour_style: one of "none" | "dry wit" | "slapstick" | "absurdist" | "satire" | "dark comedy"
- romance_type: one of "none" | "subplot" | "central" | "melodramatic" | "grounded" | "slow burn"
- family_dynamics: one of "absent" | "present" | "central conflict" | "warm family drama"
- attention_required: one of "background-able" | "half-attentive" | "full focus required" | "rewatch reveals more"
- watch_with: one of "alone" | "with partner" | "with family" | "with friends" | "with parents specifically"
- rewatch_value: one of "low" | "moderate" | "high" | "classic-tier"
- runtime_feel: one of "breezy for length" | "felt right" | "drags at points"
- writing_quality: one of "weak" | "functional" | "strong" | "exceptional"
- direction_style: one of "conventional" | "stylised" | "auteur" | "experimental"
- performance_driven: true or false
- music_centrality: one of "incidental" | "present" | "prominent" | "the film IS the music"
- spectacle_factor: one of "none" | "some" | "high" | "pure spectacle"
- setting: one of "urban metro" | "small town" | "rural" | "NRI/diaspora" | "period/historical" | "fantasy"
- class_lens: one of "working class" | "middle class" | "upper class" | "cross-class tension"
- social_commentary: one of "none" | "light" | "moderate" | "the point of the film"
- nostalgia_trigger: one of "none" | "mild" | "high nostalgia value for Indian audience"
- spiritual_siblings: array of 3-5 similar title names
- director_signature: string notes on whether this is consistent with director's body of work
- star_vehicle: true or false`
}

export async function tagTitle(input: TitleTagInput): Promise<TitleTags> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildTaggingPrompt(input) }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON found in Claude response for "${input.title}"`)

  const parsed: unknown = JSON.parse(jsonMatch[0])
  return tagsSchema.parse(parsed)
}

export async function generateWhy(
  candidate: { title: string; year: number | null; tags: Partial<TitleTags> },
  lovedTitles: string[]
): Promise<string> {
  const lovedList = lovedTitles.length > 0 ? lovedTitles.join(', ') : 'various Hindi films'

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `A user loves: ${lovedList}

They are being recommended: ${candidate.title} (${candidate.year ?? 'Unknown year'})
Tags: ${JSON.stringify(candidate.tags, null, 2)}

Write exactly 3 short bullet points (each starting with →) explaining why this person will love this film/series. Be specific, honest, and conversational — like a friend who knows Hindi cinema well. Reference what connects it to what they love. If it has flaws, acknowledge them. Max 15 words per bullet. Return only the 3 bullets, nothing else.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export interface AskQueryResult {
  tagFilters: Record<string, string | string[]>
  explanation: string
}

export async function parseAskQuery(query: string): Promise<AskQueryResult> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are a Hindi cinema expert. A user asked: "${query}"

Map this to tag filters from this schema:
- emotional_weight: featherlight | breezy | emotionally engaging | heavy | devastating
- humour_style: none | dry wit | slapstick | absurdist | satire | dark comedy
- setting: urban metro | small town | rural | NRI/diaspora | period/historical | fantasy
- era: 40s-60s classic | 70s-80s masala | 90s blockbuster | 2000s cool | 2010s new wave | 2020s present
- writing_quality: weak | functional | strong | exceptional
- format: theatrical | direct-to-OTT | web series | anthology | short film
- watch_with: alone | with partner | with family | with friends | with parents specifically
- attention_required: background-able | half-attentive | full focus required | rewatch reveals more
- rewatch_value: low | moderate | high | classic-tier
- social_commentary: none | light | moderate | the point of the film
- romance_type: none | subplot | central | melodramatic | grounded | slow burn

Return JSON with:
{
  "tagFilters": { "field": "value" or "field": ["value1", "value2"] },
  "explanation": "One sentence explaining how you interpreted the request"
}

Only include fields that are clearly implied. Return only the JSON.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { tagFilters: {}, explanation: 'Could not parse your query. Showing general recommendations.' }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { tagFilters: Record<string, string | string[]>; explanation: string }
    return parsed
  } catch {
    return { tagFilters: {}, explanation: 'Could not parse your query. Showing general recommendations.' }
  }
}
