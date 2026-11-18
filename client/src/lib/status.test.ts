import { plural, posterOf } from './status'

describe('posterOf', () => {
  const anime = { images: { jpg: { image_url: 'small.jpg', large_image_url: 'large.jpg' } } }

  it('prefers the large image only when asked', () => {
    expect(posterOf(anime)).toBe('small.jpg')
    expect(posterOf(anime, true)).toBe('large.jpg')
  })

  it('falls back to the small image and handles missing data', () => {
    expect(posterOf({ images: { jpg: { image_url: 'small.jpg' } } }, true)).toBe('small.jpg')
    expect(posterOf(undefined)).toBeUndefined()
  })
})

describe('plural', () => {
  it('picks singular for exactly one', () => {
    expect(plural(1, 'episode')).toBe('1 episode')
    expect(plural(0, 'episode')).toBe('0 episodes')
    expect(plural(12, 'title')).toBe('12 titles')
  })
})
