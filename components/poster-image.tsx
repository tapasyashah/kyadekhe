import Image from 'next/image'
import type { Tables } from '@/lib/supabase/types'
import { posterSrc } from '@/lib/poster'

interface PosterImageProps {
  title: Pick<Tables<'titles'>, 'poster_path' | 'title' | 'year' | 'title_type' | 'language'>
  className?: string
  sizes: string
  priority?: boolean
}

export function PosterImage({ title, className, sizes, priority = false }: PosterImageProps) {
  return (
    <Image
      src={posterSrc(title)}
      alt={title.title}
      fill
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized={!title.poster_path}
      draggable={false}
    />
  )
}
