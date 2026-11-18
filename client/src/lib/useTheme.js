import { useCallback, useState } from 'react'

// Тема хранится в data-theme на <html>; начальное значение ставит скрипт в index.html
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'paper')

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'night' ? 'paper' : 'night'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('theme', next)
      } catch {
        // приватный режим — тема просто не запомнится
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
