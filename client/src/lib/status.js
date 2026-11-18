// Состояния свитка: иероглиф, подпись и CSS-модификатор цвета
export const STATUSES = {
  watching:  { glyph: '観', label: 'Watching' },
  completed: { glyph: '完', label: 'Completed' },
  planning:  { glyph: '計', label: 'Planning' },
  dropped:   { glyph: '棄', label: 'Dropped' },
}

export const STATUS_KEYS = Object.keys(STATUSES)

// Картинка из ответа Jikan/AniList в любом из форматов
export const posterOf = (anime, large = false) =>
  (large && anime?.images?.jpg?.large_image_url) || anime?.images?.jpg?.image_url || anime?.image
