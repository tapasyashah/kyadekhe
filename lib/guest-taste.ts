'use client'

export type GuestRating = 'loved' | 'liked' | 'skip'

export interface GuestTasteEntry {
  titleId: string
  rating: GuestRating
  ratedAt: string
}

const STORAGE_KEY = 'kyadekhe_guest_taste_v1'

function isGuestRating(value: unknown): value is GuestRating {
  return value === 'loved' || value === 'liked' || value === 'skip'
}

export function readGuestTaste(): GuestTasteEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((entry): entry is GuestTasteEntry => (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as GuestTasteEntry).titleId === 'string' &&
      typeof (entry as GuestTasteEntry).ratedAt === 'string' &&
      isGuestRating((entry as GuestTasteEntry).rating)
    ))
  } catch {
    return []
  }
}

export function writeGuestTaste(entries: GuestTasteEntry[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-250)))
}

export function rateGuestTitle(titleId: string, rating: GuestRating): GuestTasteEntry[] {
  const next = [
    ...readGuestTaste().filter((entry) => entry.titleId !== titleId),
    { titleId, rating, ratedAt: new Date().toISOString() },
  ]
  writeGuestTaste(next)
  return next
}

export function encodeGuestTaste(entries = readGuestTaste()) {
  const byRating: Record<GuestRating, string[]> = {
    loved: [],
    liked: [],
    skip: [],
  }

  for (const entry of entries) {
    byRating[entry.rating].push(entry.titleId)
  }

  return byRating
}
