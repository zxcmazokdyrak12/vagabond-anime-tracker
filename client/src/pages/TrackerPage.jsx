import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getList, getStats, searchAnime, addAnime, updateAnime, deleteAnime, getTopAnime, getSeasonNow } from '../api'

const STATUS_LABELS = {
  watching:  { label: '観', text: 'Watching',  color: '#4a9eff' },
  completed: { label: '完', text: 'Completed', color: '#4aff8a' },
  planning:  { label: '計', text: 'Planning',  color: '#aaa'    },
  dropped:   { label: '棄', text: 'Dropped',   color: '#ff4a4a' },
}

// Случайный (но стабильный) наклон карточки на основе её id
function tiltFor(id) {
  const n = typeof id === 'number' ? id : parseInt(id, 10) || 0
  return ((n % 7) - 3) * 0.15 // диапазон примерно -0.45deg .. 0.45deg
}

const containerStagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

function cardRise(rotate = 0) {
  return {
    hidden: { opacity: 0, scale: 0.95, y: 24, rotate: 0 },
    show: {
      opacity: 1, scale: 1, y: 0, rotate,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
  }
}

const tabFade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

function ZenSpinner({ label = 'SEEKING' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '60px 0' }}>
      <div className="zen-spinner-wrap">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="19" fill="none" stroke="#1c1c1c" strokeWidth="1" />
          <circle className="zen-dot" cx="26" cy="7" r="2.5" fill="#8b1a1a" />
        </svg>
      </div>
      <div style={{ fontSize: '10px', color: '#444', letterSpacing: '5px', fontFamily: 'Noto Serif JP, serif' }}>
        {label}
      </div>
    </div>
  )
}

// Мазок кисти под заголовком секции
function BrushLine() {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
      style={{
        height: '1px',
        width: '120px',
        background: 'linear-gradient(90deg, #8b1a1a, transparent)',
        transformOrigin: 'left',
        marginTop: '8px',
        marginBottom: '24px',
      }}
    />
  )
}

// Тихо плывущие вверх частицы пепла
function AshParticles() {
  const particles = [
    { left: '8%',  duration: 14, delay: 0   },
    { left: '18%', duration: 19, delay: 3   },
    { left: '32%', duration: 16, delay: 1.5 },
    { left: '47%', duration: 22, delay: 6   },
    { left: '61%', duration: 15, delay: 2   },
    { left: '76%', duration: 20, delay: 4.5 },
    { left: '90%', duration: 17, delay: 8   },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
      {particles.map((p, i) => (
        <div
          key={i}
          className="ash-particle"
          style={{
            left: p.left,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

function SectionMark({ title, jp }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
      <div style={{ width:'3px', height:'16px', background:'#8b1a1a' }} />
      <span style={{ fontSize:'11px', letterSpacing:'3px', fontFamily:'Noto Serif JP, serif' }}>{title}</span>
      {jp && <span style={{ fontSize:'12px', color:'#8b1a1a', fontFamily:'Noto Serif JP, serif' }}>{jp}</span>}
    </div>
  )
}

// Хиро-карусель на главной: блюр-фон, бейджи, тайтл, синопсис, CTA
function HeroCarousel({ anime, index, total, onPrev, onNext, onSelect, onAdd, inList }) {
  if (!anime) return null
  const bg = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url
  const synopsis = anime.synopsis
    ? anime.synopsis.slice(0, 180) + (anime.synopsis.length > 180 ? '…' : '')
    : ''

  const navBtnStyle = {
    width:'36px', height:'36px', borderRadius:'50%',
    background:'rgba(10,10,10,0.6)', border:'1px solid #333', color:'#f5f0e8',
    cursor:'pointer', fontSize:'16px',
  }

  return (
    <div style={{ position:'relative', width:'100%', height:'420px', overflow:'hidden', border:'1px solid #1a1a1a' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={anime.mal_id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position:'absolute', inset:0,
            backgroundImage: `url(${bg})`,
            backgroundSize:'cover', backgroundPosition:'center',
            filter:'grayscale(35%) brightness(0.55)',
          }}
        />
      </AnimatePresence>
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(90deg, rgba(10,10,10,0.95) 15%, rgba(10,10,10,0.4) 55%, transparent 100%), linear-gradient(0deg, rgba(10,10,10,0.9) 0%, transparent 45%)',
      }} />

      <div style={{ position:'absolute', left:'40px', bottom:'44px', maxWidth:'520px' }}>
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
          {anime.score && (
            <span style={{ background:'#8b1a1a', color:'#f5f0e8', fontSize:'10px', letterSpacing:'1px', padding:'4px 10px' }}>
              ★ {anime.score}
            </span>
          )}
          <span style={{ border:'1px solid #444', color:'#ccc', fontSize:'10px', letterSpacing:'1px', padding:'4px 10px' }}>
            {anime.type}{anime.year ? ` · ${anime.year}` : ''}
          </span>
        </div>
        <h2 style={{
          fontSize:'40px', fontWeight:'700', letterSpacing:'2px',
          fontFamily:'Noto Serif JP, serif', textTransform:'uppercase',
          marginBottom:'10px', textShadow:'0 4px 20px rgba(0,0,0,0.8)', lineHeight:1.1,
        }}>
          {anime.title}
        </h2>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'14px' }}>
          {(anime.genres || []).slice(0, 3).map(g => (
            <span key={g.mal_id} style={{ border:'1px solid #333', color:'#999', fontSize:'9px', letterSpacing:'1px', padding:'3px 9px' }}>
              {g.name}
            </span>
          ))}
        </div>
        <p style={{ fontSize:'12px', color:'#bbb', lineHeight:1.6, marginBottom:'20px' }}>{synopsis}</p>
        <button
          onClick={() => !inList && onAdd(anime)}
          className="btn-lift"
          style={{
            background: inList ? '#1a1a1a' : '#8b1a1a',
            color: inList ? '#555' : '#f5f0e8',
            border:'none', padding:'10px 24px', cursor: inList ? 'default' : 'pointer',
            fontSize:'11px', letterSpacing:'2px', fontFamily:'Noto Serif JP, serif',
          }}
        >
          {inList ? 'IN SCROLLS' : '+ ADD TO SCROLLS'}
        </button>
      </div>

      <div style={{ position:'absolute', right:'40px', bottom:'44px', display:'flex', gap:'8px' }}>
        <button onClick={onPrev} className="btn-lift" style={navBtnStyle}>‹</button>
        <button onClick={onNext} className="btn-lift" style={navBtnStyle}>›</button>
      </div>

      <div style={{ position:'absolute', left:'40px', top:'24px', display:'flex', gap:'6px' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            onClick={() => onSelect(i)}
            style={{
              width: i === index ? '22px' : '8px', height:'3px',
              background: i === index ? '#8b1a1a' : '#333',
              cursor:'pointer', transition:'width 0.25s',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Рейтинговый топ-лист сбоку
function TopList({ items, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((anime, i) => (
        <div
          key={anime.mal_id}
          onClick={() => onSelect(anime.mal_id)}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #161616', cursor: 'pointer' }}
        >
          <span style={{ fontSize:'14px', color:'#8b1a1a', fontFamily:'Noto Serif JP, serif', width:'22px', flexShrink:0 }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <img
            src={anime.images?.jpg?.image_url}
            alt={anime.title}
            style={{ width:'32px', height:'44px', objectFit:'cover', filter:'grayscale(30%)', flexShrink:0 }}
          />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'11px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {anime.title}
            </div>
            <div style={{ fontSize:'9px', color:'#555', letterSpacing:'1px' }}>{anime.type}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Интерактивный шлейф туши за курсором
function InkTrail() {
  const canvasRef = useRef(null)
  const posRef = useRef(null)
  const segmentsRef = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const handleMove = (e) => {
      const x = e.clientX
      const y = e.clientY
      if (posRef.current) {
        const { x: px, y: py } = posRef.current
        const dist = Math.hypot(x - px, y - py)

        if (segmentsRef.current.length > 80) {
          segmentsRef.current.shift()
        }

        segmentsRef.current.push({
          x1: px,
          y1: py,
          x2: x,
          y2: y,
          width: Math.max(1, 6 - dist * 0.25),
          time: performance.now(),
        })
      }
      posRef.current = { x, y }
    }
    window.addEventListener('mousemove', handleMove)

    const LIFETIME = 1000

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const now = performance.now()
      segmentsRef.current = segmentsRef.current.filter((s) => now - s.time < LIFETIME)

      for (const s of segmentsRef.current) {
        const age = now - s.time
        const t = age / LIFETIME
        const opacity = t < 0.6 ? 0.4 : 0.4 * (1 - (t - 0.6) / 0.4)

        ctx.strokeStyle = `rgba(245, 240, 232, ${opacity})`
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = s.width
        ctx.beginPath()
        ctx.moveTo(s.x1, s.y1)
        ctx.lineTo(s.x2, s.y2)
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998 }}
    />
  )
}

export default function TrackerPage({ user, onLogout }) {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'search' | 'stats'
  const [filter, setFilter] = useState('all')
  const [stampId, setStampId] = useState(null) // id карточки, на которой играет анимация печати
  const [slash, setSlash] = useState(false) // пасхалка: росчерк клинка
  const [discoverLoaded, setDiscoverLoaded] = useState(false)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState(null)
  const [heroList, setHeroList] = useState([])
  const [heroIndex, setHeroIndex] = useState(0)
  const [seasonList, setSeasonList] = useState([])
  const [topList, setTopList] = useState([])
  useEffect(() => {
    loadList()
    loadStats()
  }, [])

  const loadDiscover = async () => {
  setDiscoverLoading(true)
  setDiscoverError(null)
  try {
    const [topRes, seasonRes] = await Promise.all([getTopAnime(), getSeasonNow()])
    setTopList(topRes.data.data.slice(0, 10))
    setHeroList(topRes.data.data.slice(0, 5))
    setSeasonList(seasonRes.data.data.slice(0, 8))
    setDiscoverLoaded(true)
  } catch (err) {
    console.error('Failed to load discover:', err)
    setDiscoverError('The gate would not open — Jikan is unreachable right now.')
  }
  setDiscoverLoading(false)
}

useEffect(() => {
  if (activeTab === 'discover' && !discoverLoaded) loadDiscover()
}, [activeTab])

useEffect(() => {
  if (activeTab !== 'discover' || heroList.length === 0) return
  const id = setInterval(() => {
    setHeroIndex(i => (i + 1) % heroList.length)
  }, 6000)
  return () => clearInterval(id)
}, [activeTab, heroList])

  const loadList = async () => {
    try {
      const res = await getList()
      setList(res.data)
    } catch (err) {
      console.error('Failed to load list:', err)
    }
  }

  const loadStats = async () => {
    try {
      const res = await getStats()
      setStats(res.data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  const handleSearch = async (attempt = 1) => {
    if (!search.trim()) return

    // Пасхалка: musashi / vagabond — росчерк клинка по экрану
    if (attempt === 1) {
      const q = search.trim().toLowerCase()
      if (q === 'musashi' || q === 'vagabond') {
        setSlash(true)
        setTimeout(() => setSlash(false), 500)
      }
    }

    setSearching(true)
    setSearchError(null)
    setActiveTab('search')

    try {
      const res = await searchAnime(search)
      setResults(res.data.data)
      setSearching(false)
    } catch (err) {
      const status = err.response?.status
      if ((status === 504 || status === 502 || status === 503) && attempt < 3) {
        setTimeout(() => handleSearch(attempt + 1), 1200 * attempt)
        return
      }
      console.error('Search failed:', err)
      setResults([])
      setSearching(false)
      setSearchError(
        status === 429
          ? 'Rate limit — Jikan allows only 3 req/sec. Wait a moment and try again.'
          : status
          ? `Jikan is having trouble right now (${status}). Try again in a bit.`
          : 'Network error — check your connection.'
      )
    }
  }

  const handleAdd = async (anime) => {
    setStampId(anime.mal_id)
    try {
      await addAnime({
        anime_id: anime.mal_id,
        title: anime.title,
        image: anime.images?.jpg?.image_url,
        episodes: anime.episodes,
        status: 'planning',
      })
      await loadList()
      await loadStats()
    } catch (err) {
      console.error('Failed to add anime:', err)
    } finally {
      setTimeout(() => setStampId(null), 650)
    }
  }

  const handleUpdate = async (animeId, data) => {
    // Оптимистичное обновление интерфейса
    setList((prev) =>
      prev.map((item) => (item.id === animeId ? { ...item, ...data } : item))
    )

    try {
      await updateAnime(animeId, data)
      await loadStats()
    } catch (err) {
      console.error('Failed to update:', err)
      await loadList() // Откатываем данные в случае ошибки
    }
  }

  const handleDelete = async (animeId) => {
    try {
      await deleteAnime(animeId)
      await loadList()
      await loadStats()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const filteredList = filter === 'all' ? list : list.filter((a) => a.status === filter)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d0d',
        color: '#f5f0e8',
        fontFamily: 'Georgia, serif',
        position: 'relative',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #8b1a1a; }
        
        .search-input {
          background: transparent;
          border: none;
          border-bottom: 1px solid #333;
          color: #f5f0e8;
          font-family: 'Noto Serif JP', serif;
          font-size: 14px;
          padding: 8px 0;
          outline: none;
          width: 100%;
          letter-spacing: 1px;
        }
        .search-input:focus { border-bottom-color: #8b1a1a; }
        .search-input::placeholder { color: #444; }

        .btn-lift {
          transition: transform 0.2s ease, filter 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
        }
        .btn-lift:hover {
          transform: translateY(-2px);
          filter: brightness(1.25);
        }
        .btn-lift:active {
          transform: translateY(0);
          filter: brightness(1);
        }

        @keyframes breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .glyph-breathe {
          display: inline-block;
          animation: breathe 3s ease-in-out infinite;
        }

        @keyframes wobble {
          0%   { transform: scale(1.05) rotate(0deg); }
          25%  { transform: scale(1.05) rotate(-4deg); }
          60%  { transform: scale(1.05) rotate(3deg); }
          100% { transform: scale(1.05) rotate(0deg); }
        }
        .glyph-hover {
          display: inline-block;
          transition: transform 0.25s ease;
          cursor: default;
        }
        .glyph-hover:hover {
          animation: wobble 0.6s ease-in-out;
        }

        .zen-spinner-wrap svg {
          animation: brushRotate 1.8s linear infinite;
          transform-origin: 50% 50%;
        }
        @keyframes brushRotate { to { transform: rotate(360deg); } }
        .zen-dot { animation: brushPulse 1.2s ease-in-out infinite; transform-origin: 26px 26px; }
        @keyframes brushPulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }

        /* Текстура: зерно + виньетка */
        .grain-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          background-image: radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 3px 3px;
        }
        .vignette-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.5) 100%);
        }

        /* Частицы пепла */
        .ash-particle {
          position: absolute;
          bottom: -10px;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: #8b1a1a;
          opacity: 0;
          animation-name: ashDrift;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes ashDrift {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          8%   { opacity: 0.6; }
          85%  { opacity: 0.25; }
          100% { transform: translateY(-105vh) translateX(24px); opacity: 0; }
        }

        /* Содержимое поверх текстурных слоёв */
        .content-layer { position: relative; z-index: 2; }
      `}</style>

      <div className="grain-layer" />
      <div className="vignette-layer" />
      <AshParticles />
      <InkTrail />

      {/* Пасхалка: росчерк клинка */}
      <AnimatePresence>
        {slash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              pointerEvents: 'none',
              background:
                'linear-gradient(105deg, transparent 44%, rgba(245,240,232,0.85) 49%, rgba(245,240,232,0.85) 50%, transparent 55%)',
            }}
          />
        )}
      </AnimatePresence>

      <div className="content-layer">
        {/* Шапка */}
        <div
          style={{
            padding: '20px 40px',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#0a0a0a',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '10px',
                color: '#8b1a1a',
                letterSpacing: '6px',
                fontFamily: 'Noto Serif JP, serif',
                marginBottom: '4px',
              }}
            >
              アニメ追跡
            </div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: '300',
                letterSpacing: '4px',
                fontFamily: 'Noto Serif JP, serif',
              }}
            >
              VAGABOND TRACKER
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <span style={{ fontSize: '12px', color: '#555', letterSpacing: '2px' }}>
              {user?.username}
            </span>
            <button
              onClick={onLogout}
              className="btn-lift"
              style={{
                background: 'none',
                border: '1px solid #222',
                color: '#555',
                padding: '6px 16px',
                cursor: 'pointer',
                fontSize: '11px',
                letterSpacing: '2px',
                fontFamily: 'Noto Serif JP, serif',
              }}
            >
              LEAVE
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', height: 'calc(100vh - 73px)' }}>
          {/* Сайдбар */}
          <div
            style={{
              width: '220px',
              borderRight: '1px solid #1a1a1a',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            {/* Поиск */}
            <div style={{ marginBottom: '24px' }}>
              <input
                className="search-input"
                placeholder="Search anime..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  if (searchError) setSearchError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={() => handleSearch()}
                className="btn-lift"
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '8px',
                  background: '#8b1a1a',
                  color: '#f5f0e8',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  letterSpacing: '3px',
                  fontFamily: 'Noto Serif JP, serif',
                }}
              >
                SEEK
              </button>
            </div>

            {/* Навигация */}
            {[
           { id: 'discover', label: 'THE GATE', jp: '門' },
           { id: 'list', label: 'MY SCROLLS', jp: '一覧' },
           { id: 'stats', label: 'THE PATH', jp: '統計' },
              ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="btn-lift"
                style={{
                  background: activeTab === tab.id ? '#1a1a1a' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === tab.id ? '2px solid #8b1a1a' : '2px solid transparent',
                  color: activeTab === tab.id ? '#f5f0e8' : '#444',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '11px',
                  letterSpacing: '2px',
                  fontFamily: 'Noto Serif JP, serif',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                {tab.label}
                <span style={{ fontSize: '14px', color: activeTab === tab.id ? '#8b1a1a' : '#333' }}>
                  {tab.jp}
                </span>
              </button>
            ))}

            {/* Фильтры списка */}
            {activeTab === 'list' && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div
                  style={{
                    fontSize: '9px',
                    color: '#333',
                    letterSpacing: '3px',
                    marginBottom: '8px',
                    paddingLeft: '16px',
                  }}
                >
                  FILTER
                </div>
                {[
                  ['all', 'ALL', '全'],
                  ...Object.entries(STATUS_LABELS).map(([k, v]) => [k, v.text.toUpperCase(), v.label]),
                ].map(([id, text, jp]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className="btn-lift"
                    style={{
                      background: filter === id ? '#1a1a1a' : 'transparent',
                      border: 'none',
                      color: filter === id ? '#f5f0e8' : '#444',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '10px',
                      letterSpacing: '2px',
                      fontFamily: 'Noto Serif JP, serif',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    {text}{' '}
                    <span style={{ color: STATUS_LABELS[id]?.color || '#555' }}>{jp}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Основной контент */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={tabFade}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >

              {activeTab === 'discover' && (
  <div>
    {discoverLoading && heroList.length === 0 ? (
      <ZenSpinner label="OPENING THE GATE" />
    ) : discoverError ? (
      <div style={{ textAlign:'center', padding:'60px 0', color:'#8b1a1a', fontSize:'12px', letterSpacing:'1px' }}>
        {discoverError}
      </div>
    ) : (
      <>
        <HeroCarousel
          anime={heroList[heroIndex]}
          index={heroIndex}
          total={heroList.length}
          onPrev={() => setHeroIndex(i => (i - 1 + heroList.length) % heroList.length)}
          onNext={() => setHeroIndex(i => (i + 1) % heroList.length)}
          onSelect={setHeroIndex}
          onAdd={handleAdd}
          inList={!!list.find(a => a.anime_id === heroList[heroIndex]?.mal_id)}
        />

        <div style={{ display:'grid', gridTemplateColumns:'2.2fr 1fr', gap:'40px', marginTop:'48px' }}>
          <div>
            <SectionMark title="IN SEASON" jp="今季" />
            <motion.div
              variants={containerStagger}
              initial="hidden"
              animate="show"
              style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:'16px' }}
            >
              {seasonList.map(anime => {
  const inListItem = list.find(a => a.anime_id === anime.mal_id)
  return (
    <motion.div key={anime.mal_id} variants={cardRise(tiltFor(anime.mal_id))}>
      <div style={{ position:'relative' }}>
        <img
          src={anime.images?.jpg?.image_url}
          alt={anime.title}
          onClick={() => navigate(`/anime/${anime.mal_id}`)}
          style={{ width:'100%', aspectRatio:'2/3', objectFit:'cover', filter:'grayscale(20%)' }}
        />
                      {anime.score && (
                        <span style={{ position:'absolute', top:'6px', left:'6px', background:'rgba(10,10,10,0.8)', color:'#f5d76e', fontSize:'10px', padding:'2px 6px' }}>
                          ★ {anime.score}
                        </span>
                      )}
                    </div>
                    <div style={{ padding:'8px 0' }}>
                      <div style={{ fontSize:'11px', lineHeight:1.3, marginBottom:'6px' }}>{anime.title}</div>
                      <button
                        onClick={() => !inListItem && handleAdd(anime)}
                        className="btn-lift"
                        style={{
                          width:'100%', padding:'6px', fontSize:'9px', letterSpacing:'1.5px',
                          background: inListItem ? '#1a1a1a' : '#8b1a1a',
                          color: inListItem ? '#444' : '#f5f0e8',
                          border:'none', cursor: inListItem ? 'default' : 'pointer',
                          fontFamily:'Noto Serif JP, serif',
                        }}
                      >
                        {inListItem ? 'IN LIST' : '+ ADD'}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>

          <div>
            <SectionMark title="TOP ANIME" jp="頂点" />
            <TopList items={topList} onSelect={(id) => navigate(`/anime/${id}`)} />
          </div>
        </div>
      </>
    )}
  </div>
)}

                {/* Вкладка: Результаты поиска */}
                {activeTab === 'search' && (
                  <div>
                    <div style={{ fontSize: '10px', color: '#555', letterSpacing: '4px' }}>
                      SEARCH RESULTS — {results.length} FOUND
                    </div>
                    <BrushLine />
                    {searching ? (
                      <ZenSpinner />
                    ) : searchError ? (
                      <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <div
                          style={{
                            color: '#8b1a1a',
                            fontSize: '12px',
                            letterSpacing: '1px',
                            marginBottom: '16px',
                          }}
                        >
                          {searchError}
                        </div>
                        <button
                          onClick={() => handleSearch()}
                          className="btn-lift"
                          style={{
                            background: '#1a1a1a',
                            border: '1px solid #333',
                            color: '#f5f0e8',
                            padding: '8px 20px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            letterSpacing: '2px',
                            fontFamily: 'Noto Serif JP, serif',
                          }}
                        >
                          RETRY
                        </button>
                      </div>
                    ) : (
                      <motion.div
                        variants={containerStagger}
                        initial="hidden"
                        animate="show"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                          gap: '20px',
                        }}
                      >
                        {results.map((anime) => {
                          const inList = list.find((a) => a.anime_id === anime.mal_id)
                          return (
                            <motion.div
                              key={anime.mal_id}
                              variants={cardRise(tiltFor(anime.mal_id))}
                              style={{ position: 'relative' }}
                            >
                              <img
                              src={anime.images?.jpg?.image_url}
                              alt={anime.title}
                                onClick={() => navigate(`/anime/${anime.mal_id}`)}
                              style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block', filter: 'grayscale(20%)', cursor: 'pointer' }}
                                />

                              {/* Печать при добавлении */}
                              <AnimatePresence>
                                {stampId === anime.mal_id && (
                                  <motion.div
                                    initial={{ scale: 2.2, opacity: 0, rotate: -20 }}
                                    animate={{ scale: 1, opacity: 1, rotate: -8 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                    style={{
                                      position: 'absolute',
                                      top: '40%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      width: '56px',
                                      height: '56px',
                                      borderRadius: '50%',
                                      border: '2px solid #8b1a1a',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#8b1a1a',
                                      fontFamily: 'Noto Serif JP, serif',
                                      fontSize: '18px',
                                      background: 'rgba(10,10,10,0.55)',
                                      pointerEvents: 'none',
                                    }}
                                  >
                                    録
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div style={{ padding: '10px 0' }}>
                                <div
                                  style={{
                                    fontSize: '12px',
                                    letterSpacing: '0.5px',
                                    marginBottom: '4px',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {anime.title}
                                </div>
                                <div style={{ fontSize: '10px', color: '#555', letterSpacing: '1px' }}>
                                  {anime.episodes || '?'} ep
                                </div>
                              </div>
                              <button
                                onClick={() => (inList ? null : handleAdd(anime))}
                                className="btn-lift"
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  background: inList ? '#1a1a1a' : '#8b1a1a',
                                  color: inList ? '#444' : '#f5f0e8',
                                  border: 'none',
                                  cursor: inList ? 'default' : 'pointer',
                                  fontSize: '10px',
                                  letterSpacing: '2px',
                                  fontFamily: 'Noto Serif JP, serif',
                                }}
                              >
                                {inList ? 'IN LIST' : '+ ADD'}
                              </button>
                            </motion.div>
                          )
                        })}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Вкладка: Список свитков */}
                {activeTab === 'list' && (
                  <div>
                    <div style={{ fontSize: '10px', color: '#555', letterSpacing: '4px' }}>
                      MY SCROLLS — {filteredList.length} TITLES
                    </div>
                    <BrushLine />
                    {filteredList.length === 0 ? (
                      <div
                        style={{
                          color: '#2a2a2a',
                          fontSize: '48px',
                          fontFamily: 'Noto Serif JP, serif',
                          textAlign: 'center',
                          marginTop: '80px',
                        }}
                      >
                        空
                      </div>
                    ) : (
                      <motion.div
                        variants={containerStagger}
                        initial="hidden"
                        animate="show"
                        style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
                      >
                        {filteredList.map((anime) => (
                          <motion.div
                            key={anime.id}
                            variants={cardRise(tiltFor(anime.id))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '16px',
                              padding: '12px 16px',
                              borderBottom: '1px solid #111',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#111')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <img
  src={anime.image}
  alt={anime.title}
  onClick={() => navigate(`/anime/${anime.anime_id}`)}
  style={{ width: '36px', height: '52px', objectFit: 'cover', flexShrink: 0, filter: 'grayscale(30%)', cursor: 'pointer' }}
/>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  letterSpacing: '0.5px',
                                  marginBottom: '4px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {anime.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: '#555', letterSpacing: '1px' }}>
                                  {anime.watched_episodes || 0} / {anime.episodes || '?'} ep
                                </span>
                                {anime.episodes && (anime.watched_episodes || 0) < anime.episodes && (
                                  <button
                                    onClick={() =>
                                      handleUpdate(anime.anime_id, {
                                        watched_episodes: (anime.watched_episodes || 0) + 1,
                                      })
                                    }
                                    className="btn-lift"
                                    style={{
                                      background: '#1a1a1a',
                                      border: '1px solid #333',
                                      color: '#f5f0e8',
                                      padding: '2px 6px',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                      fontFamily: 'Noto Serif JP, serif',
                                    }}
                                  >
                                    +1
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Статус */}
                            <select
                              value={anime.status}
                              onChange={(e) => handleUpdate(anime.anime_id, { status: e.target.value })}
                              style={{
                                background: '#111',
                                border: '1px solid #222',
                                color: STATUS_LABELS[anime.status]?.color,
                                padding: '4px 8px',
                                fontSize: '10px',
                                letterSpacing: '2px',
                                fontFamily: 'Noto Serif JP, serif',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            >
                              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label} {v.text}
                                </option>
                              ))}
                            </select>

                            {/* Оценка */}
                            <select
                              value={anime.score || ''}
                              onChange={(e) =>
                                handleUpdate(anime.anime_id, { score: e.target.value || null })
                              }
                              style={{
                                background: '#111',
                                border: '1px solid #222',
                                color: '#f5f0e8',
                                padding: '4px 8px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                outline: 'none',
                                width: '60px',
                              }}
                            >
                              <option value="">—</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>

                            {/* Удалить */}
                            <button
                              onClick={() => handleDelete(anime.anime_id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#333',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '4px 8px',
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => (e.target.style.color = '#8b1a1a')}
                              onMouseLeave={(e) => (e.target.style.color = '#333')}
                            >
                              ✕
                            </button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Вкладка: Статистика */}
                {activeTab === 'stats' && stats && (
                  <div>
                    <div style={{ fontSize: '10px', color: '#555', letterSpacing: '4px' }}>
                      THE PATH SO FAR
                    </div>
                    <BrushLine />
                    <motion.div
                      variants={containerStagger}
                      initial="hidden"
                      animate="show"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '2px',
                        maxWidth: '600px',
                      }}
                    >
                      {[
                        { label: 'WATCHING', value: stats.watching, jp: '観', color: '#4a9eff' },
                        { label: 'COMPLETED', value: stats.completed, jp: '完', color: '#4aff8a' },
                        { label: 'PLANNING', value: stats.planning, jp: '計', color: '#aaa' },
                        { label: 'DROPPED', value: stats.dropped, jp: '棄', color: '#ff4a4a' },
                        { label: 'AVG SCORE', value: stats.avg_score || '—', jp: '点', color: '#f5d76e' },
                        { label: 'EPISODES', value: stats.total_episodes || 0, jp: '話', color: '#f5f0e8' },
                      ].map((s) => (
                        <motion.div
                          key={s.label}
                          variants={cardRise(0)}
                          style={{
                            padding: '32px 24px',
                            background: '#0f0f0f',
                            borderBottom: '2px solid #1a1a1a',
                            textAlign: 'center',
                          }}
                        >
                          <div className="glyph-breathe">
                            <div
                              className="glyph-hover"
                              style={{
                                fontSize: '48px',
                                color: s.color,
                                fontFamily: 'Noto Serif JP, serif',
                                marginBottom: '8px',
                              }}
                            >
                              {s.jp}
                            </div>
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: '300', marginBottom: '8px' }}>
                            {s.value}
                          </div>
                          <div style={{ fontSize: '9px', color: '#444', letterSpacing: '3px' }}>
                            {s.label}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}