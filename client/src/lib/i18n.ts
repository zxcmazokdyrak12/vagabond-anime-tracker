import { useSyncExternalStore } from 'react'
import { ru, ja, PLURALS } from './translations'

export type Lang = 'en' | 'ru' | 'ja'
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ru', label: 'Русский', short: 'RU' },
  { id: 'ja', label: '日本語', short: '日本' },
]

const DICTS: Record<Exclude<Lang, 'en'>, Record<string, string>> = { ru, ja }
const LOCALES: Record<Lang, string> = { en: 'en-GB', ru: 'ru-RU', ja: 'ja-JP' }

function detect(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'ru' || saved === 'ja') return saved
  } catch {
    // приватный режим
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en'
  return nav.startsWith('ru') ? 'ru' : nav.startsWith('ja') ? 'ja' : 'en'
}

let lang: Lang = detect()
const listeners = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = lang

export const getLang = () => lang
/** Локаль для дат и чисел */
export const locale = () => LOCALES[lang]

export function setLang(next: Lang) {
  lang = next
  try {
    localStorage.setItem('lang', next)
  } catch {
    // не запомнится — не страшно
  }
  document.documentElement.lang = next
  listeners.forEach((l) => l())
}

/**
 * Перевод: ключ — английский текст. Нет перевода — показываем английский.
 * {name} в строке подставляется из vars.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const text = lang === 'en' ? key : (DICTS[lang][key] ?? key)
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text
}

/** Только слово в нужной форме: 1 → «серия», 3 → «серии», 5 → «серий». noun — английское слово в ед. числе */
export function pluralWord(n: number, noun: string): string {
  if (lang === 'en') return n === 1 ? noun : (PLURALS.en[noun] ?? `${noun}s`)
  const forms = PLURALS[lang][noun]
  if (!forms) return noun
  if (typeof forms === 'string') return forms
  const rule = new Intl.PluralRules(LOCALES[lang]).select(n) as keyof typeof forms
  return forms[rule] ?? forms.many ?? noun
}

/** «1 episode», «3 серии», «5話» */
export function plural(n: number, noun: string): string {
  const word = pluralWord(n, noun)
  return lang === 'ja' ? `${n}${word}` : `${n} ${word}`
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Хук: компонент перерисуется при смене языка */
export function useT() {
  useSyncExternalStore(subscribe, getLang, getLang)
  return t
}
