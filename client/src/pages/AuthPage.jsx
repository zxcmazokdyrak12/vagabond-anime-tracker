import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { login, register } from '../api'

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ username:'', email:'', password:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'login' ? login : register
      const res = await fn(form)
      onLogin(res.data.user, res.data.token)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{
      height: '100vh',
      background: '#0d0d0d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* Текстура бумаги */
        body { background: #0d0d0d; }

        .ink-input {
          width: 100%;
          padding: 12px 0;
          background: transparent;
          border: none;
          border-bottom: 1px solid #3a3a3a;
          color: #f5f0e8;
          font-family: 'Noto Serif JP', serif;
          font-size: 15px;
          outline: none;
          transition: border-color 0.3s;
          letter-spacing: 1px;
        }
        .ink-input:focus { border-bottom-color: #8b1a1a; }
        .ink-input::placeholder { color: #444; font-size: 13px; }
      `}</style>

      {/* Фоновые иероглифы */}
      {['道', '侍', '剣', '夢', '力'].map((k, i) => (
        <div key={i} style={{
          position: 'absolute',
          fontSize: `${80 + i * 40}px`,
          color: 'rgba(255,255,255,0.02)',
          fontFamily: 'Noto Serif JP, serif',
          top: `${10 + i * 18}%`,
          left: `${5 + i * 20}%`,
          userSelect: 'none', pointerEvents: 'none',
          transform: `rotate(${i % 2 === 0 ? 5 : -5}deg)`,
        }}>{k}</div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: '380px',
          padding: '52px 48px',
          background: 'rgba(20,20,20,0.95)',
          border: '1px solid #222',
          position: 'relative',
        }}
      >
        {/* Красная полоса сверху — как печать */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#8b1a1a' }} />

        {/* Японский заголовок */}
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <div style={{ fontSize:'11px', color:'#8b1a1a', letterSpacing:'6px', marginBottom:'12px', fontFamily:'Noto Serif JP, serif' }}>
            アニメ追跡
          </div>
          <h1 style={{ fontSize:'28px', color:'#f5f0e8', letterSpacing:'3px', fontWeight:'300', fontFamily:'Noto Serif JP, serif' }}>
            {mode === 'login' ? 'ENTER THE DOJO' : 'BEGIN YOUR PATH'}
          </h1>
        </div>

        {/* Форма */}
        <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>
          {mode === 'register' && (
            <div>
              <label style={{ fontSize:'10px', color:'#555', letterSpacing:'3px' }}>WARRIOR NAME</label>
              <input className="ink-input" placeholder="username" value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value}))} />
            </div>
          )}
          <div>
            <label style={{ fontSize:'10px', color:'#555', letterSpacing:'3px' }}>SCROLL ADDRESS</label>
            <input className="ink-input" type="email" placeholder="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
          </div>
          <div>
            <label style={{ fontSize:'10px', color:'#555', letterSpacing:'3px' }}>SECRET SEAL</label>
            <input className="ink-input" type="password" placeholder="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop:'16px', fontSize:'12px', color:'#8b1a1a', letterSpacing:'1px', fontFamily:'Noto Serif JP, serif' }}>
            ✕ {error}
          </div>
        )}

        {/* Кнопка */}
        <motion.button
          whileHover={{ background: '#6b1414' }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width:'100%', marginTop:'36px',
            padding:'14px',
            background: '#8b1a1a', color:'#f5f0e8',
            border:'none', cursor:'pointer',
            fontFamily:'Noto Serif JP, serif',
            fontSize:'13px', letterSpacing:'4px',
            transition:'background 0.2s',
          }}
        >
          {loading ? '...' : mode === 'login' ? 'ENTER' : 'BEGIN'}
        </motion.button>

        {/* Переключение режима */}
        <div style={{ textAlign:'center', marginTop:'24px' }}>
          <button
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
            style={{ background:'none', border:'none', color:'#555', fontSize:'11px', cursor:'pointer', letterSpacing:'2px', fontFamily:'Noto Serif JP, serif' }}
          >
            {mode === 'login' ? 'NEW WARRIOR? BEGIN HERE' : 'ALREADY WALKING THE PATH?'}
          </button>
        </div>

        {/* Декоративный иероглиф */}
        <div style={{ position:'absolute', bottom:'16px', right:'20px', fontSize:'24px', color:'rgba(139,26,26,0.2)', fontFamily:'Noto Serif JP, serif' }}>
          忍
        </div>
      </motion.div>
    </div>
  )
}