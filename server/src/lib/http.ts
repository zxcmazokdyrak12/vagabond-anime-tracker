import axios from 'axios'

export interface HttpResponse {
  /** HTTP-статус; 0 — ответа не было вообще (таймаут, обрыв, DNS) */
  status: number
  data: unknown
}

/** Внешние HTTP-запросы через один интерфейс — в тестах его подменяет фейк */
export interface Http {
  get(url: string): Promise<HttpResponse>
  post(url: string, body: unknown): Promise<HttpResponse>
}

const TIMEOUT_MS = 8000
const HEADERS = { 'User-Agent': 'vagabond-anime-tracker (+https://github.com/zxcmazokdyrak12/vagabond-anime-tracker)' }

// Сетевые ошибки не бросаем, а возвращаем как status 0 — их тоже можно повторить
const safe = async (request: () => Promise<{ status: number; data: unknown }>): Promise<HttpResponse> => {
  try {
    const res = await request()
    return { status: res.status, data: res.data }
  } catch (err) {
    console.error('Upstream request failed:', (err as Error).message)
    return { status: 0, data: null }
  }
}

export const axiosHttp: Http = {
  get: (url) => safe(() => axios.get(url, { timeout: TIMEOUT_MS, headers: HEADERS, validateStatus: () => true })),
  post: (url, body) =>
    safe(() => axios.post(url, body, { timeout: TIMEOUT_MS, headers: HEADERS, validateStatus: () => true })),
}

export class UpstreamError extends Error {
  constructor(
    public readonly status: number,
    message = status ? `Upstream responded with ${status}` : 'Upstream unreachable'
  ) {
    super(message)
  }
}
