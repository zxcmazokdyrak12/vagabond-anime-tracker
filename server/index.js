import express from 'express'
import cors from 'cors'
import pg from 'pg'
import bodyParser from 'body-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import 'dotenv/config'

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
  // anime_id — это id из Jikan API (MyAnimeList)
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
// Эта функция будет защищать приватные роуты
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
  console.log('body:', req.body)  
  console.log('headers:', req.headers['content-type'])
  const { username, email, password } = req.body
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' })

  try {
    // Хешируем пароль — никогда не храним в открытом виде
    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    )
    const user = result.rows[0]
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user })
  } catch (err) {
    console.log('Register error:', err)
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

    // Сравниваем пароль с хешем
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: 'Wrong password' })

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// Проверка токена
app.get('/auth/me', auth, async (req, res) => {
  const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.user.id])
  res.json(result.rows[0])
})

// ── Anime list роуты ─────────────────────────────

// Получить список пользователя
app.get('/list', auth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM anime_list WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  )
  res.json(result.rows)
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
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// Обновить статус / оценку
app.patch('/list/:anime_id', auth, async (req, res) => {
  const { status, score, watched_episodes } = req.body
  const result = await pool.query(`
    UPDATE anime_list
    SET status = COALESCE($1, status),
        score = COALESCE($2, score),
        watched_episodes = COALESCE($3, watched_episodes)
    WHERE user_id = $4 AND anime_id = $5
    RETURNING *
  `, [status, score, watched_episodes, req.user.id, req.params.anime_id])
  res.json(result.rows[0])
})

// Удалить из списка
app.delete('/list/:anime_id', auth, async (req, res) => {
  await pool.query(
    'DELETE FROM anime_list WHERE user_id = $1 AND anime_id = $2',
    [req.user.id, req.params.anime_id]
  )
  res.json({ success: true })
})

// Статистика пользователя
app.get('/stats', auth, async (req, res) => {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'watching')   AS watching,
      COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
      COUNT(*) FILTER (WHERE status = 'planning')   AS planning,
      COUNT(*) FILTER (WHERE status = 'dropped')    AS dropped,
      ROUND(AVG(score) FILTER (WHERE score IS NOT NULL), 1) AS avg_score,
      SUM(watched_episodes) AS total_episodes
    FROM anime_list WHERE user_id = $1
  `, [req.user.id])
  res.json(result.rows[0])
})

app.get('/ping', (req, res) => res.send('ok'))

initDB().then(() => {
  const PORT = process.env.PORT || 3002
  app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`))
})