import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import ClientPortalPage from './pages/ClientPortalPage'
import SuperAdminPage from './pages/SuperAdminPage'
import ErrorBoundary from './components/ErrorBoundary'
import { getMe } from './services/api'

function getInitialViewFromUrl() {
  if (typeof window === 'undefined') return { view: 'login', token: null }
  const path = window.location.pathname
  const params = new URLSearchParams(window.location.search)
  if (path.startsWith('/reset-password')) {
    return { view: 'reset', token: params.get('token') }
  }
  return { view: 'login', token: null }
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'))
  const initial = getInitialViewFromUrl()
  const [view, setView]             = useState(initial.view)
  const [resetToken, setResetToken] = useState(initial.token)

  // Cached role so the right portal renders without a flash on first load.
  const [role, setRole] = useState(() => localStorage.getItem('user_role') || null)

  // Clean the URL once we've consumed the reset token (or any deep link).
  useEffect(() => {
    if (initial.view === 'reset' && window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Whenever we have a token, fetch /me to know the user's role.
  useEffect(() => {
    if (!token) {
      setRole(null)
      localStorage.removeItem('user_role')
      return
    }
    getMe()
      .then((res) => {
        const r = res.data?.role || 'inspector'
        setRole(r)
        localStorage.setItem('user_role', r)
      })
      .catch(() => {
        // Token rejected — wipe and go back to login
        localStorage.removeItem('access_token')
        localStorage.removeItem('user_role')
        setToken(null)
        setRole(null)
        setView('login')
      })
  }, [token])

  const handleLogin = (newToken) => {
    localStorage.setItem('access_token', newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_role')
    setToken(null)
    setRole(null)
    setView('login')
  }

  const handleNavigate = (next) => {
    setView(next)
    if (next !== 'reset') setResetToken(null)
  }

  // If signed in, route by role — except while on the reset flow,
  // which we let finish so a logged-in user can still complete a reset link.
  if (token && !role) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Authenticating...</span>
        </div>
      </div>
    )
  }
  if (token && view !== 'reset' && role) {
    if (role === 'super_admin') {
      return (
        <ErrorBoundary>
          <SuperAdminPage onLogout={handleLogout} />
        </ErrorBoundary>
      )
    }
    if (role === 'building_owner') {
      return (
        <ErrorBoundary>
          <ClientPortalPage onLogout={handleLogout} />
        </ErrorBoundary>
      )
    }
    return (
      <ErrorBoundary>
        <DashboardPage onLogout={handleLogout} />
      </ErrorBoundary>
    )
  }

  if (view === 'signup')
    return <SignUpPage onLogin={handleLogin} onNavigate={handleNavigate} />

  if (view === 'forgot')
    return <ForgotPasswordPage onNavigate={handleNavigate} />

  if (view === 'reset')
    return <ResetPasswordPage token={resetToken} onNavigate={handleNavigate} />

  return <LoginPage onLogin={handleLogin} onNavigate={handleNavigate} />
}
