import { getPushKey, subscribePush, unsubscribePush } from '../api'

/** VAPID-ключ приходит в base64url, а браузеру нужен Uint8Array */
export function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** iPhone/iPad: пуши работают только у сайта, добавленного на экран «Домой» */
export const needsHomeScreen = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches

async function registration() {
  // В разработке воркер не регистрируется при загрузке — регистрируем по требованию
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  const { data } = await getPushKey()
  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.key) }))
  await subscribePush(sub.toJSON())
  return 'granted' as const
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await unsubscribePush(sub.endpoint).catch(() => {})
  await sub.unsubscribe()
}
