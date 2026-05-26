'use client'

import type { Tables } from '@/lib/supabase/types'

export type GuestRating = 'not_watched' | 'disliked' | 'liked' | 'loved'
export type GuestRecommendationDecision = 'not_interested' | 'maybe_later' | 'watch_tonight'

export interface GuestTasteEntry {
  titleId: string
  rating: GuestRating
  ratedAt: string
}

export interface GuestSavedTitle {
  title: Tables<'titles'>
  savedAt: string
}

export interface GuestRecommendationDecisionEntry {
  title: Tables<'titles'>
  decision: GuestRecommendationDecision
  decidedAt: string
}

const TASTE_STORAGE_KEY = 'kyadekhe_guest_taste_v1'
const SAVED_STORAGE_KEY = 'kyadekhe_guest_saved_v1'
const RECOMMENDATION_DECISION_STORAGE_KEY = 'kyadekhe_guest_recommendation_decisions_v1'

function normalizeGuestRating(value: unknown): GuestRating | null {
  if (value === 'loved' || value === 'liked' || value === 'disliked' || value === 'not_watched') return value
  if (value === 'skip') return 'disliked'
  if (value === 'havent_seen') return 'not_watched'
  return null
}

function isGuestRecommendationDecision(value: unknown): value is GuestRecommendationDecision {
  return value === 'not_interested' || value === 'maybe_later' || value === 'watch_tonight'
}

export function readGuestTaste(): GuestTasteEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(TASTE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((entry): GuestTasteEntry[] => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        typeof (entry as GuestTasteEntry).titleId !== 'string' ||
        typeof (entry as GuestTasteEntry).ratedAt !== 'string'
      ) return []

      const rating = normalizeGuestRating((entry as GuestTasteEntry).rating)
      if (!rating) return []

      return [{
        titleId: (entry as GuestTasteEntry).titleId,
        rating,
        ratedAt: (entry as GuestTasteEntry).ratedAt,
      }]
    })
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
    not_watched: [],
    disliked: [],
    loved: [],
    liked: [],
  }

  for (const entry of entries) {
    byRating[entry.rating].push(entry.titleId)
  }

  return byRating
}

export function countTasteSignals(entries = readGuestTaste()) {
  return entries.filter((entry) => entry.rating === 'disliked' || entry.rating === 'liked' || entry.rating === 'loved').length
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

export function readGuestRecommendationDecisions(): GuestRecommendationDecisionEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_DECISION_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((entry): entry is GuestRecommendationDecisionEntry => (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as GuestRecommendationDecisionEntry).decidedAt === 'string' &&
      isGuestRecommendationDecision((entry as GuestRecommendationDecisionEntry).decision) &&
      typeof (entry as GuestRecommendationDecisionEntry).title === 'object' &&
      (entry as GuestRecommendationDecisionEntry).title !== null &&
      typeof (entry as GuestRecommendationDecisionEntry).title.id === 'string' &&
      typeof (entry as GuestRecommendationDecisionEntry).title.title === 'string'
    ))
  } catch {
    return []
  }
}

export function writeGuestRecommendationDecisions(entries: GuestRecommendationDecisionEntry[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(RECOMMENDATION_DECISION_STORAGE_KEY, JSON.stringify(entries.slice(-150)))
}

export function decideGuestRecommendation(
  title: Tables<'titles'>,
  decision: GuestRecommendationDecision
): GuestRecommendationDecisionEntry[] {
  const next = [
    { title, decision, decidedAt: new Date().toISOString() },
    ...readGuestRecommendationDecisions().filter((entry) => entry.title.id !== title.id),
  ]
  writeGuestRecommendationDecisions(next)
  if (decision === 'maybe_later' || decision === 'watch_tonight') saveGuestTitle(title)
  return next
}
