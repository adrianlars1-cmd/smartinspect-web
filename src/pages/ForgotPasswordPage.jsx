import { useState } from 'react'
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react'
import { requestPasswordReset } from '../services/api'
import Logo from '../components/Logo'

export default function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Enter a valid email address.')

    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
    } catch (err) {
      // Even if backend is not implemented yet, we show success
      // to avoid leaking which emails exist.
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        <button
          onClick={() => onNavigate('login')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition mb-6"
        >
          <ArrowLeft size={14} /> Back to sign in
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            <Logo size={64} />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">SmartInspect AI</h1>
          <p className="text-sm text-gray-500 mt-1">Reset your password</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500/10 border border-blue-500/30 rounded-full mb-4">
                <MailCheck size={26} className="text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                If an account exists for <span className="text-white font-medium">{email}</span>,
                you'll receive a password reset link shortly.
              </p>
              <button
                onClick={() => onNavigate('login')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition mt-6"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Forgot password?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter the email address associated with your account, and we'll send you a reset link.
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-5">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
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
                      Sending…
                    </>
                  ) : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
