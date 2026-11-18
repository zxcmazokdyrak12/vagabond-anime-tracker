import { act, render, screen } from '@testing-library/react'
import { plural, pluralWord, setLang, t, useT } from './i18n'

afterEach(() => setLang('en'))

describe('i18n', () => {
  it('translates by the English key and fills placeholders', () => {
    setLang('ru')
    expect(t('Add to scrolls')).toBe('В свитки')
    expect(t('Results for “{q}”', { q: 'берсерк' })).toBe('Найдено по запросу «берсерк»')
    setLang('ja')
    expect(t('Episode {n} of {total}', { n: 8, total: 28 })).toBe('第8話（全28話）')
  })

  it('falls back to English for unknown keys', () => {
    setLang('ru')
    expect(t('Something nobody translated')).toBe('Something nobody translated')
  })

  it('uses Russian plural forms', () => {
    setLang('ru')
    expect([1, 3, 5, 21, 22, 111].map((n) => plural(n, 'episode'))).toEqual([
      '1 серия', '3 серии', '5 серий', '21 серия', '22 серии', '111 серий',
    ])
    expect(pluralWord(194, 'episode')).toBe('серии')
    expect(plural(78, 'hour')).toBe('78 часов')
  })

  it('uses Japanese counters without a space', () => {
    setLang('ja')
    expect(plural(28, 'episode')).toBe('28話')
    expect(plural(5, 'title')).toBe('5作品')
  })

  it('keeps English plurals', () => {
    expect(plural(1, 'title')).toBe('1 title')
    expect(plural(2, 'time')).toBe('2 times')
  })

  it('re-renders components and sets <html lang> when the language changes', () => {
    function Label() {
      const tr = useT()
      return <p>{tr('This week')}</p>
    }
    render(<Label />)
    expect(screen.getByText('This week')).toBeInTheDocument()
    act(() => setLang('ja'))
    expect(screen.getByText('今週')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('ja')
  })
})
