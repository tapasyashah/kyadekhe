'use client'

import type { Tables } from '@/lib/supabase/types'

export type GuestRating = 'loved' | 'liked' | 'skip'

export interface GuestTasteEntry {
  titleId: string
  rating: GuestRating
  ratedAt: string
}

export interface GuestSavedTitle {
  title: Tables<'titles'>
  savedAt: string
}

const TASTE_STORAGE_KEY = 'kyadekhe_guest_taste_v1'
const SAVED_STORAGE_KEY = 'kyadekhe_guest_saved_v1'

function isGuestRating(value: unknown): value is GuestRating {
  return value === 'loved' || value === 'liked' || value === 'skip'
}

export function readGuestTaste(): GuestTasteEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(TASTE_STORAGE_KEY)
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
  window.localStorage.setItem(TASTE_STORAGE_KEY, JSON.stringify(entries.slice(-250)))
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

export function readGuestSavedTitles(): GuestSavedTitle[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(SAVED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((entry): entry is GuestSavedTitle => (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as GuestSavedTitle).savedAt === 'string' &&
      typeof (entry as GuestSavedTitle).title === 'object' &&
      (entry as GuestSavedTitle).title !== null &&
      typeof (entry as GuestSavedTitle).title.id === 'string' &&
      typeof (entry as GuestSavedTitle).title.title === 'string'
    ))
  } catch {
    return []
  }
}

export function writeGuestSavedTitles(entries: GuestSavedTitle[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(entries.slice(-100)))
}

export function saveGuestTitle(title: Tables<'titles'>): GuestSavedTitle[] {
  const next = [
    { title, savedAt: new Date().toISOString() },
    ...readGuestSavedTitles().filter((entry) => entry.title.id !== title.id),
  ]
  writeGuestSavedTitles(next)
  return next
}

export function removeGuestSavedTitle(titleId: string): GuestSavedTitle[] {
  const next = readGuestSavedTitles().filter((entry) => entry.title.id !== titleId)
  writeGuestSavedTitles(next)
  return next
}
