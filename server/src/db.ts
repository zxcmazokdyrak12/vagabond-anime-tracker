import pg from 'pg'

export type Db = pg.Pool

export function createPool(connectionString: string): Db {
  // Локальный Postgres обычно без SSL, облачный (Neon) — с SSL
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString)
  return new pg.Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
  })
}
