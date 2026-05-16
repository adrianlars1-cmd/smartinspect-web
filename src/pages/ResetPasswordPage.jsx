import { useState } from 'react'
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '../services/api'
import Logo from '../components/Logo'

export default function ResetPasswordPage({ token, onNavigate }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. Please request a new link.')
    } finally {
      setLoading(false)
    }
  }

  // If we landed here with no token in the URL, bail out.
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="relative w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-full mb-4">
            <AlertCircle size={26} className="text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Invalid reset link</h1>
          <p className="text-sm text-gray-500 mb-6">
            This link is missing a token. Please request a new password reset.
          </p>
          <button
            onClick={() => onNavigate('forgot')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition"
          >
            Request new link
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            <Logo size={64} />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">SmartInspect AI</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a new password</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          {done ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-4">
                <CheckCircle2 size={26} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Password updated</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <button
                onClick={() => onNavigate('login')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition"
              >
                Continue to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Reset password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Pick a new password — at least 8 characters.
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-5">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="Min. 8 characters"
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Confirm new password
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Repeat your new password"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Updating…
                    </>
                  ) : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
