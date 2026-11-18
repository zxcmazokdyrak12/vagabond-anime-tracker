import { loadConfig } from './config.js'
import { createPool } from './db.js'
import { runMigrations } from './migrate.js'
import { createApp } from './app.js'

async function main() {
  const config = loadConfig()
  const db = createPool(config.databaseUrl)
  await runMigrations(db)
  console.log('DB ready')

  const server = createApp({ db, config }).listen(config.port, () => {
    console.log(`Server: http://localhost:${config.port}`)
  })

  // Render присылает SIGTERM при деплое — закрываемся аккуратно
  process.on('SIGTERM', () => {
    server.close(() => db.end().then(() => process.exit(0)))
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
