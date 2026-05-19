import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/types'

async function main(): Promise<void> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tags, error } = await supabase
    .from('title_tags')
    .select('title_id, tags')
    .limit(10)

  if (error || !tags) {
    console.error('Failed to fetch tags:', error?.message)
    process.exit(1)
  }

  const titleIds = tags.map((t) => t.title_id).filter(Boolean) as string[]

  const { data: titles } = await supabase
    .from('titles')
    .select('id, title, year')
    .in('id', titleIds)

  const titleMap = new Map((titles ?? []).map((t) => [t.id, t]))

  console.log('=== KyaDekhe Tag Validation (10 random) ===\n')

  for (const tag of tags) {
    const title = tag.title_id ? titleMap.get(tag.title_id) : null
    console.log(`📽️  ${title?.title ?? 'Unknown'} (${title?.year ?? '?'})`)
    console.log(JSON.stringify(tag.tags, null, 2))
    console.log('---')
  }

  const { count } = await supabase
    .from('title_tags')
    .select('*', { count: 'exact', head: true })

  const { count: titleCount } = await supabase
    .from('titles')
    .select('*', { count: 'exact', head: true })

  console.log(`\nTotal titles: ${titleCount}`)
  console.log(`Total tagged: ${count}`)
  console.log(`Untagged: ${(titleCount ?? 0) - (count ?? 0)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
