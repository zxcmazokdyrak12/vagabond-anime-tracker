import express from 'express'
import cors from 'cors'
import pg from 'pg'
import bodyParser from 'body-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import 'dotenv/config'
import axios from 'axios'


const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// ── Создаём таблицы ──────────────────────────────
async function initDB() {
  // Пользователи
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Список аниме пользователя
  // anime_id — это id из Tenrai / Jikan API (MyAnimeList)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anime_list (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      anime_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      image TEXT,
      episodes INTEGER,
      status TEXT DEFAULT 'planning',
      score INTEGER CHECK (score >= 1 AND score <= 10),
      watched_episodes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, anime_id)
    )
  `)

  console.log('DB ready')
}

const app = express()
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// ── Middleware: проверка JWT ──────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// ── Auth роуты ───────────────────────────────────

// Регистрация
app.post('/auth/register', async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' })

  try {
    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    )
    const user = result.rows[0]
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user })
  } catch (err) {
    console.error('Register error:', err)
    if (err.code === '23505') return res.status(400).json({ error: 'Username or email already exists' })
    res.status(500).json({ error: 'Server error' })
  }
})

// Логин
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = result.rows[0]
    if (!user) return res.status(400).json({ error: 'User not found' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: 'Wrong password' })

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Проверка токена
app.get('/auth/me', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.user.id])
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// ── Anime list роуты ─────────────────────────────

// Получить список пользователя
app.get('/list', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM anime_list WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Добавить аниме в список
app.post('/list', auth, async (req, res) => {
  const { anime_id, title, image, episodes, status, score } = req.body
  try {
    const result = await pool.query(`
      INSERT INTO anime_list (user_id, anime_id, title, image, episodes, status, score)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, anime_id) DO NOTHING
      RETURNING *
    `, [req.user.id, anime_id, title, image, episodes, status || 'planning', score || null])

    if (!result.rows[0]) {
      return res.status(409).json({ error: 'Anime already in your list' })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('Add anime error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Обновить статус / оценку
app.patch('/list/:anime_id', auth, async (req, res) => {
  const { status, score, watched_episodes } = req.body
  try {
    const result = await pool.query(`
      UPDATE anime_list
      SET status = COALESCE($1, status),
          score = COALESCE($2, score),
          watched_episodes = COALESCE($3, watched_episodes)
      WHERE user_id = $4 AND anime_id = $5
      RETURNING *
    `, [status, score, watched_episodes, req.user.id, req.params.anime_id])
    
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Удалить из списка
app.delete('/list/:anime_id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM anime_list WHERE user_id = $1 AND anime_id = $2',
      [req.user.id, req.params.anime_id]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Статистика пользователя
app.get('/stats', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'watching')::int   AS watching,
        COUNT(*) FILTER (WHERE status = 'completed')::int  AS completed,
        COUNT(*) FILTER (WHERE status = 'planning')::int   AS planning,
        COUNT(*) FILTER (WHERE status = 'dropped')::int    AS dropped,
        COALESCE(ROUND(AVG(score) FILTER (WHERE score IS NOT NULL), 1)::float, 0) AS avg_score,
        COALESCE(SUM(watched_episodes), 0)::int AS total_episodes
      FROM anime_list WHERE user_id = $1
    `, [req.user.id])
    res.json(result.rows[0])
  } catch (err) {
    console.error('Stats error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

app.get('/ping', (req, res) => res.send('ok'))

// ── Прокси для поиска аниме (AniList GraphQL -> Jikan Fallback) ──
app.get('/api/anime/search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.json({ data: [] })

  // 1. Основниой источник — AniList GraphQL (работает моментально)
  try {
    const query = `
      query ($search: String) {
        Page(perPage: 12) {
          media(search: $search, type: ANIME) {
            id
            title { romaji english native }
            coverImage { large }
            episodes
          }
        }
      }
    `
    const aniListRes = await axios.post('https://graphql.anilist.co', {
      query,
      variables: { search: q }
    }, { timeout: 5000 })

    // Мапим данные под формат Jikan/Tenrai, который ожидает фронтенд
    const formattedData = aniListRes.data.data.Page.media.map(item => ({
      mal_id: item.id,
      title: item.title.romaji || item.title.english || item.title.native,
      images: { jpg: { image_url: item.coverImage.large } },
      episodes: item.episodes
    }))

    return res.json({ data: formattedData })
  } catch (err) {
    console.error('AniList search failed:', err.message)
  }

  // 2. Фоллбэк — Jikan API
  try {
    const jikanRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=12`, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    return res.json(jikanRes.data)
  } catch (jikanErr) {
    console.error('Jikan search failed too:', jikanErr.message)
    return res.status(502).json({ error: 'All anime services unavailable' })
  }
})

// ── Прокси для получения аниме по ID ─────────────
app.get('/api/anime/:id', async (req, res) => {
  const { id } = req.params
  try {
    const response = await axios.get(`https://api.tenrai.co/v1/anime/${id}`, { timeout: 5000 })
    return res.json(response.data)
  } catch (err) {
    try {
      const fallback = await axios.get(`https://api.jikan.moe/v4/anime/${id}`, { timeout: 5000 })
      return res.json(fallback.data)
    } catch (jikanErr) {
      return res.status(502).json({ error: 'Failed to fetch anime details' })
    }
  }
})

initDB().then(() => {
  const PORT = process.env.PORT || 3002
  app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`))
})