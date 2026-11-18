import { describe, expect, it } from 'vitest'
import { createCachedClient } from '../src/lib/cachedClient.js'
import { UpstreamError } from '../src/lib/http.js'
import { fakeHttp } from './helpers.js'

const noSleep = async () => {}

describe('cached client', () => {
  it('serves repeated requests from cache within TTL', async () => {
    const { http, calls } = fakeHttp([[/top/, () => ({ status: 200, data: { data: [1] } })]])
    const client = createCachedClient({ http, minIntervalMs: 0, sleep: noSleep })

    expect(await client.get('https://x/top', 60_000)).toEqual({ data: [1] })
    expect(await client.get('https://x/top', 60_000)).toEqual({ data: [1] })
    expect(calls).toHaveLength(1)
  })

  it('refetches after the TTL expires', async () => {
    const { http, calls } = fakeHttp([[/top/, () => ({ status: 200, data: 'ok' })]])
    const client = createCachedClient({ http, minIntervalMs: 0, sleep: noSleep })

    await client.get('https://x/top', -1) // уже протухло
    await client.get('https://x/top', -1)
    expect(calls).toHaveLength(2)
  })

  it('merges identical concurrent requests into one', async () => {
    const { http, calls } = fakeHttp([[/full/, () => ({ status: 200, data: 'anime' })]])
    const client = createCachedClient({ http, minIntervalMs: 0, sleep: noSleep })

    const results = await Promise.all(Array.from({ length: 10 }, () => client.get('https://x/1/full', 1000)))
    expect(results.every((r) => r === 'anime')).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('retries 429 and 5xx, then succeeds', async () => {
    const answers = [429, 503, 200]
    const { http, calls } = fakeHttp([[/./, () => ({ status: answers.shift()!, data: 'finally' })]])
    const client = createCachedClient({ http, minIntervalMs: 0, sleep: noSleep })

    expect(await client.get('https://x/a', 1000)).toBe('finally')
    expect(calls).toHaveLength(3)
  })

  it('does not retry 404 and does not cache failures', async () => {
    const { http, calls } = fakeHttp([[/./, () => ({ status: 404, data: {} })]])
    const client = createCachedClient({ http, minIntervalMs: 0, sleep: noSleep })

    await expect(client.get('https://x/missing', 1000)).rejects.toBeInstanceOf(UpstreamError)
    await expect(client.get('https://x/missing', 1000)).rejects.toMatchObject({ status: 404 })
    expect(calls).toHaveLength(2)
    expect(client.size).toBe(0)
  })

  it('spaces out calls to respect the upstream rate limit', async () => {
    const waits: number[] = []
    const { http } = fakeHttp([[/./, () => ({ status: 200, data: null })]])
    const client = createCachedClient({
      http,
      minIntervalMs: 400,
      sleep: async (ms) => {
        waits.push(ms)
      },
    })

    await Promise.all(['a', 'b', 'c'].map((p) => client.get(`https://x/${p}`, 1000)))
    expect(waits.length).toBe(2) // первый сразу, двое ждут своей очереди
    expect(waits.every((ms) => ms > 0 && ms <= 400)).toBe(true)
  })

  it('evicts the oldest entries beyond maxEntries', async () => {
    const { http } = fakeHttp([[/./, (url) => ({ status: 200, data: url })]])
    const client = createCachedClient({ http, minIntervalMs: 0, maxEntries: 2, sleep: noSleep })

    for (const p of ['a', 'b', 'c']) await client.get(`https://x/${p}`, 60_000)
    expect(client.size).toBe(2)
  })
})

describe('cached client: network failures', () => {
  it('retries when there was no response at all, then reports the source unreachable', async () => {
    const { http, calls } = fakeHttp([[/./, () => ({ status: 0, data: null })]])
    const client = createCachedClient({ http, minIntervalMs: 0, sleep: async () => {} })

    await expect(client.get('https://x/down', 1000)).rejects.toMatchObject({ status: 0 })
    expect(calls).toHaveLength(3)
  })

  it('caches POST requests by body', async () => {
    const { http, calls } = fakeHttp([[/./, (_u, body) => ({ status: 200, data: body })]])
    const client = createCachedClient({ http, minIntervalMs: 0, sleep: async () => {} })

    await client.post('https://x/gql', { q: 1 }, 1000)
    await client.post('https://x/gql', { q: 1 }, 1000)
    await client.post('https://x/gql', { q: 2 }, 1000)
    expect(calls).toHaveLength(2)
  })
})
