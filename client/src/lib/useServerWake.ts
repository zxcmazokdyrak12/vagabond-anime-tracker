import { useEffect, useState } from 'react'

export type WakeStatus = 'waking' | 'ready' | 'unreachable'

const RETRY_MS = 2000
const REQUEST_TIMEOUT_MS = 8000
/** Render на бесплатном тарифе просыпается до минуты; дольше — что-то не так */
const GIVE_UP_AFTER_S = 90

/**
 * Будит сервер на Render: стучится в /ping, пока не ответит.
 * Возвращает состояние и сколько секунд прошло — для индикатора на заставке.
 */
export function useServerWake(baseUrl: string) {
  const [status, setStatus] = useState<WakeStatus>('waking')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    let cancelled = false
    const started = Date.now()
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250)

    ;(async () => {
      while (!cancelled) {
        const ctrl = new AbortController()
        const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
        try {
          const res = await fetch(`${baseUrl}/ping`, { signal: ctrl.signal, cache: 'no-store' })
          if (res.ok) {
            if (!cancelled) setStatus('ready')
            break
          }
        } catch {
          // сервер ещё спит или сеть моргнула — пробуем снова
        } finally {
          clearTimeout(timeout)
        }
        if ((Date.now() - started) / 1000 > GIVE_UP_AFTER_S) {
          if (!cancelled) setStatus('unreachable')
          break
        }
        await new Promise((r) => setTimeout(r, RETRY_MS))
      }
      clearInterval(tick)
    })()

    return () => {
      cancelled = true
      clearInterval(tick)
    }
  }, [baseUrl])

  return { status, elapsed }
}
