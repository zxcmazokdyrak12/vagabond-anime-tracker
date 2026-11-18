import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { getMe } from './api'
import AuthPage from './pages/AuthPage'
import TrackerPage from './pages/TrackerPage'
import AnimeDetailPage from './pages/AnimeDetailPage'
import Enso from './components/Enso'
import Intro from './components/Intro'
import type { User } from './types'

interface PageProps {
  user: User
  onLogout: () => void
}

// key по id — при переходе между тайтлами страница начинает с чистого состояния
function DetailRoute(props: PageProps) {
  const { id } = useParams()
  return <AnimeDetailPage key={id} {...props} />
}

const INTRO_KEY = 'intro-seen'

// Заставка показывается раз за сессию браузера
const introSeen = () => {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const [showIntro, setShowIntro] = useState(() => !introSeen())
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')))

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    getMe()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = (userData: User, token: string) => {
    localStorage.setItem('token', token)
    setUser(userData)
  }

  const finishIntro = () => {
    try {
      sessionStorage.setItem(INTRO_KEY, '1')
    } catch {
      // приватный режим — заставка покажется ещё раз, не страшно
    }
    setShowIntro(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <MotionConfig reducedMotion="user">
      {/* Приложение грузится под заставкой: пока режешь лист, сервер уже просыпается */}
      {showIntro && <Intro onDone={finishIntro} />}
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
