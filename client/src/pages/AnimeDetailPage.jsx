import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getAnimeFull, getAnimeCharacters, getAnimeEpisodes, getList, addAnime } from '../api'

function ZenSpinner({ label = 'CONSULTING THE ARCHIVES' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'18px', padding:'140px 0' }}>
      <div className="zen-spinner-wrap">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="19" fill="none" stroke="#1c1c1c" strokeWidth="1" />
          <circle className="zen-dot" cx="26" cy="7" r="2.5" fill="#8b1a1a" />
        </svg>
      </div>
      <div style={{ fontSize:'10px', color:'#444', letterSpacing:'5px', fontFamily:'Noto Serif JP, serif' }}>{label}</div>
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

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}
const containerStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

export default function AnimeDetailPage({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [anime, setAnime] = useState(null)
  const [characters, setCharacters] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inList, setInList] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
  let cancelled = false

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const fetchWithRetry = async (fn, attempts = 3) => {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn()
      } catch (err) {
        const status = err.response?.status
        if ((status === 429 || status === 502 || status === 503 || status === 504) && i < attempts - 1) {
          await sleep(1000 * (i + 1))
          continue
        }
        throw err
      }
    }
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const listPromise = getList().catch(() => null)

      const fullRes = await fetchWithRetry(() => getAnimeFull(id))
      if (cancelled) return
      setAnime(fullRes.data.data)

      await sleep(600)
      const charRes = await fetchWithRetry(() => getAnimeCharacters(id), 4).catch(err => {
        console.error('Failed to load characters:', err.response?.status || err.message)
        return null
      })
      if (!cancelled && charRes) setCharacters(charRes.data.data.slice(0, 10))

      await sleep(400)
      const epsRes = await fetchWithRetry(() => getAnimeEpisodes(id)).catch(err => {
        console.error('Failed to load episodes:', err.response?.status || err.message)
        return null
      })
      if (!cancelled && epsRes) setEpisodes(epsRes.data.data.slice(0, 12))

      const listRes = await listPromise
      if (!cancelled && listRes) {
        setInList(!!listRes.data.find(a => a.anime_id === Number(id)))
      }
    } catch (err) {
      console.error('Failed to load anime:', err)
      if (!cancelled) setError('The archives would not open — Jikan is unreachable right now.')
    }
    if (!cancelled) setLoading(false)
  }

  load()
  return () => { cancelled = true }
}, [id])

  const handleAdd = async () => {
    if (!anime || inList) return
    setAdding(true)
    try {
      await addAnime({
        anime_id: anime.mal_id,
        title: anime.title,
        image: anime.images?.jpg?.image_url,
        episodes: anime.episodes,
        status: 'planning',
      })
      setInList(true)
    } catch (err) {
      console.error('Failed to add anime:', err)
    }
    setAdding(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', color:'#f5f0e8', fontFamily:'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #8b1a1a; }
        .btn-lift { transition: transform 0.2s ease, filter 0.2s ease, background-color 0.2s ease; }
        .btn-lift:hover { transform: translateY(-2px); filter: brightness(1.25); }
        .btn-lift:active { transform: translateY(0); filter: brightness(1); }
        .zen-spinner-wrap svg { animation: brushRotate 1.8s linear infinite; transform-origin: 50% 50%; }
        @keyframes brushRotate { to { transform: rotate(360deg); } }
        .zen-dot { animation: brushPulse 1.2s ease-in-out infinite; transform-origin: 26px 26px; }
        @keyframes brushPulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
        .info-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #161616; font-size:11px; }
        .char-card { display:flex; gap:12px; align-items:center; background:#0f0f0f; border:1px solid #1a1a1a; padding:10px; }
      `}</style>

      {/* Шапка */}
      <div style={{
        padding:'16px 40px', borderBottom:'1px solid #1a1a1a',
        display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0a0a0a',
      }}>
        <button onClick={() => navigate(-1)} className="btn-lift" style={{
          background:'none', border:'1px solid #222', color:'#999', padding:'6px 16px',
          cursor:'pointer', fontSize:'11px', letterSpacing:'2px', fontFamily:'Noto Serif JP, serif',
        }}>
          ← BACK
        </button>
        <div style={{ fontSize:'13px', letterSpacing:'3px', fontFamily:'Noto Serif JP, serif' }}>VAGABOND TRACKER</div>
        <span style={{ fontSize:'12px', color:'#555', letterSpacing:'2px' }}>{user?.username}</span>
      </div>

      {loading ? (
        <ZenSpinner />
      ) : error ? (
        <div style={{ textAlign:'center', padding:'140px 0', color:'#8b1a1a', fontSize:'12px', letterSpacing:'1px' }}>
          {error}
        </div>
      ) : anime ? (
        <div>
          {/* Хиро */}
          <div style={{ position:'relative', width:'100%', height:'420px', overflow:'hidden', borderBottom:'1px solid #1a1a1a' }}>
            <div style={{
              position:'absolute', inset:0,
              backgroundImage: `url(${anime.images?.jpg?.large_image_url})`,
              backgroundSize:'cover', backgroundPosition:'center 25%',
              filter:'grayscale(35%) brightness(0.5)',
            }} />
            <div style={{
              position:'absolute', inset:0,
              background:'linear-gradient(90deg, rgba(10,10,10,0.95) 25%, rgba(10,10,10,0.5) 60%, transparent 100%), linear-gradient(0deg, rgba(10,10,10,0.95) 0%, transparent 55%)',
            }} />

            <div style={{ position:'absolute', left:'40px', bottom:'36px', display:'flex', gap:'24px', alignItems:'flex-end' }}>
              <img
                src={anime.images?.jpg?.image_url}
                alt={anime.title}
                style={{ width:'160px', aspectRatio:'2/3', objectFit:'cover', border:'1px solid #2a2a2a', boxShadow:'0 12px 30px rgba(0,0,0,0.6)' }}
              />
              <div style={{ maxWidth:'560px', paddingBottom:'4px' }}>
                <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                  <span style={{ border:'1px solid #444', color:'#ccc', fontSize:'10px', letterSpacing:'1px', padding:'4px 10px' }}>
                    {anime.type}
                  </span>
                  {anime.status && (
                    <span style={{
                      background: anime.status === 'Currently Airing' ? '#2f6b3f' : '#1a1a1a',
                      border: anime.status === 'Currently Airing' ? 'none' : '1px solid #444',
                      color: anime.status === 'Currently Airing' ? '#c8f5cf' : '#999',
                      fontSize:'10px', letterSpacing:'1px', padding:'4px 10px',
                    }}>
                      {anime.status}
                    </span>
                  )}
                </div>
                <h1 style={{
                  fontSize:'36px', fontWeight:'700', letterSpacing:'2px', textTransform:'uppercase',
                  fontFamily:'Noto Serif JP, serif', marginBottom:'6px', textShadow:'0 4px 20px rgba(0,0,0,0.8)', lineHeight:1.1,
                }}>
                  {anime.title}
                </h1>
                {anime.title_japanese && (
                  <div style={{ fontSize:'13px', color:'#999', marginBottom:'12px', fontFamily:'Noto Serif JP, serif' }}>
                    {anime.title_japanese}
                  </div>
                )}
                <div style={{ display:'flex', gap:'14px', alignItems:'center', fontSize:'12px', color:'#bbb', marginBottom:'14px' }}>
                  {anime.score && <span>★ {anime.score} / 10</span>}
                  {anime.studios?.[0] && <span>{anime.studios[0].name}</span>}
                  {anime.year && <span>{anime.year}</span>}
                  <span>{anime.episodes || '?'} episodes</span>
                </div>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px' }}>
                  {(anime.genres || []).map(g => (
                    <span key={g.mal_id} style={{ border:'1px solid #333', color:'#999', fontSize:'9px', letterSpacing:'1px', padding:'3px 9px' }}>
                      {g.name}
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleAdd}
                  disabled={inList || adding}
                  className="btn-lift"
                  style={{
                    background: inList ? '#1a1a1a' : '#8b1a1a',
                    color: inList ? '#555' : '#f5f0e8',
                    border:'none', padding:'10px 24px', cursor: inList ? 'default' : 'pointer',
                    fontSize:'11px', letterSpacing:'2px', fontFamily:'Noto Serif JP, serif',
                  }}
                >
                  {inList ? 'IN SCROLLS' : adding ? 'ADDING…' : '+ ADD TO SCROLLS'}
                </button>
              </div>
            </div>
          </div>

          {/* Контент */}
          <div style={{ padding:'40px', display:'grid', gridTemplateColumns:'2.2fr 1fr', gap:'48px', maxWidth:'1400px', margin:'0 auto' }}>
            <div>
              {anime.synopsis && (
                <div style={{ marginBottom:'40px' }}>
                  <SectionMark title="SYNOPSIS" jp="概要" />
                  <p style={{ fontSize:'13px', lineHeight:1.8, color:'#ccc', maxWidth:'720px' }}>{anime.synopsis}</p>
                </div>
              )}

              {anime.trailer?.embed_url && (
                <div style={{ marginBottom:'40px' }}>
                  <SectionMark title="TRAILER" jp="予告" />
                  <div style={{ position:'relative', paddingBottom:'42%', border:'1px solid #1a1a1a' }}>
                    <iframe
                      src={anime.trailer.embed_url}
                      title="Trailer"
                      style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {characters.length > 0 && (
                <div style={{ marginBottom:'40px' }}>
                  <SectionMark title="CHARACTERS" jp="登場人物" />
                  <motion.div
                    variants={containerStagger} initial="hidden" animate="show"
                    style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px' }}
                  >
                    {characters.map(c => (
                      <motion.div key={c.character.mal_id} variants={fadeUp} className="char-card">
                        <img
                          src={c.character.images?.jpg?.image_url}
                          alt={c.character.name}
                          style={{ width:'44px', height:'60px', objectFit:'cover', flexShrink:0, filter:'grayscale(20%)' }}
                        />
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:'12px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {c.character.name}
                          </div>
                          <div style={{ fontSize:'10px', color:'#555', letterSpacing:'1px' }}>{c.role}</div>
                          {c.voice_actors?.[0] && (
                            <div style={{ fontSize:'10px', color:'#8b1a1a', marginTop:'2px' }}>{c.voice_actors[0].person.name}</div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              )}

              {episodes.length > 0 && (
                <div>
                  <SectionMark title="EPISODES" jp="話数" />
                  <div>
                    {episodes.map(ep => (
                      <div key={ep.mal_id} style={{
                        display:'flex', alignItems:'center', gap:'16px', padding:'12px 0', borderBottom:'1px solid #161616',
                      }}>
                        <span style={{ background:'#1a1a1a', color:'#8b1a1a', fontSize:'11px', padding:'4px 8px', flexShrink:0 }}>
                          {ep.mal_id}
                        </span>
                        <span style={{ flex:1, fontSize:'12px' }}>{ep.title}</span>
                        {ep.aired && (
                          <span style={{ fontSize:'10px', color:'#555' }}>
                            {new Date(ep.aired).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div style={{ marginBottom:'32px' }}>
                <SectionMark title="INFORMATION" jp="情報" />
                <div>
                  <div className="info-row"><span style={{ color:'#666' }}>Score</span><span>{anime.score ? `${anime.score} / 10` : '—'}</span></div>
                  <div className="info-row"><span style={{ color:'#666' }}>Rank</span><span>{anime.rank ? `#${anime.rank}` : '—'}</span></div>
                  <div className="info-row"><span style={{ color:'#666' }}>Studio</span><span>{anime.studios?.[0]?.name || '—'}</span></div>
                  <div className="info-row"><span style={{ color:'#666' }}>Type</span><span>{anime.type || '—'}</span></div>
                  <div className="info-row"><span style={{ color:'#666' }}>Year</span><span>{anime.year || '—'}</span></div>
                  <div className="info-row"><span style={{ color:'#666' }}>Episodes</span><span>{anime.episodes || '—'}</span></div>
                  <div className="info-row"><span style={{ color:'#666' }}>Status</span><span>{anime.status || '—'}</span></div>
                </div>
              </div>

              {(anime.theme?.openings?.length > 0 || anime.theme?.endings?.length > 0) && (
                <div>
                  <SectionMark title="THEME SONGS" jp="主題歌" />
                  {anime.theme?.openings?.length > 0 && (
                    <div style={{ marginBottom:'16px' }}>
                      <div style={{ fontSize:'10px', color:'#8b1a1a', letterSpacing:'2px', marginBottom:'8px' }}>OPENING</div>
                      {anime.theme.openings.map((t, i) => (
                        <div key={i} style={{ fontSize:'11px', color:'#bbb', padding:'6px 0', borderBottom:'1px solid #161616' }}>{t}</div>
                      ))}
                    </div>
                  )}
                  {anime.theme?.endings?.length > 0 && (
                    <div>
                      <div style={{ fontSize:'10px', color:'#8b1a1a', letterSpacing:'2px', marginBottom:'8px' }}>ENDING</div>
                      {anime.theme.endings.map((t, i) => (
                        <div key={i} style={{ fontSize:'11px', color:'#bbb', padding:'6px 0', borderBottom:'1px solid #161616' }}>{t}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}