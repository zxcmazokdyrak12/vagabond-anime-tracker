import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../src/app.js'
import type { Db } from '../src/db.js'
import { runMigrations } from '../src/migrate.js'
import { JWT_SECRET, fakeHttp, freshDb } from './helpers.js'

const ANILIST = [
  { idMal: 52991, title: { romaji: 'Sousou no Frieren', english: 'Frieren', native: '葬送のフリーレン' }, coverImage: { large: 'f.jpg' }, episodes: 28, averageScore: 90 },
  { idMal: null, title: { romaji: 'AniList-only', english: null, native: null }, coverImage: { large: null }, episodes: 1, averageScore: null },
]

let db: Db
let app: Express
let anilistDown = false
const upstream = fakeHttp([
  [/anilist/, () => (anilistDown ? { status: 500, data: {} } : { status: 200, data: { data: { Page: { media: ANILIST } } } })],
  [/jikan.*\/anime\?q=/, () => ({ status: 200, data: { data: [{ mal_id: 1, title: 'From Jikan' }] } })],
  [/jikan.*\/top\/anime/, () => ({ status: 200, data: { data: [{ mal_id: 52991 }] } })],
  [/jikan.*\/anime\/52991\/full/, () => ({ status: 200, data: { data: { mal_id: 52991, title: 'Frieren' } } })],
  [/jikan.*\/anime\/999999\/full/, () => ({ status: 404, data: {} })],
])

const makeApp = (attempts = 1000) =>
  createApp({
    db,
    config: { jwtSecret: JWT_SECRET, clientOrigins: [], authAttemptsPer15Min: attempts },
    http: upstream.http,
    jikanIntervalMs: 0,
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
    expect(rows.map((r) => r.name)).toEqual(['001_initial.sql', '002_list_constraints.sql'])
    expect(await runMigrations(db, undefined, () => {})).toEqual([])
  })

  it('survive losing the history table (the database is shared with a Prisma app)', async () => {
    await db.query('DROP TABLE schema_migrations')
    expect(await runMigrations(db, undefined, () => {})).toEqual(['001_initial.sql', '002_list_constraints.sql'])
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

describe('anime catalogue proxy', () => {
  it('maps AniList results to MAL ids and drops titles without one', async () => {
    const res = await request(app).get('/api/anime/search?q=frieren')
    expect(res.body.data).toEqual([
      expect.objectContaining({ mal_id: 52991, title: 'Sousou no Frieren', episodes: 28, score: 9 }),
    ])
  })

  it('caches searches', async () => {
    const before = upstream.calls.length
    await request(app).get('/api/anime/search?q=FRIEREN')
    expect(upstream.calls.length).toBe(before)
  })

  it('falls back to Jikan when AniList is down', async () => {
    anilistDown = true
    const res = await request(app).get('/api/anime/search?q=bebop')
    anilistDown = false
    expect(res.body.data[0].title).toBe('From Jikan')
  })

  it('proxies and caches Jikan', async () => {
    const first = await request(app).get('/api/anime/top')
    const before = upstream.calls.length
    const second = await request(app).get('/api/anime/top')
    expect(second.body).toEqual(first.body)
    expect(upstream.calls.length).toBe(before)

    expect((await request(app).get('/api/anime/52991')).body.data.title).toBe('Frieren')
  })

  it('returns 404 for unknown titles and 400 for bad ids', async () => {
    expect((await request(app).get('/api/anime/999999')).status).toBe(404)
    expect((await request(app).get('/api/anime/abc')).status).toBe(400)
    expect((await request(app).get('/api/anime/1/reviews')).status).toBe(400)
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
