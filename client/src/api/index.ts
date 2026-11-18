import axios from 'axios'
import type {
  Anime, AuthResponse, Character, Episode, ListEntry, ListPatch, NewListEntry, Paged, Stats, User,
} from '../types'

// Локально: создай client/.env с VITE_API_URL=http://localhost:3002
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://vagabond-anime-tracker.onrender.com',
})

// Автоматически добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Если токен протух — разлогиниваем, а не показываем пустой список
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

// Auth
export const register = (data: { username: string; email: string; password: string }) =>
  api.post<AuthResponse>('/auth/register', data)
export const login = (data: { email: string; password: string }) => api.post<AuthResponse>('/auth/login', data)
export const getMe = () => api.get<User>('/auth/me')

// Свитки
export const getList = () => api.get<ListEntry[]>('/list')
export const addAnime = (data: NewListEntry) => api.post<ListEntry>('/list', data)
export const updateAnime = (id: number, data: ListPatch) => api.patch<ListEntry>(`/list/${id}`, data)
export const deleteAnime = (id: number) => api.delete<{ success: true }>(`/list/${id}`)
export const getStats = () => api.get<Stats>('/stats')

// Каталог — всё через наш сервер: там кеш и очередь под лимиты Jikan
export const searchAnime = (query: string) => api.get<Paged<Anime>>('/api/anime/search', { params: { q: query } })
export const getTopAnime = () => api.get<Paged<Anime>>('/api/anime/top')
export const getSeasonNow = () => api.get<Paged<Anime>>('/api/anime/season')
export const getAnimeFull = (id: number | string) => api.get<{ data: Anime }>(`/api/anime/${id}`)
export const getAnimeCharacters = (id: number | string) => api.get<Paged<Character>>(`/api/anime/${id}/characters`)
export const getAnimeEpisodes = (id: number | string) => api.get<Paged<Episode>>(`/api/anime/${id}/episodes`)

/** HTTP-статус ошибки запроса или 'network', если ответа не было */
export const errorStatus = (err: unknown): number | 'network' =>
  axios.isAxiosError(err) && err.response ? err.response.status : 'network'
