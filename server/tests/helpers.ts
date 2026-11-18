import type { Http, HttpResponse } from '../src/lib/http.js'
import { createPool, type Db } from '../src/db.js'
import { runMigrations } from '../src/migrate.js'

export const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://t:t@localhost/t_test'
export const JWT_SECRET = 'test-secret'

/** Чистая схема + все миграции */
export async function freshDb(): Promise<Db> {
  const db = createPool(TEST_DB_URL)
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await runMigrations(db, undefined, () => {})
  return db
}

type Handler = (url: string, body?: unknown) => HttpResponse | Promise<HttpResponse>

/** Фейковый HTTP: отвечает по первому совпавшему шаблону и запоминает вызовы */
export function fakeHttp(routes: Array<[RegExp, Handler]>) {
  const calls: string[] = []
  const handle = async (url: string, body?: unknown): Promise<HttpResponse> => {
    calls.push(url)
    const route = routes.find(([re]) => re.test(url))
    return route ? route[1](url, body) : { status: 404, data: {} }
  }
  const http: Http = { get: (url) => handle(url), post: (url, body) => handle(url, body) }
  return { http, calls }
}
