import type { Tables } from '@/lib/supabase/types'

interface StreamingPillsProps {
  streaming: Tables<'streaming_availability'>[]
  region?: string
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string }> = {
  'Netflix': { bg: '#E50914', text: '#fff' },
  'Amazon Prime Video': { bg: '#00A8E0', text: '#fff' },
  'Disney+ Hotstar': { bg: '#1E3A8A', text: '#fff' },
  'Zee5': { bg: '#6B21A8', text: '#fff' },
  'SonyLIV': { bg: '#E11D48', text: '#fff' },
  'MX Player': { bg: '#FF4500', text: '#fff' },
  'AltBalaji': { bg: '#E50914', text: '#fff' },
  'Eros Now': { bg: '#FF6B00', text: '#fff' },
  'ShemarooMe': { bg: '#1D4ED8', text: '#fff' },
  'JioHotstar': { bg: '#8B5CF6', text: '#fff' },
}

function shortName(platform: string): string {
  const map: Record<string, string> = {
    'Amazon Prime Video': 'Prime',
    'Disney+ Hotstar': 'Hotstar',
  }
  return map[platform] ?? platform
}

export function StreamingPills({ streaming, region = 'IN' }: StreamingPillsProps) {
  const regional = streaming.filter((s) => s.region === region && s.availability_type === 'flatrate')

  const unique = Array.from(new Map(regional.map((s) => [s.platform, s])).values()).slice(0, 4)

  if (unique.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {unique.map((s) => {
        const colors = PLATFORM_COLORS[s.platform] ?? { bg: '#374151', text: '#fff' }
        return (
          <span
            key={s.platform}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: colors.bg, color: colors.text }}
          >
            {shortName(s.platform)}
          </span>
        )
      })}
    </div>
  )
}
