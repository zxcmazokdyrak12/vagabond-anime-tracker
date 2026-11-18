import { STATUSES, STATUS_KEYS } from './status'
import type { ListEntry, Stats } from '../types'
import { plural, pluralWord, t } from './i18n'

export const CARD_W = 1080
export const CARD_H = 1350

interface CardData {
  username: string
  stats: Stats
  favourites: Pick<ListEntry, 'title' | 'score'>[]
  hours: number
  url: string
}

/** Цвета берём из CSS-переменных текущей темы — карточка такая же, как экран */
function palette() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    paper: v('--paper', '#e2ded4'),
    deep: v('--paper-deep', '#d5d0c3'),
    ink: v('--ink', '#1b1a17'),
    wash: v('--wash', '#625e56'),
    line: v('--line', '#bab4a7'),
    seal: v('--seal', '#a8321e'),
    ai: v('--ai', '#2e3d5c'),
  }
}

const BRUSH = '"Yuji Boku", "Shippori Mincho B1", serif'
const TEXT = '"Shippori Mincho B1", "Yu Mincho", serif'

/** Мазок кисти: сужающаяся полоса с неровным краем */
function brushStroke(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y)
  const steps = 40
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    ctx.lineTo(x + w * t, y - (9 * (1 - t) + 1.5) + Math.sin(i * 1.7) * 1.2)
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps
    ctx.lineTo(x + w * t, y + (9 * (1 - t) + 1.5) + Math.cos(i * 1.3) * 1.2)
  }
  ctx.closePath()
  ctx.fill()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

export async function drawPathCard(canvas: HTMLCanvasElement, data: CardData) {
  // Кистевой шрифт подгружается по требованию — ждём, иначе canvas нарисует запасной
  await Promise.all([
    document.fonts.load(`120px ${BRUSH}`, '観完計棄武'),
    document.fonts.load(`800 64px ${TEXT}`, data.username),
    document.fonts.load(`400 32px ${TEXT}`, 'Aa'),
  ]).catch(() => {})

  const c = palette()
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return // нет canvas (старый браузер, тесты)
  const pad = 96

  // Бумага с волокнами
  ctx.fillStyle = c.paper
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  ctx.globalAlpha = 0.07
  ctx.fillStyle = c.ink
  for (let i = 0; i < 2600; i++) ctx.fillRect(rand() * CARD_W, rand() * CARD_H, rand() * 2 + 0.5, rand() * 2 + 0.5)
  ctx.globalAlpha = 1

  // Печать и подпись
  ctx.save()
  ctx.translate(pad + 44, pad + 44)
  ctx.rotate(-0.05)
  ctx.fillStyle = c.seal
  ctx.beginPath()
  ctx.roundRect(-44, -44, 88, 88, 10)
  ctx.fill()
  ctx.fillStyle = c.paper
  ctx.font = `60px ${BRUSH}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('武', 0, 4)
  ctx.restore()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = c.wash
  ctx.font = `400 30px ${TEXT}`
  ctx.fillText('Vagabond Tracker', pad + 116, pad + 34)
  ctx.fillText(t('The path so far'), pad + 116, pad + 76)

  ctx.fillStyle = c.ink
  ctx.font = `800 92px ${TEXT}`
  ctx.fillText(fitText(ctx, data.username, CARD_W - pad * 2), pad, pad + 230)
  brushStroke(ctx, pad, pad + 272, CARD_W - pad * 2, c.ink)

  // Четыре иероглифа со счётчиками
  const colW = (CARD_W - pad * 2) / 4
  const colors = { watching: c.ai, completed: c.ink, planning: c.wash, dropped: c.seal }
  STATUS_KEYS.forEach((k, i) => {
    const x = pad + colW * i
    ctx.fillStyle = colors[k]
    ctx.font = `150px ${BRUSH}`
    ctx.fillText(STATUSES[k].glyph, x - 6, pad + 500)
    ctx.fillStyle = c.ink
    ctx.font = `800 72px ${TEXT}`
    ctx.fillText(String(data.stats[k] ?? 0), x, pad + 600)
    ctx.fillStyle = c.wash
    ctx.font = `400 28px ${TEXT}`
    ctx.fillText(t(STATUSES[k].label), x, pad + 642)
  })

  // Итоги
  ctx.fillStyle = c.ink
  ctx.font = `400 40px ${TEXT}`
  const line1 = t('{episodes}, about {hours} on the road.', {
    episodes: `${data.stats.total_episodes} ${pluralWord(data.stats.total_episodes, 'episode')}`,
    hours: plural(data.hours, 'hour'),
  })
  ctx.fillText(fitText(ctx, line1, CARD_W - pad * 2), pad, pad + 760)
  if (data.stats.avg_score) ctx.fillText(t('Average score {n}.', { n: data.stats.avg_score }), pad, pad + 814)

  // Любимое
  if (data.favourites.length) {
    ctx.fillStyle = c.wash
    ctx.font = `400 28px ${TEXT}`
    ctx.fillText(t('Highest rated'), pad, pad + 912)
    ctx.fillStyle = c.ink
    ctx.font = `600 36px ${TEXT}`
    data.favourites.slice(0, 3).forEach((f, i) => {
      const y = pad + 966 + i * 54
      ctx.fillText(fitText(ctx, f.title, CARD_W - pad * 2 - 90), pad, y)
      ctx.textAlign = 'right'
      ctx.fillText(String(f.score ?? ''), CARD_W - pad, y)
      ctx.textAlign = 'left'
    })
  }

  ctx.fillStyle = c.wash
  ctx.font = `400 26px ${TEXT}`
  ctx.fillText(data.url.replace(/^https?:\/\//, ''), pad, CARD_H - pad + 20)
}

export const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty'))), 'image/png'))
