import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { getMe } from './api'
import AuthPage from './pages/AuthPage'
import TrackerPage from './pages/TrackerPage'
import AnimeDetailPage from './pages/AnimeDetailPage'
import Enso from './components/Enso'

// key по id — при переходе между тайтлами страница начинает с чистого состояния
function DetailRoute(props) {
  const { id } = useParams()
  return <AnimeDetailPage key={id} {...props} />
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')))

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    getMe()
      .then((res) => setUser(res.data))
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

  return (
    <MotionConfig reducedMotion="user">
      {loading ? (
        <main className="page">
          <Enso label="Waking the server… the first visit can take half a minute." />
        </main>
      ) : !user ? (
        <AuthPage onLogin={handleLogin} />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<TrackerPage user={user} onLogout={handleLogout} />} />
            <Route path="/anime/:id" element={<DetailRoute user={user} onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      )}
    </MotionConfig>
  )
}
