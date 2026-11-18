import type { CSSProperties } from 'react'

// Рисунки тушью из «Бродяги» Такэхико Иноуэ. Файл хранит только тушь — как прозрачность,
// а цвет берётся из темы (--ink): на бумаге рисунок чёрный, ночью светлый. Фона нет вовсе.
const RATIO = {
  'musashi-field': 0.6633,
  'musashi-gaze': 1,
  'blind-sword': 0.7496,
  'otsu-musashi': 1,
  'musashi-prayer': 0.9222,
  otsu: 0.8791,
} as const

export type ArtName = keyof typeof RATIO

interface Props {
  name: ArtName
  className?: string
}

export default function InkArt({ name, className = '' }: Props) {
  const url = `url(/art/${name}.webp)`
  const style = { aspectRatio: RATIO[name], maskImage: url, WebkitMaskImage: url } as CSSProperties
  return <span className={`ink-art ${className}`} style={style} aria-hidden="true" />
}
