import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Db } from './db.js'

// Папка migrations/ лежит рядом с src/ и dist/ — путь одинаковый из обоих
const DEFAULT_DIR = fileURLToPath(new URL('../migrations', import.meta.url))
const LOCK_ID = 727_001 // произвольное число для pg_advisory_lock

/**
 * Минимальный мигратор: применяет migrations/NNN_name.sql по порядку, каждый в своей транзакции,
 * и записывает применённые в таблицу schema_migrations. Advisory lock не даёт двум
 * экземплярам сервера мигрировать одновременно.
 */
export async function runMigrations(db: Db, dir = DEFAULT_DIR, log = console.log): Promise<string[]> {
  const client = await db.connect()
  const applied: string[] = []
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name)
    )
    const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort()

    for (const file of files) {
      if (done.has(file)) continue
      const sql = await readFile(path.join(dir, file), 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        applied.push(file)
        log(`Migration applied: ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`)
      }
    }
    return applied
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {})
    client.release()
  }
}
