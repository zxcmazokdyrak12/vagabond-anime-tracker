import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  getList, getStats, searchAnime, addAnime, updateAnime, deleteAnime, getTopAnime, getSeasonNow,
} from '../api'
import { errorStatus } from '../api'
import Masthead, { type TabId } from '../components/Masthead'
import GateView, { type DiscoverState } from './tracker/GateView'
import ScrollsView from './tracker/ScrollsView'
import PathView from './tracker/PathView'
import SearchView, { type SearchState } from './tracker/SearchView'
import { posterOf } from '../lib/status'
import { ImportButton } from '../components/ImportDialog'
import ShareProfile from '../components/ShareProfile'
import type { Anime, ListEntry, ListPatch, Stats, User } from '../types'

const TAB_IDS: TabId[] = ['gate', 'scrolls', 'path', 'search']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Props {
  user: User
  onLogout: () => void
  onUserChange: (user: User) => void
}

export default function TrackerPage({ user, onLogout, onUserChange }: Props) {
  // Вкладка и запрос живут в URL — «Назад» со страницы тайтла возвращает туда же
  const [params] = useSearchParams()
  const tabParam = params.get('tab') as TabId | null
  const tab: TabId = tabParam && TAB_IDS.includes(tabParam) ? tabParam : 'scrolls'
  const query = (params.get('q') || '').trim()

  const [list, setList] = useState<ListEntry[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [stampId, setStampId] = useState<number | null>(null)

  // ── Свитки и статистика ────────────────────────────────
  const loadList = useCallback(async () => {
    try {
      const res = await getList()
      setList(res.data)
    } catch (err) {
      console.error('Failed to load list:', err)
    } finally {
      setListLoaded(true)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const res = await getStats()
      setStats(res.data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getList()
      .then((res) => {
        if (!cancelled) setList(res.data)
      })
      .catch((err) => console.error('Failed to load list:', err))
      .finally(() => {
        if (!cancelled) setListLoaded(true)
      })
    getStats()
      .then((res) => {
        if (!cancelled) setStats(res.data)
      })
      .catch((err) => console.error('Failed to load stats:', err))
    return () => { cancelled = true }
  }, [])

  const inListIds = useMemo(() => new Set(list.map((a) => a.anime_id)), [list])

  // ── Врата: топ и сезон (грузим один раз при первом заходе) ──
  const [discover, setDiscover] = useState<DiscoverState>({ status: 'idle', top: [], season: [] })
  const discoverInFlight = useRef(false)

  useEffect(() => {
    if (tab !== 'gate' || discover.status !== 'idle' || discoverInFlight.current) return
    discoverInFlight.current = true
    ;(async () => {
      try {
        // Очередь под лимиты каталогов и кеш — на сервере, поэтому можно параллельно
        const [topRes, seasonRes] = await Promise.all([getTopAnime(), getSeasonNow()])
        setDiscover({ status: 'done', top: topRes.data.data.slice(0, 10), season: seasonRes.data.data.slice(0, 12) })
      } catch (err) {
        console.error('Failed to load discover:', err)
        setDiscover((d) => ({ ...d, status: 'error' }))
      } finally {
        discoverInFlight.current = false
      }
    })()
  }, [tab, discover.status])

  // ── Поиск: запускается от ?q= в адресе, до 3 попыток при 429/5xx ──
  const [retryNonce, setRetryNonce] = useState(0)
  const searchKey = `${query}#${retryNonce}`
  const [search, setSearch] = useState<SearchState>({ key: null, results: [], error: null })
  const searching = tab === 'search' && Boolean(query) && search.key !== searchKey

  useEffect(() => {
    if (tab !== 'search' || !query) return
    let cancelled = false
    ;(async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await searchAnime(query)
          if (!cancelled) setSearch({ key: searchKey, results: res.data.data || [], error: null })
          return
        } catch (err) {
          const status = errorStatus(err)
          if (typeof status === 'number' && [429, 502, 503, 504].includes(status) && attempt < 3) {
            await sleep(1200 * attempt)
            if (cancelled) return
            continue
          }
          if (!cancelled) setSearch({ key: searchKey, results: [], error: status })
          return
        }
      }
    })()
    return () => { cancelled = true }
  }, [tab, query, searchKey])

  // ── Действия со свитками ───────────────────────────────
  const handleAdd = async (anime: Anime) => {
    if (inListIds.has(anime.mal_id)) return
    setStampId(anime.mal_id)
    try {
      await addAnime({
        anime_id: anime.mal_id,
        title: anime.title,
        image: posterOf(anime),
        episodes: anime.episodes,
        status: 'planning',
      })
      await Promise.all([loadList(), loadStats()])
    } catch (err) {
      console.error('Failed to add anime:', err)
    } finally {
      setTimeout(() => setStampId(null), 700)
    }
  }

  const handleUpdate = async (animeId: number, data: ListPatch) => {
    // Досмотрел последнюю серию — сразу помечаем как «完 completed»
    const current = list.find((item) => item.anime_id === animeId)
    if (
      current?.episodes &&
      data.watched_episodes !== undefined &&
      data.watched_episodes >= current.episodes &&
      current.status !== 'completed'
    ) {
      data = { ...data, status: 'completed' }
    }

    // Оптимистичное обновление, затем синхронизация с ответом сервера
    setList((prev) => prev.map((item) => (item.anime_id === animeId ? { ...item, ...data } : item)))
    try {
      const res = await updateAnime(animeId, data)
      setList((prev) => prev.map((item) => (item.anime_id === animeId ? res.data : item)))
      await loadStats()
    } catch (err) {
      console.error('Failed to update:', err)
      await loadList()
    }
  }

  const handleDelete = async (entry: ListEntry) => {
    if (!window.confirm(`Remove “${entry.title}” from your scrolls? Its progress and score will be lost.`)) return
    setList((prev) => prev.filter((item) => item.anime_id !== entry.anime_id))
    try {
      await deleteAnime(entry.anime_id)
      await loadStats()
    } catch (err) {
      console.error('Failed to delete:', err)
      await loadList()
    }
  }

  return (
    <>
      <Masthead
        user={user}
        onLogout={onLogout}
        activeTab={tab}
        initialQuery={query}
        scrollCount={list.length}
      />

      <main className="page">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'gate' && (
              <GateView
                discover={discover}
                onRetry={() => setDiscover((d) => ({ ...d, status: 'idle' }))}
                inListIds={inListIds}
                stampId={stampId}
                onAdd={handleAdd}
              />
            )}
            {tab === 'scrolls' && (
              <ScrollsView
                list={list}
                loaded={listLoaded}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                importSlot={<ImportButton onImported={() => Promise.all([loadList(), loadStats()])} />}
              />
            )}
            {tab === 'path' && (
              <PathView stats={stats} footer={<ShareProfile user={user} onUserChange={onUserChange} />} />
            )}
            {tab === 'search' && (
              <SearchView
                query={query}
                search={search}
                loading={searching}
                onRetry={() => setRetryNonce((n) => n + 1)}
                inListIds={inListIds}
                stampId={stampId}
                onAdd={handleAdd}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  )
}
