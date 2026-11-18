import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Тесты API делят одну тестовую базу — запускаем файлы по очереди
    fileParallelism: false,
    testTimeout: 15000,
  },
})
