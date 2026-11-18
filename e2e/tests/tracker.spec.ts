import { expect, test, type Page } from '@playwright/test'

// Каждый тест — новый воин, чтобы тесты не зависели друг от друга
const fresh = () => `ronin${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

async function skipIntro(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('intro-seen', '1'))
}

async function register(page: Page, name = fresh()) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Warrior name').fill(name)
  await page.getByLabel('Email').fill(`${name}@example.com`)
  await page.getByLabel('Password').fill('katana-123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible()
  return name
}

// Название навигации тоже переводится, поэтому ищем по классу
const tab = (page: Page, name: string) => page.locator('nav.nav').getByRole('link', { name: new RegExp(name) })

test('the intro is cut through with Enter and leads to sign in', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Drag across the screen to cut through', { exact: false })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
})

test('a new warrior adds a title from the gate and tracks episodes', async ({ page }) => {
  await skipIntro(page)
  await register(page)

  // Врата: каталог пришёл из мока
  await tab(page, 'The gate').click()
  await expect(page.getByRole('heading', { name: 'Frieren' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Add to scrolls' }).click()
  await expect(page.getByRole('button', { name: 'In your scrolls' })).toBeDisabled()
  await expect(tab(page, 'My scrolls')).toContainText('1')

  // Свитки: отмечаем две серии
  await tab(page, 'My scrolls').click()
  const row = page.getByRole('listitem', { name: 'Sousou no Frieren' })
  await expect(row).toBeVisible()
  const next = row.getByRole('button', { name: 'Mark next episode of Sousou no Frieren as watched' })
  await next.click()
  await next.click()
  await expect(row).toContainText('2 of 28')

  // Прогресс сохранён на сервере: после перезагрузки он на месте
  await page.reload()
  await expect(page.getByRole('listitem', { name: 'Sousou no Frieren' })).toContainText('2 of 28')
})

test('search finds a title and its page opens', async ({ page }) => {
  await skipIntro(page)
  await register(page)

  await page.getByRole('searchbox', { name: 'Search anime' }).fill('steins')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Results for “steins”' })).toBeVisible()
  await page.getByRole('link', { name: /Steins;Gate/ }).first().click()
  await expect(page).toHaveURL(/\/anime\/9253/)
  await expect(page.getByRole('heading', { name: 'Steins;Gate', level: 1 })).toBeVisible()
})

test('the interface switches to Russian and Japanese and remembers it', async ({ page }) => {
  await skipIntro(page)
  await register(page)

  await page.getByRole('button', { name: 'Русский' }).click()
  await expect(tab(page, 'Мои свитки')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

  await page.reload()
  await expect(tab(page, 'Мои свитки')).toBeVisible()

  await page.getByRole('button', { name: '日本語' }).click()
  await expect(tab(page, '巻物')).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(tab(page, 'My scrolls')).toBeVisible()
})

test('"?" opens the shortcuts and "/" jumps to search', async ({ page }) => {
  await skipIntro(page)
  await register(page)

  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.keyboard.press('/')
  await expect(page.getByRole('searchbox', { name: 'Search anime' })).toBeFocused()
})

test('an open path is visible to anyone by link, a closed one is not', async ({ page, browser }) => {
  await skipIntro(page)
  const name = await register(page)
  await tab(page, 'The gate').click()
  await page.getByRole('button', { name: 'Add to scrolls' }).click()
  await expect(page.getByRole('button', { name: 'In your scrolls' })).toBeVisible()

  await tab(page, 'The path').click()
  await page.getByRole('checkbox', { name: /Anyone with the link/ }).click()
  await expect(page.getByRole('checkbox', { name: /Anyone with the link/ })).toBeChecked()

  // Гость без аккаунта
  const guest = await browser.newPage()
  await skipIntro(guest)
  await guest.goto(`/u/${name}`)
  await expect(guest.getByRole('heading', { name, exact: true })).toBeVisible()
  await expect(guest.getByRole('link', { name: 'Sousou no Frieren' })).toBeVisible()

  // Закрыли — гость видит то же, что и для несуществующего профиля
  await page.getByRole('checkbox', { name: /Anyone with the link/ }).click()
  await expect(page.getByRole('checkbox', { name: /Anyone with the link/ })).not.toBeChecked()
  await guest.reload()
  await expect(guest.getByText('This path is private or does not exist')).toBeVisible()
  await guest.close()
})

test('a MyAnimeList export is imported into the scrolls', async ({ page }) => {
  await skipIntro(page)
  await register(page)

  const xml = `<?xml version="1.0" encoding="UTF-8"?><myanimelist>
    <anime><series_animedb_id>5114</series_animedb_id><series_title><![CDATA[Fullmetal Alchemist: Brotherhood]]></series_title>
      <series_episodes>64</series_episodes><my_watched_episodes>64</my_watched_episodes><my_score>10</my_score><my_status>Completed</my_status></anime>
    <anime><series_animedb_id>1</series_animedb_id><series_title><![CDATA[Cowboy Bebop]]></series_title>
      <series_episodes>26</series_episodes><my_watched_episodes>5</my_watched_episodes><my_score>0</my_score><my_status>Watching</my_status></anime>
  </myanimelist>`

  await tab(page, 'My scrolls').click()
  await page.getByRole('button', { name: /Import/ }).first().click()
  await page.getByLabel('Export file').setInputFiles({ name: 'animelist.xml', mimeType: 'text/xml', buffer: Buffer.from(xml) })
  await expect(page.getByRole('listitem', { name: 'Cowboy Bebop' })).toContainText('5 of 26')
  await expect(page.getByRole('listitem', { name: 'Fullmetal Alchemist: Brotherhood' })).toBeVisible()
})

test('the airing week shows an ongoing title from the scrolls', async ({ page }) => {
  await skipIntro(page)
  await register(page)

  await page.goto('/anime/59978')
  await page.getByRole('button', { name: 'Add to scrolls' }).click()
  await expect(page.getByText('In your scrolls as')).toBeVisible()

  await page.goto('/?tab=calendar')
  await expect(page.getByText('Ronin Season')).toBeVisible()
  await expect(page.getByText(/Episode 5/)).toBeVisible()
})
