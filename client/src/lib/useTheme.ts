import { useCallback, useState } from 'react'

export type Theme = 'paper' | 'night'

// Тема хранится в data-theme на <html>; начальное значение ставит скрипт в index.html
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'night' ? 'night' : 'paper'
  )

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'night' ? 'paper' : 'night'
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
