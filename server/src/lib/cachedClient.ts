import { UpstreamError, type Http, type HttpResponse } from './http.js'

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

  const fetchWithRetry = async (request: () => Promise<HttpResponse>): Promise<unknown> => {
    for (let attempt = 1; ; attempt++) {
      const res = await throttled(request)
      if (res.status >= 200 && res.status < 300) return res.data
      // 0 — сеть, 429 — лимит, 5xx — сбой источника: имеет смысл повторить
      const retryable = res.status === 0 || res.status === 429 || res.status >= 500
      if (!retryable || attempt >= retries) throw new UpstreamError(res.status)
      await sleep(1000 * attempt)
    }
  }

  /** Кеш + склейка + очередь для любого запроса; key — по нему кешируем */
  const request = async <T>(key: string, ttlMs: number, doRequest: () => Promise<HttpResponse>): Promise<T> => {
    const hit = cache.get(key)
    if (hit && hit.expires > Date.now()) return hit.value as T

    let pending = inFlight.get(key)
    if (!pending) {
      pending = fetchWithRetry(doRequest).finally(() => inFlight.delete(key))
      inFlight.set(key, pending)
    }
    const value = await pending

    cache.set(key, { value, expires: Date.now() + ttlMs })
    // Простой предел размера: выбрасываем самые старые записи
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value!)
    return value as T
  }

  return {
    request,
    get: <T = unknown>(url: string, ttlMs: number) => request<T>(url, ttlMs, () => http.get(url)),
    post: <T = unknown>(url: string, body: unknown, ttlMs: number) =>
      request<T>(`${url}#${JSON.stringify(body)}`, ttlMs, () => http.post(url, body)),
    clear: () => cache.clear(),
    get size() {
      return cache.size
    },
  }
}

export type CachedClient = ReturnType<typeof createCachedClient>
