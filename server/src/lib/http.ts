import axios from 'axios'

export interface HttpResponse {
  status: number
  data: unknown
}

/** Внешние HTTP-запросы через один интерфейс — в тестах его подменяет фейк */
export interface Http {
  get(url: string): Promise<HttpResponse>
  post(url: string, body: unknown): Promise<HttpResponse>
}

const TIMEOUT_MS = 8000

export const axiosHttp: Http = {
  async get(url) {
    const res = await axios.get(url, { timeout: TIMEOUT_MS, validateStatus: () => true })
    return { status: res.status, data: res.data }
  },
  async post(url, body) {
    const res = await axios.post(url, body, { timeout: TIMEOUT_MS, validateStatus: () => true })
    return { status: res.status, data: res.data }
  },
}

export class UpstreamError extends Error {
  constructor(public readonly status: number, message = `Upstream responded with ${status}`) {
    super(message)
  }
}
