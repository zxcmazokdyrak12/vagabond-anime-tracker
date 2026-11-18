// Мок каталога AniList для E2E: сервер трекера ходит сюда вместо graphql.anilist.co.
// Отдаёт несколько тайтлов, расписание и рекомендации, постеры рисует SVG.
import http from 'node:http'

const PORT = Number(process.env.MOCK_PORT) || 4010
const BASE = `http://localhost:${PORT}`

const poster = (id) => `${BASE}/poster/${id}.svg`
const media = (idMal, romaji, english, extra = {}) => ({
  id: 1000 + idMal,
  idMal,
  title: { romaji, english, native: null },
  coverImage: { large: poster(idMal), extraLarge: poster(idMal), medium: poster(idMal) },
  description: `${english ?? romaji}: a wandering swordsman story.`,
  episodes: 12,
  duration: 24,
  averageScore: 88,
  popularity: 400000,
  seasonYear: 2024,
  format: 'TV',
  status: 'FINISHED',
  source: 'MANGA',
  genres: ['Action', 'Drama'],
  studios: { nodes: [{ name: 'MADHOUSE' }] },
  rankings: [{ rank: idMal % 50, type: 'RATED', allTime: true }],
  trailer: null,
  startDate: { year: 2024, month: 1, day: 5 },
  endDate: { year: 2024, month: 3, day: 22 },
  nextAiringEpisode: null,
  characters: { edges: [] },
  streamingEpisodes: [],
  ...extra,
})

const FRIEREN = media(52991, 'Sousou no Frieren', 'Frieren', { episodes: 28 })
const TOP = [
  FRIEREN,
  media(5114, 'Hagane no Renkinjutsushi: FULLMETAL ALCHEMIST', 'Fullmetal Alchemist: Brotherhood', { episodes: 64 }),
  media(9253, 'Steins;Gate', 'Steins;Gate', { episodes: 24 }),
  media(1, 'Cowboy Bebop', 'Cowboy Bebop', { episodes: 26 }),
]
const AIRING = media(59978, 'Ronin Season', 'Ronin Season', { status: 'RELEASING', episodes: 12 })
const ALL = [...TOP, AIRING]

function answer(query, variables = {}) {
  const now = Math.floor(Date.now() / 1000)
  if (query.includes('Media(idMal')) {
    const found = ALL.find((m) => m.idMal === variables.idMal)
    return found ? { data: { Media: found } } : [404, { errors: [{ message: 'Not Found.' }] }]
  }
  if (query.includes('airingSchedules(')) return { data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } } }
  if (query.includes('notYetAired: true')) {
    return {
      data: {
        Page: {
          media: [{ ...AIRING, airingSchedule: { nodes: [{ episode: 5, airingAt: now + 2 * 86400 }] } }],
        },
      },
    }
  }
  if (query.includes('recommendations(sort')) {
    const ids = variables.ids ?? []
    return {
      data: {
        Page: {
          media: TOP.filter((m) => ids.includes(m.idMal)).map((m) => ({
            idMal: m.idMal,
            title: m.title,
            recommendations: {
              nodes: [{ rating: 200, mediaRecommendation: { ...TOP[3], isAdult: false } }],
            },
          })),
        },
      },
    }
  }
  if (query.includes('idMal_in')) {
    const ids = variables.ids ?? []
    return { data: { Page: { media: ids.map((id) => ({ idMal: id, coverImage: { large: poster(id) }, episodes: 12 })) } } }
  }
  if (query.includes('$search')) {
    const q = String(variables.search ?? '').toLowerCase()
    return { data: { Page: { media: ALL.filter((m) => JSON.stringify(m.title).toLowerCase().includes(q)) } } }
  }
  if (query.includes('SCORE_DESC')) return { data: { Page: { media: TOP } } }
  if (query.includes('seasonYear')) return { data: { Page: { media: [AIRING] } } }
  return [400, { errors: [{ message: 'Unknown query in mock' }] }]
}

const svg = (id) => `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="650" viewBox="0 0 46 65">
<rect width="46" height="65" fill="#d8d2c4"/><circle cx="23" cy="28" r="12" fill="none" stroke="#1b1a17" stroke-width="3"/>
<text x="23" y="58" font-size="7" text-anchor="middle" fill="#1b1a17">${id}</text></svg>`

http
  .createServer((req, res) => {
    if (req.method === 'GET' && req.url?.startsWith('/poster/')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*' })
      return res.end(svg(req.url.split('/').pop()?.replace('.svg', '')))
    }
    if (req.method === 'GET' && req.url === '/health') return res.end('ok')
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let out
      try {
        const { query, variables } = JSON.parse(body || '{}')
        out = answer(String(query ?? ''), variables)
      } catch {
        out = [400, { errors: [{ message: 'Bad JSON' }] }]
      }
      const [status, payload] = Array.isArray(out) ? out : [200, out]
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload))
    })
  })
  .listen(PORT, () => console.log(`Mock catalogue on ${BASE}`))
