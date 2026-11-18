import { defineConfig, devices } from '@playwright/test'

// Сквозные тесты: мок каталога + настоящий сервер с Postgres + собранный клиент.
// Нужна база: E2E_DATABASE_URL (в CI — сервис postgres).
const DB = process.env.E2E_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vagabond_e2e'
const API = 'http://localhost:3102'
const WEB = 'http://localhost:4173'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    { command: 'node mock-catalogue.mjs', url: 'http://localhost:4010/health', reuseExistingServer: !process.env.CI },
    {
      command: 'node server.js',
      cwd: '../server',
      url: `${API}/ping`,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: DB,
        JWT_SECRET: 'e2e-secret-not-for-production',
        PORT: '3102',
        ANILIST_URL: 'http://localhost:4010/graphql',
        JIKAN_URL: 'http://localhost:4010/jikan',
        AUTH_RATE_LIMIT: '1000',
      },
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      cwd: '../client',
      url: WEB,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: API },
    },
  ],
})
