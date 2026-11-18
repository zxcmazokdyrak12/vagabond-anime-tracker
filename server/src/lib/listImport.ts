import type { Status } from './validation.js'

export interface ImportedEntry {
  anime_id: number
  title: string
  episodes: number | null
  status: Status
  score: number | null
  watched_episodes: number
  started_at: string | null
  finished_at: string | null
  rewatch_count: number
  notes: string | null
}

export class ImportFormatError extends Error {}

// «Отложено» (On-Hold) — тайтл начат, поэтому считаем его «смотрю»
const MAL_STATUS: Record<string, Status> = {
  watching: 'watching',
  '1': 'watching',
  completed: 'completed',
  '2': 'completed',
  'on-hold': 'watching',
  '3': 'watching',
  dropped: 'dropped',
  '4': 'dropped',
  'plan to watch': 'planning',
  '6': 'planning',
}

const SHIKI_STATUS: Record<string, Status> = {
  watching: 'watching',
  rewatching: 'watching',
  on_hold: 'watching',
  completed: 'completed',
  planned: 'planning',
  dropped: 'dropped',
}

const decode = (s: string) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? decode(m[1]!) : ''
}

/** MAL пишет неизвестную дату как 0000-00-00, а неполную — как 2019-00-00 */
const malDate = (s: string) => (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) && !s.startsWith('0000') ? s : null)

const int = (s: unknown) => {
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

const clampScore = (n: number) => (n >= 1 && n <= 10 ? n : null)

const finish = (e: Omit<ImportedEntry, 'watched_episodes'> & { watched_episodes: number }): ImportedEntry => ({
  ...e,
  title: e.title.slice(0, 500) || `#${e.anime_id}`,
  watched_episodes: e.episodes ? Math.min(e.watched_episodes, e.episodes) : e.watched_episodes,
  notes: e.notes ? e.notes.slice(0, 2000) : null,
  rewatch_count: Math.min(e.rewatch_count, 999),
})

/** XML-выгрузка MyAnimeList (и Шикимори в формате MAL) */
function parseMalXml(xml: string): ImportedEntry[] {
  const blocks = xml.match(/<anime>[\s\S]*?<\/anime>/g) ?? []
  const out: ImportedEntry[] = []
  for (const block of blocks) {
    const anime_id = int(tag(block, 'series_animedb_id'))
    const status = MAL_STATUS[tag(block, 'my_status').toLowerCase()]
    if (!anime_id || !status) continue
    const episodes = int(tag(block, 'series_episodes')) || null
    out.push(
      finish({
        anime_id,
        title: tag(block, 'series_title'),
        episodes,
        status,
        score: clampScore(int(tag(block, 'my_score'))),
        watched_episodes: int(tag(block, 'my_watched_episodes')),
        started_at: malDate(tag(block, 'my_start_date')),
        finished_at: malDate(tag(block, 'my_finish_date')),
        rewatch_count: int(tag(block, 'my_times_watched')),
        notes: tag(block, 'my_comments') || null,
      })
    )
  }
  return out
}

interface ShikiRow {
  target_id?: unknown
  target_title?: unknown
  target_type?: unknown
  status?: unknown
  score?: unknown
  episodes?: unknown
  rewatches?: unknown
  text?: unknown
}

/** JSON-выгрузка Шикимори: id в ней совпадают с MyAnimeList */
function parseShikimoriJson(json: string): ImportedEntry[] {
  let rows: unknown
  try {
    rows = JSON.parse(json)
  } catch {
    throw new ImportFormatError('The file looks like JSON but could not be read')
  }
  if (!Array.isArray(rows)) throw new ImportFormatError('Expected a list of titles')
  const out: ImportedEntry[] = []
  for (const r of rows as ShikiRow[]) {
    if (r.target_type && r.target_type !== 'Anime') continue
    const anime_id = int(r.target_id)
    const status = SHIKI_STATUS[String(r.status)]
    if (!anime_id || !status) continue
    out.push(
      finish({
        anime_id,
        title: String(r.target_title ?? ''),
        episodes: null,
        status,
        score: clampScore(int(r.score)),
        watched_episodes: int(r.episodes),
        started_at: null,
        finished_at: null,
        rewatch_count: int(r.rewatches),
        notes: typeof r.text === 'string' && r.text.trim() ? r.text.trim() : null,
      })
    )
  }
  return out
}

export const MAX_IMPORT = 5000

export function parseListExport(text: string): ImportedEntry[] {
  const trimmed = text.trim()
  let entries: ImportedEntry[]
  if (trimmed.startsWith('[')) entries = parseShikimoriJson(trimmed)
  else if (trimmed.includes('<myanimelist') || trimmed.includes('<anime>')) entries = parseMalXml(trimmed)
  else throw new ImportFormatError('This is not a MyAnimeList or Shikimori export')

  // Дубли внутри файла: последняя запись выигрывает
  const unique = [...new Map(entries.map((e) => [e.anime_id, e])).values()]
  if (!unique.length) throw new ImportFormatError('No anime found in the file')
  if (unique.length > MAX_IMPORT) throw new ImportFormatError(`At most ${MAX_IMPORT} titles per import`)
  return unique
}
