import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../src/app.js'
import type { Db } from '../src/db.js'
import { runMigrations } from '../src/migrate.js'
import type { SendPush } from '../src/lib/notifier.js'
import { readdirSync } from 'node:fs'
import { JWT_SECRET, fakeHttp, freshDb } from './helpers.js'

const ALL_MIGRATIONS = readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort()

const media = (idMal: number | null, romaji: string, extra: object = {}) => ({
  id: 1000 + (idMal ?? 0),
  idMal,
  title: { romaji, english: null, native: null },
  coverImage: { large: `${romaji}.jpg`, extraLarge: null },
  description: 'An <i>elf</i> mage.<br><br>She outlives everyone&#039;s party.',
  episodes: 28,
  duration: 24,
  averageScore: 90,
  popularity: 500000,
  seasonYear: 2023,
  format: 'TV',
  status: 'FINISHED',
  source: 'MANGA',
  genres: ['Adventure', 'Drama'],
  studios: { nodes: [{ name: 'MADHOUSE' }] },
  rankings: [{ rank: 1, type: 'RATED', allTime: true }],
  trailer: { id: 'abc123', site: 'youtube' },
  startDate: { year: 2023, month: 9, day: 29 },
  endDate: { year: 2024, month: 3, day: 22 },
  nextAiringEpisode: null,
  ...extra,
})

const FRIEREN = media(52991, 'Sousou no Frieren', {
  title: { romaji: 'Sousou no Frieren', english: 'Frieren', native: '葬送のフリーレン' },
  characters: {
    edges: [
      { role: 'MAIN', node: { id: 1, name: { full: 'Frieren' }, image: { medium: 'f.png' } }, voiceActors: [{ name: { full: 'Atsumi Tanezaki' } }] },
    ],
  },
  streamingEpisodes: [{ title: 'Episode 2 - It Didn’t Have to Be Magic...' }, { title: "Episode 1 - The Journey's End" }],
  airingSchedule: { nodes: [{ episode: 1, airingAt: 1695945600 }] },
})

let db: Db
let app: Express
let anilistDown = false
const upstream = fakeHttp([
  [
    /anilist/,
    (_url, body) => {
      if (anilistDown) return { status: 0, data: null }
      const { query, variables } = body as { query: string; variables?: { idMal?: number; ids?: number[] } }
      if (query.includes('Media(idMal')) {
        return variables?.idMal === 52991
          ? { status: 200, data: { data: { Media: FRIEREN } } }
          : { status: 404, data: { errors: [{ message: 'Not Found.' }] } }
      }
      if (query.includes('airingSchedules(')) {
        const now = Math.floor(Date.now() / 1000)
        return {
          status: 200,
          data: {
            data: {
              Page: {
                pageInfo: { hasNextPage: false },
                airingSchedules: [
                  { episode: 8, airingAt: now - 600, media: { idMal: 52991, title: { romaji: 'Sousou no Frieren', english: 'Frieren' }, coverImage: { medium: 'f.png' } } },
                  { episode: 3, airingAt: now - 900, media: { idMal: 777, title: { romaji: 'Nobody watches', english: null }, coverImage: { medium: null } } },
                ],
              },
            },
          },
        }
      }
      if (query.includes('notYetAired: true')) {
        const now = Math.floor(Date.now() / 1000)
        return {
          status: 200,
          data: {
            data: {
              Page: {
                media: [
                  {
                    idMal: 52991, title: { romaji: 'Sousou no Frieren', english: 'Frieren' }, coverImage: { large: 'f.jpg' }, episodes: 28,
                    airingSchedule: { nodes: [
                      { episode: 8, airingAt: now + 3600 },
                      { episode: 9, airingAt: now + 3600 + 7 * 86400 + 60 }, // за пределами недели
                    ] },
                  },
                ],
              },
            },
          },
        }
      }
      if (query.includes('recommendations(sort')) {
        const rec = (idMal: number, romaji: string, extra = {}) => ({
          idMal, isAdult: false, format: 'TV', episodes: 12, averageScore: 80,
          title: { romaji, english: null }, coverImage: { large: `${romaji}.jpg` }, ...extra,
        })
        return {
          status: 200,
          data: {
            data: {
              Page: {
                media: [
                  { idMal: 1, title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop' }, recommendations: { nodes: [
                    { rating: 300, mediaRecommendation: rec(205, 'Samurai Champloo') },
                    { rating: 50, mediaRecommendation: rec(30, 'Evangelion') },
                    { rating: 900, mediaRecommendation: rec(52991, 'Already owned') },
                  ] } },
                  { idMal: 5114, title: { romaji: 'FMA', english: 'Fullmetal Alchemist: Brotherhood' }, recommendations: { nodes: [
                    { rating: 100, mediaRecommendation: rec(30, 'Evangelion') },
                    { rating: 80, mediaRecommendation: rec(666, 'Adult', { isAdult: true }) },
                    { rating: 70, mediaRecommendation: null },
                  ] } },
                ],
              },
            },
          },
        }
      }
      if (query.includes('idMal_in')) {
        const ids = (variables as { ids: number[] }).ids
        return {
          status: 200,
          data: { data: { Page: { media: ids.map((id) => ({ idMal: id, coverImage: { large: `poster-${id}.jpg` }, episodes: 12 })) } } },
        }
      }
      if (query.includes('$search')) {
        return { status: 200, data: { data: { Page: { media: [FRIEREN, media(null, 'AniList-only')] } } } }
      }
      if (query.includes('SCORE_DESC')) {
        return { status: 200, data: { data: { Page: { media: [FRIEREN, media(null, 'No MAL'), media(9253, 'Steins;Gate')] } } } }
      }
      if (query.includes('seasonYear')) {
        return { status: 200, data: { data: { Page: { media: [media(59978, 'Season Show', { status: 'RELEASING' })] } } } }
      }
      return { status: 400, data: {} }
    },
  ],
  [/jikan.*\/anime\?q=/, () => ({ status: 200, data: { data: [{ mal_id: 1, title: 'From Jikan' }] } })],
  [/jikan.*\/top\/anime/, () => ({ status: 200, data: { data: [{ mal_id: 1, title: 'Jikan top' }] } })],
  // Остальные запросы к Jikan — как на Render: соединение не устанавливается
  [/jikan/, () => ({ status: 0, data: null })],
])

// Фейковый push-сервис: запоминает отправленное, статус ответа можно подменить по endpoint
const pushed: { endpoint: string; title: string; body: string; url: string }[] = []
const pushStatus = new Map<string, number>()
const sendPush: SendPush = async (sub, message) => {
  pushed.push({ endpoint: sub.endpoint, ...message })
  return pushStatus.get(sub.endpoint) ?? 201
}

const makeApp = (attempts = 1000) =>
  createApp({
    db,
    config: {
      jwtSecret: JWT_SECRET,
      clientOrigins: [],
      authAttemptsPer15Min: attempts,
      push: { publicKey: 'BPublicKey', privateKey: 'private', subject: 'mailto:test@test.dev' },
      cronSecret: 'cron-secret',
    },
    http: upstream.http,
    upstreamIntervalMs: 0,
    sendPush,
    notifyEveryMs: 0,
  })

async function signUp(name: string) {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: name, email: `${name}@test.dev`, password: 'secret1' })
  expect(res.status).toBe(201)
  return { token: res.body.token as string, auth: { Authorization: `Bearer ${res.body.token}` } }
}

beforeAll(async () => {
  db = await freshDb()
  app = makeApp()
})

afterAll(async () => {
  await db.end()
})

describe('migrations', () => {
  it('are recorded and not applied twice', async () => {
    const { rows } = await db.query('SELECT name FROM schema_migrations ORDER BY name')
    expect(rows.map((r) => r.name)).toEqual(ALL_MIGRATIONS)
    expect(await runMigrations(db, undefined, () => {})).toEqual([])
  })

  it('survive losing the history table (the database is shared with a Prisma app)', async () => {
    await db.query('DROP TABLE schema_migrations')
    expect(await runMigrations(db, undefined, () => {})).toEqual(ALL_MIGRATIONS)
  })
})

describe('auth', () => {
  it('registers, logs in and returns the current user', async () => {
    const reg = await request(app)
      .post('/auth/register')
      .send({ username: 'musashi', email: 'Musashi@Vagabond.jp', password: 'takezo' })
    expect(reg.status).toBe(201)
    expect(reg.body.user).toMatchObject({ username: 'musashi', email: 'musashi@vagabond.jp' })
    expect(reg.body.user.password).toBeUndefined()

    const login = await request(app).post('/auth/login').send({ email: 'musashi@vagabond.jp', password: 'takezo' })
    expect(login.status).toBe(200)

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`)
    expect(me.body).toMatchObject({ username: 'musashi' })
  })

  it('rejects duplicates and invalid input', async () => {
    const dup = await request(app)
      .post('/auth/register')
      .send({ username: 'musashi', email: 'other@vagabond.jp', password: 'takezo' })
    expect(dup.status).toBe(400)

    const bad = await request(app).post('/auth/register').send({ username: 'x', email: 'nope', password: '1' })
    expect(bad.status).toBe(400)
  })

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const unknown = await request(app).post('/auth/login').send({ email: 'ghost@vagabond.jp', password: 'takezo' })
    const wrong = await request(app).post('/auth/login').send({ email: 'musashi@vagabond.jp', password: 'wrong!' })
    expect(unknown.status).toBe(400)
    expect(unknown.body).toEqual(wrong.body)
  })

  it('rejects missing and forged tokens', async () => {
    expect((await request(app).get('/list')).status).toBe(401)
    expect((await request(app).get('/list').set('Authorization', 'Bearer forged.token.here')).status).toBe(401)
  })

  it('locks out after too many failed attempts', async () => {
    const strict = makeApp(2)
    const attempt = () => request(strict).post('/auth/login').send({ email: 'musashi@vagabond.jp', password: 'nope' })
    expect((await attempt()).status).toBe(400)
    expect((await attempt()).status).toBe(400)
    const locked = await attempt()
    expect(locked.status).toBe(429)
    expect(locked.body.error).toMatch(/Too many attempts/)
  })
})

describe('anime list', () => {
  it('adds, updates, scores, clears the score and deletes', async () => {
    const { auth } = await signUp('kojiro')

    const add = await request(app).post('/list').set(auth).send({ anime_id: 52991, title: 'Frieren', episodes: 28 })
    expect(add.status).toBe(201)
    expect(add.body).toMatchObject({ status: 'planning', watched_episodes: 0, score: null })

    expect((await request(app).post('/list').set(auth).send({ anime_id: 52991, title: 'Frieren' })).status).toBe(409)

    const patch = await request(app).patch('/list/52991').set(auth).send({ status: 'watching', score: 9, watched_episodes: 5 })
    expect(patch.body).toMatchObject({ status: 'watching', score: 9, watched_episodes: 5 })

    // Поле не передано — оценка остаётся; передан null — сбрасывается
    expect((await request(app).patch('/list/52991').set(auth).send({ watched_episodes: 6 })).body.score).toBe(9)
    expect((await request(app).patch('/list/52991').set(auth).send({ score: null })).body.score).toBeNull()

    // Нельзя посмотреть больше серий, чем есть
    expect((await request(app).patch('/list/52991').set(auth).send({ watched_episodes: 999 })).body.watched_episodes).toBe(28)

    expect((await request(app).delete('/list/52991').set(auth)).status).toBe(200)
    expect((await request(app).delete('/list/52991').set(auth)).status).toBe(404)
  })

  it('tracks dates, notes and rewatches', async () => {
    const { auth } = await signUp('iori')
    await request(app).post('/list').set(auth).send({ anime_id: 30, title: 'Evangelion', episodes: 26 })
    const today = new Date().toISOString().slice(0, 10)

    // Начал смотреть — дата старта ставится сама; досмотрел — дата финиша
    const watching = await request(app).patch('/list/30').set(auth).send({ status: 'watching' })
    expect(watching.body).toMatchObject({ started_at: today, finished_at: null })
    const done = await request(app).patch('/list/30').set(auth).send({ status: 'completed' })
    expect(done.body).toMatchObject({ started_at: today, finished_at: today })

    // Явно переданные даты важнее автоматических
    const custom = await request(app)
      .patch('/list/30')
      .set(auth)
      .send({ started_at: '2024-01-05', finished_at: '2024-02-10', notes: 'End of Eva hits hard', rewatch_count: 2 })
    expect(custom.body).toMatchObject({
      started_at: '2024-01-05',
      finished_at: '2024-02-10',
      notes: 'End of Eva hits hard',
      rewatch_count: 2,
    })

    const cleared = await request(app).patch('/list/30').set(auth).send({ notes: '', finished_at: null })
    expect(cleared.body).toMatchObject({ notes: null, finished_at: null, started_at: '2024-01-05' })
  })

  it('rejects bad dates, notes and empty updates', async () => {
    const { auth } = await signUp('akemi')
    await request(app).post('/list').set(auth).send({ anime_id: 31, title: 'Bebop', episodes: 26 })
    for (const body of [
      { started_at: '2024-02-30' },
      { finished_at: '18.11.2026' },
      { notes: 'x'.repeat(2001) },
      { rewatch_count: -1 },
      { watched_episodes: null },
      {},
    ]) {
      expect((await request(app).patch('/list/31').set(auth).send(body)).status, JSON.stringify(body).slice(0, 40)).toBe(400)
    }
  })

  it('validates input', async () => {
    const { auth } = await signUp('otsu')
    await request(app).post('/list').set(auth).send({ anime_id: 1, title: 'Cowboy Bebop', episodes: 26 })

    const cases: Array<[string, object]> = [
      ['POST', { anime_id: 'abc', title: 'x' }],
      ['POST', { anime_id: 2, title: '' }],
      ['POST', { anime_id: 2, title: 'x', status: 'binging' }],
      ['POST', { anime_id: 2, title: 'x', score: 11 }],
      ['PATCH', { status: 'binging' }],
      ['PATCH', { score: 0 }],
      ['PATCH', { watched_episodes: -1 }],
    ]
    for (const [method, body] of cases) {
      const req = method === 'POST' ? request(app).post('/list') : request(app).patch('/list/1')
      expect((await req.set(auth).send(body)).status, JSON.stringify(body)).toBe(400)
    }
    expect((await request(app).patch('/list/0').set(auth).send({})).status).toBe(400)
    expect((await request(app).patch('/list/404').set(auth).send({ status: 'dropped' })).status).toBe(404)
  })

  it('keeps every user’s scrolls private', async () => {
    const alice = await signUp('alice')
    const bob = await signUp('bob')
    await request(app).post('/list').set(alice.auth).send({ anime_id: 5114, title: 'FMA: Brotherhood' })

    expect((await request(app).get('/list').set(bob.auth)).body).toEqual([])
    expect((await request(app).patch('/list/5114').set(bob.auth).send({ score: 1 })).status).toBe(404)
    expect((await request(app).delete('/list/5114').set(bob.auth)).status).toBe(404)
    expect((await request(app).get('/list').set(alice.auth)).body).toHaveLength(1)
  })

  it('aggregates stats', async () => {
    const { auth } = await signUp('takuan')
    const add = (anime_id: number, extra: object) =>
      request(app).post('/list').set(auth).send({ anime_id, title: `#${anime_id}`, episodes: 12, ...extra })
    await add(1, { status: 'watching', score: 8 })
    await add(2, { status: 'completed', score: 10 })
    await add(3, { status: 'dropped' })
    await request(app).patch('/list/1').set(auth).send({ watched_episodes: 4 })
    await request(app).patch('/list/2').set(auth).send({ watched_episodes: 12 })

    const stats = await request(app).get('/stats').set(auth)
    expect(stats.body).toEqual({ watching: 1, completed: 1, planning: 0, dropped: 1, avg_score: 9, total_episodes: 16 })
  })

  it('enforces the status rule in the database too', async () => {
    await expect(
      db.query(`INSERT INTO anime_list (user_id, anime_id, title, status) VALUES (NULL, 7, 't', 'binging')`)
    ).rejects.toThrow(/anime_list_status_check/)
  })
})

const MAL_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_name>musashi</user_name></myinfo>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title><![CDATA[Cowboy Bebop]]></series_title>
    <series_episodes>26</series_episodes>
    <my_watched_episodes>26</my_watched_episodes>
    <my_start_date>2019-03-01</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
    <my_comments><![CDATA[See you, space cowboy & co]]></my_comments>
    <my_times_watched>2</my_times_watched>
  </anime>
  <anime>
    <series_animedb_id>30</series_animedb_id>
    <series_title><![CDATA[Neon Genesis Evangelion]]></series_title>
    <series_episodes>0</series_episodes>
    <my_watched_episodes>5</my_watched_episodes>
    <my_start_date>2020-00-00</my_start_date>
    <my_score>0</my_score>
    <my_status>On-Hold</my_status>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <series_title><![CDATA[FMA: Brotherhood]]></series_title>
    <series_episodes>64</series_episodes>
    <my_watched_episodes>999</my_watched_episodes>
    <my_status>Plan to Watch</my_status>
  </anime>
  <anime><series_animedb_id>0</series_animedb_id><my_status>Completed</my_status></anime>
</myanimelist>`

describe('list import', () => {
  const importAs = (auth: Record<string, string>, body: string, query = '') =>
    request(app).post(`/list/import${query}`).set(auth).set('Content-Type', 'text/plain').send(body)

  it('imports a MyAnimeList XML export and fills in posters', async () => {
    const { auth } = await signUp('jubei')
    const res = await importAs(auth, MAL_XML)
    expect(res.body).toEqual({ total: 3, added: 3, updated: 0, skipped: 0 })

    const list = (await request(app).get('/list').set(auth)).body as Record<string, unknown>[]
    const byId = Object.fromEntries(list.map((e) => [e.anime_id, e]))
    expect(byId[1]).toMatchObject({
      title: 'Cowboy Bebop', status: 'completed', score: 9, watched_episodes: 26,
      started_at: '2019-03-01', finished_at: null, rewatch_count: 2, notes: 'See you, space cowboy & co',
      image: 'poster-1.jpg',
    })
    // On-Hold считается «смотрю»; неизвестное число серий берётся из AniList; неполная дата отбрасывается
    expect(byId[30]).toMatchObject({ status: 'watching', score: null, episodes: 12, started_at: null })
    expect(byId[5114]).toMatchObject({ status: 'planning', watched_episodes: 64 })
  })

  it('skips titles already in the scrolls unless asked to overwrite', async () => {
    const { auth } = await signUp('gonbe')
    await request(app).post('/list').set(auth).send({ anime_id: 1, title: 'Bebop', episodes: 26 })

    expect((await importAs(auth, MAL_XML)).body).toEqual({ total: 3, added: 2, updated: 0, skipped: 1 })
    expect((await importAs(auth, MAL_XML, '?mode=overwrite')).body).toEqual({ total: 3, added: 0, updated: 3, skipped: 0 })
    const bebop = (await request(app).get('/list').set(auth)).body.find((e: { anime_id: number }) => e.anime_id === 1)
    expect(bebop).toMatchObject({ status: 'completed', score: 9 })
  })

  it('imports a Shikimori JSON export', async () => {
    const { auth } = await signUp('matahachi')
    const json = JSON.stringify([
      { target_id: 21, target_title: 'One Piece', target_type: 'Anime', status: 'rewatching', score: 10, episodes: 1100, rewatches: 1 },
      { target_id: 2, target_title: 'Berserk', target_type: 'Manga', status: 'completed', score: 10 },
      { target_id: 9253, target_title: 'Steins;Gate', target_type: 'Anime', status: 'planned', score: 0 },
    ])
    expect((await importAs(auth, json)).body).toEqual({ total: 2, added: 2, updated: 0, skipped: 0 })
  })

  it('explains what is wrong with a bad file', async () => {
    const { auth } = await signUp('kohei')
    const notAnExport = await importAs(auth, 'hello there')
    expect(notAnExport.status).toBe(400)
    expect(notAnExport.body.error).toMatch(/not a MyAnimeList or Shikimori export/)
    expect((await importAs(auth, '<myanimelist></myanimelist>')).body.error).toMatch(/No anime found/)
    expect((await importAs(auth, '[oops')).body.error).toMatch(/could not be read/)
  })
})

describe('public profiles', () => {
  it('stay private until the owner opens them, and hide notes', async () => {
    const { auth } = await signUp('Sukeroku')
    await request(app).post('/list').set(auth).send({ anime_id: 1, title: 'Bebop', episodes: 26 })
    await request(app).patch('/list/1').set(auth).send({ status: 'completed', score: 9, notes: 'secret' })

    expect((await request(app).get('/public/sukeroku')).status).toBe(404)
    expect((await request(app).get('/public/nobody-at-all')).status).toBe(404)

    const me = await request(app).patch('/auth/me').set(auth).send({ is_public: true })
    expect(me.body.is_public).toBe(true)

    const pub = await request(app).get('/public/SUKEROKU')
    expect(pub.status).toBe(200)
    expect(pub.body).toMatchObject({ username: 'Sukeroku', stats: { completed: 1, avg_score: 9 } })
    expect(pub.body.list[0]).toMatchObject({ anime_id: 1, score: 9 })
    expect(pub.body.list[0].notes).toBeUndefined()

    expect((await request(app).patch('/auth/me').set(auth).send({ is_public: 'yes' })).status).toBe(400)
  })
})

describe('calendar and recommendations', () => {
  it('lists episodes airing this week for titles I watch', async () => {
    const { auth } = await signUp('rindo')
    await request(app).post('/list').set(auth).send({ anime_id: 52991, title: 'Frieren', episodes: 28, status: 'watching' })
    await request(app).patch('/list/52991').set(auth).send({ watched_episodes: 7 })

    const res = await request(app).get('/calendar').set(auth)
    expect(res.body.data).toEqual([
      expect.objectContaining({ anime_id: 52991, episode: 8, status: 'watching', watched_episodes: 7, image: 'f.jpg' }),
    ])
  })

  it('recommends what fans of my favourites liked, skipping what I have', async () => {
    const { auth } = await signUp('osugi')
    expect((await request(app).get('/recommendations').set(auth)).body).toEqual({ data: [], seeds: [] })

    await request(app).post('/list').set(auth).send({ anime_id: 1, title: 'Cowboy Bebop', score: 10 })
    await request(app).post('/list').set(auth).send({ anime_id: 5114, title: 'FMA: Brotherhood', score: 9 })
    await request(app).post('/list').set(auth).send({ anime_id: 52991, title: 'Frieren', score: 6 })

    const res = await request(app).get('/recommendations').set(auth)
    expect(res.body.seeds).toEqual(['Cowboy Bebop', 'FMA: Brotherhood'])
    // Evangelion советуют к двум любимым — он выше, хоть рейтинг каждой рекомендации ниже
    expect(res.body.data.map((a: { mal_id: number }) => a.mal_id)).toEqual([30, 205])
    expect(res.body.data[0].because).toEqual(['Cowboy Bebop', 'Fullmetal Alchemist: Brotherhood'])
  })
})

describe('push notifications', () => {
  const sub = (n: number) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`,
    keys: { p256dh: 'BKey', auth: 'secret' },
  })

  it('hands out the public key and validates subscriptions', async () => {
    const { auth } = await signUp('yoshioka')
    expect((await request(app).get('/push/key')).body).toEqual({ key: 'BPublicKey' })
    expect((await request(app).post('/push/subscribe').send(sub(1))).status).toBe(401)
    // Только настоящие push-сервисы — иначе сервер можно заставить стучаться куда угодно
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://evil.example/fcm.googleapis.com', 'https://169.254.169.254/']) {
      expect((await request(app).post('/push/subscribe').set(auth).send({ ...sub(1), endpoint })).status).toBe(400)
    }
    expect((await request(app).post('/push/subscribe').set(auth).send(sub(1))).status).toBe(201)

    pushed.length = 0
    expect((await request(app).post('/push/test').set(auth)).body).toEqual({ delivered: 1 })
    expect(pushed[0]?.title).toBe('Vagabond')
  })

  it('keeps at most five devices per account', async () => {
    const { auth } = await signUp('denshichiro')
    for (let n = 10; n < 17; n++) await request(app).post('/push/subscribe').set(auth).send(sub(n))
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint LIKE '%device-1_'`
    )
    expect(rows[0].n).toBe(5)
  })

  it('notifies watchers of a new episode once, and forgets dead devices', async () => {
    const { auth } = await signUp('seijuro')
    await request(app).post('/list').set(auth).send({ anime_id: 52991, title: 'Frieren', status: 'watching' })
    await request(app).post('/push/subscribe').set(auth).send(sub(42))
    await request(app).post('/push/subscribe').set(auth).send(sub(43))
    pushStatus.set(sub(43).endpoint, 410) // этот браузер уже отписался

    expect((await request(app).post('/internal/notify-airing')).status).toBe(403)
    expect((await request(app).post('/internal/notify-airing').set('x-cron-secret', 'wrong')).status).toBe(403)

    pushed.length = 0
    const first = await request(app).post('/internal/notify-airing').set('x-cron-secret', 'cron-secret')
    expect(first.body.sent).toBeGreaterThanOrEqual(1)
    const mine = pushed.filter((p) => p.endpoint === sub(42).endpoint)
    expect(mine).toEqual([expect.objectContaining({ title: 'Frieren', body: 'Episode 8 is out.', url: '/anime/52991' })])
    expect(pushed.some((p) => p.title === 'Nobody watches')).toBe(false)

    const dead = await db.query('SELECT 1 FROM push_subscriptions WHERE endpoint = $1', [sub(43).endpoint])
    expect(dead.rowCount).toBe(0)

    pushed.length = 0
    await request(app).post('/internal/notify-airing').set('x-cron-secret', 'cron-secret')
    expect(pushed.filter((p) => p.endpoint === sub(42).endpoint)).toHaveLength(0) // второй раз не шлём
  })
})

describe('notification scheduler without a secret', () => {
  it('is public but runs at most once per interval', async () => {
    const open = createApp({
      db,
      config: {
        jwtSecret: JWT_SECRET, clientOrigins: [], authAttemptsPer15Min: 1000,
        push: { publicKey: 'BPublicKey', privateKey: 'private', subject: 'mailto:test@test.dev' },
      },
      http: upstream.http,
      upstreamIntervalMs: 0,
      sendPush,
    })
    expect((await request(open).post('/internal/notify-airing')).status).toBe(200)
    const again = await request(open).post('/internal/notify-airing')
    expect(again.status).toBe(429)
    expect(again.body.retry_in_s).toBeGreaterThan(500)
  })
})

describe('anime catalogue proxy', () => {
  it('maps search results to MAL ids and drops titles without one', async () => {
    const res = await request(app).get('/api/anime/search?q=frieren')
    expect(res.body.data).toEqual([
      expect.objectContaining({ mal_id: 52991, title: 'Sousou no Frieren', episodes: 28, score: 9 }),
    ])
  })

  it('caches searches regardless of case', async () => {
    const before = upstream.calls.length
    await request(app).get('/api/anime/search?q=FRIEREN')
    expect(upstream.calls.length).toBe(before)
  })

  it('serves the top list from AniList in the Jikan format, ranked', async () => {
    const res = await request(app).get('/api/anime/top')
    expect(res.body.data.map((a: { mal_id: number; rank: number }) => [a.mal_id, a.rank])).toEqual([
      [52991, 1],
      [9253, 2],
    ])
    expect(res.body.data[0]).toMatchObject({
      title_english: 'Frieren',
      title_japanese: '葬送のフリーレン',
      type: 'TV',
      status: 'Finished Airing',
      source: 'Manga',
      synopsis: "An elf mage.\n\nShe outlives everyone's party.",
      trailer: { embed_url: 'https://www.youtube-nocookie.com/embed/abc123' },
      aired: { string: '29 Sep 2023 to 22 Mar 2024' },
    })
  })

  it('serves this season', async () => {
    const res = await request(app).get('/api/anime/season')
    expect(res.body.data).toEqual([expect.objectContaining({ mal_id: 59978, airing: true })])
  })

  it('serves a title, its characters and episodes from one cached AniList query', async () => {
    const before = upstream.calls.length
    const full = await request(app).get('/api/anime/52991')
    const chars = await request(app).get('/api/anime/52991/characters')
    const eps = await request(app).get('/api/anime/52991/episodes')
    expect(upstream.calls.length - before).toBe(1)

    expect(full.body.data).toMatchObject({ mal_id: 52991, rank: 1, members: 500000 })
    expect(chars.body.data[0]).toMatchObject({
      character: { name: 'Frieren' },
      role: 'Main',
      voice_actors: [{ person: { name: 'Atsumi Tanezaki' } }],
    })
    expect(eps.body.data).toEqual([
      { mal_id: 1, title: "The Journey's End", aired: '2023-09-29T00:00:00.000Z' },
      { mal_id: 2, title: 'It Didn’t Have to Be Magic...', aired: null },
    ])
  })

  it('returns 404 for unknown titles and 400 for bad ids', async () => {
    expect((await request(app).get('/api/anime/999999')).status).toBe(404)
    expect((await request(app).get('/api/anime/abc')).status).toBe(400)
    expect((await request(app).get('/api/anime/1/reviews')).status).toBe(400)
  })

  it('falls back to Jikan when AniList is unreachable', async () => {
    anilistDown = true
    const fresh = makeApp() // без кеша
    const search = await request(fresh).get('/api/anime/search?q=bebop')
    const top = await request(fresh).get('/api/anime/top')
    anilistDown = false
    expect(search.body.data[0].title).toBe('From Jikan')
    expect(top.body.data[0].title).toBe('Jikan top')
  })

  it('answers 502, not 500, when every source is down', async () => {
    anilistDown = true
    const res = await request(makeApp()).get('/api/anime/season')
    anilistDown = false
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('Anime catalogue unavailable')
  })
})

describe('http basics', () => {
  it('answers unknown routes and broken JSON clearly', async () => {
    expect((await request(app).get('/nope')).status).toBe(404)
    const broken = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{oops')
    expect(broken.status).toBe(400)
    expect(broken.body.error).toBe('Malformed JSON')
  })

  it('sends security headers', async () => {
    const res = await request(app).get('/ping')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
