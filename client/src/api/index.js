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
export const getList     = ()          => api.get('/list')
export const addAnime    = (data)      => api.post('/list', data)
export const updateAnime = (id, data)  => api.patch(`/list/${id}`, data)
export const deleteAnime = (id)        => api.delete(`/list/${id}`)
export const getStats    = ()          => api.get('/stats')

// Anime External Search / Details (через прокси нашего бэкенда)
export const searchAnime = (query) =>
  api.get(`/api/anime/search?q=${encodeURIComponent(query)}`)

export const getAnimeById = (id) =>
  api.get(`/api/anime/${id}`)

export const getTopAnime = () =>
  axios.get(`https://api.jikan.moe/v4/top/anime?limit=10`)

export const getSeasonNow = () =>
  axios.get(`https://api.jikan.moe/v4/seasons/now?limit=8`)

export const getAnimeFull = (id) =>
  axios.get(`https://api.jikan.moe/v4/anime/${id}/full`)

export const getAnimeCharacters = (id) =>
  axios.get(`https://api.jikan.moe/v4/anime/${id}/characters`)

export const getAnimeEpisodes = (id) =>
  axios.get(`https://api.jikan.moe/v4/anime/${id}/episodes`)