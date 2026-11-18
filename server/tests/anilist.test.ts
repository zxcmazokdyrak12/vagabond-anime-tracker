import { describe, expect, it } from 'vitest'
import { cleanDescription, currentSeason } from '../src/lib/anilist.js'

describe('anilist helpers', () => {
  it('picks the AniList season by month', () => {
    expect(currentSeason(new Date('2026-01-15'))).toEqual({ season: 'WINTER', year: 2026 })
    expect(currentSeason(new Date('2026-05-01'))).toEqual({ season: 'SPRING', year: 2026 })
    expect(currentSeason(new Date('2026-08-31'))).toEqual({ season: 'SUMMER', year: 2026 })
    expect(currentSeason(new Date('2026-11-18'))).toEqual({ season: 'FALL', year: 2026 })
  })

  it('turns AniList HTML descriptions into plain text', () => {
    expect(cleanDescription('A <b>bold</b> &amp; <i>quiet</i> tale.<br><br><br><br>(Source: Crunchyroll)')).toBe(
      'A bold & quiet tale.\n\n(Source: Crunchyroll)'
    )
    expect(cleanDescription(null)).toBeNull()
  })
})
