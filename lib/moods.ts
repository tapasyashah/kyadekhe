export const MOODS = [
  {
    id: 'sunday-afternoon',
    label: 'Sunday Afternoon',
    emoji: '☀️',
    description: 'Light, breezy, feel-good',
    filters: { emotional_weight: ['featherlight', 'breezy'], attention_required: ['background-able', 'half-attentive'] },
  },
  {
    id: 'need-to-cry',
    label: 'Need to Cry',
    emoji: '😭',
    description: 'Let it all out',
    filters: { emotional_weight: ['heavy', 'devastating'] },
  },
  {
    id: 'light-funny',
    label: 'Light & Funny',
    emoji: '😂',
    description: 'Just laughs',
    filters: { emotional_weight: ['featherlight', 'breezy'], humour_style: ['slapstick', 'absurdist', 'dry wit'] },
  },
  {
    id: 'something-intense',
    label: 'Something Intense',
    emoji: '🔥',
    description: 'Edge of your seat',
    filters: { emotional_weight: ['heavy', 'devastating'], attention_required: ['full focus required'] },
  },
  {
    id: 'family-watch',
    label: 'Family Watch',
    emoji: '👨‍👩‍👧',
    description: 'Safe for everyone',
    filters: { watch_with: ['with family', 'with parents specifically'] },
  },
  {
    id: 'late-night',
    label: 'Late Night Alone',
    emoji: '🌙',
    description: 'Just you and the screen',
    filters: { watch_with: ['alone'], attention_required: ['full focus required', 'rewatch reveals more'] },
  },
  {
    id: 'nri-feelings',
    label: 'NRI Feelings',
    emoji: '✈️',
    description: 'Diaspora stories',
    filters: { setting: ['NRI/diaspora'] },
  },
  {
    id: 'nostalgia',
    label: 'Nostalgia Trip',
    emoji: '📼',
    description: 'Classic Bollywood vibes',
    filters: { nostalgia_trigger: ['high nostalgia value for Indian audience'], era: ['70s-80s masala', '90s blockbuster'] },
  },
] as const

export type MoodId = typeof MOODS[number]['id']
export type Mood = typeof MOODS[number]
