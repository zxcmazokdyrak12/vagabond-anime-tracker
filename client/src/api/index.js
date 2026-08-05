import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3002',
})

// Автоматически добавляем токен к каждому запросу
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auth
export const register = (data) => api.post('/auth/register', data)
export const login    = (data) => api.post('/auth/login', data)
export const getMe    = ()     => api.get('/auth/me')

// Anime list
export const getList    = ()           => api.get('/list')
export const addAnime   = (data)       => api.post('/list', data)
export const updateAnime = (id, data)  => api.patch(`/list/${id}`, data)
export const deleteAnime = (id)        => api.delete(`/list/${id}`)
export const getStats   = ()           => api.get('/stats')

// Jikan API — поиск аниме (прямо с фронта, это публичный API)
export const searchAnime = (query) =>
  axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12`)

export const getAnimeById = (id) =>
  axios.get(`https://api.jikan.moe/v4/anime/${id}`)