import { UpstreamError, type Http } from './http.js'

interface Options {
  http: Http
  /** Минимальная пауза между запросами к источнику (Jikan пускает ~3 в секунду) */
  minIntervalMs?: number
  maxEntries?: number
  retries?: number
  sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * GET-клиент к внешнему API с тремя защитами:
 *  1. кеш с TTL — повторные запросы не уходят наружу;
 *  2. склейка одинаковых запросов в полёте — 10 пользователей открыли один тайтл → 1 запрос;
 *  3. очередь с паузой + повтор при 429/5xx — укладываемся в лимиты Jikan.
 */
export function createCachedClient({ http, minIntervalMs = 400, maxEntries = 500, retries = 3, sleep = realSleep }: Options) {
  const cache = new Map<string, { value: unknown; expires: number }>()
  const inFlight = new Map<string, Promise<unknown>>()
  let queue: Promise<void> = Promise.resolve()
  let lastCall = 0

  // Каждый запрос ждёт своей очереди и паузы после предыдущего
  const throttled = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const wait = lastCall + minIntervalMs - Date.now()
      if (wait > 0) await sleep(wait)
      lastCall = Date.now()
      return fn()
    })
    queue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  const fetchWithRetry = async (url: string): Promise<unknown> => {
    for (let attempt = 1; ; attempt++) {
      const res = await throttled(() => http.get(url))
      if (res.status >= 200 && res.status < 300) return res.data
      const retryable = res.status === 429 || res.status >= 500
      if (!retryable || attempt >= retries) throw new UpstreamError(res.status)
      await sleep(1000 * attempt)
    }
  }

  return {
    async get<T = unknown>(url: string, ttlMs: number): Promise<T> {
      const hit = cache.get(url)
      if (hit && hit.expires > Date.now()) return hit.value as T

      let pending = inFlight.get(url)
      if (!pending) {
        pending = fetchWithRetry(url).finally(() => inFlight.delete(url))
        inFlight.set(url, pending)
      }
      const value = await pending

      cache.set(url, { value, expires: Date.now() + ttlMs })
      // Простой предел размера: выбрасываем самые старые записи
      while (cache.size > maxEntries) cache.delete(cache.keys().next().value!)
      return value as T
    },
    clear: () => cache.clear(),
    get size() {
      return cache.size
    },
  }
}

export type CachedClient = ReturnType<typeof createCachedClient>
