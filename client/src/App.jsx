import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { getMe } from './api'
import AuthPage from './pages/AuthPage'
import TrackerPage from './pages/TrackerPage'
import AnimeDetailPage from './pages/AnimeDetailPage'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }

    getMe()
      .then(res => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token)
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  if (loading) return (
    <div style={{ height:'100vh', background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center', color:'#f5f0e8', fontFamily:'serif', fontSize:'18px', letterSpacing:'4px' }}>
      読み込み中...
    </div>
  )

  if (!user) return <AuthPage onLogin={handleLogin} />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TrackerPage user={user} onLogout={handleLogout} />} />
        <Route path="/anime/:id" element={<AnimeDetailPage user={user} onLogout={handleLogout} />} />
      </Routes>
    </BrowserRouter>
  )
}