/**
 * CLIENT PORTAL — read-only view for users with role 'building_owner'.
 *
 * Shows only inspections from jobs assigned to them, plus a Compliance Score
 * so the building owner can see at-a-glance that their portfolio is healthy.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LogOut, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  ShieldAlert, Activity, Download, FileText, Building2, Calendar,
  Search,
} from 'lucide-react'
import Logo from '../components/Logo'
import { getMe, getInspections, getJobs, downloadInspectionPDF } from '../services/api'

function parseAI(i) { try { return JSON.parse(i.result || '{}') } catch { return {} } }
function fmtDate(s) { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
function passFail(i) {
  return i.ai?.pass_fail_status
    || (i.status === 'completed' ? 'Pass'
    :  i.status === 'failed'    ? 'Fail'
    :  i.status === 'in_progress' ? 'Warning'
    : 'Pending')
}

// ── Big circular compliance score ──────────────────────────────────────────
function ComplianceGauge({ score }) {
  const r = 90
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 90 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444'
  const label = score >= 90 ? 'Excellent' : score >= 70 ? 'Good — minor attention' : 'Action required'

  return (
    <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center justify-center">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
        Compliance Score
      </p>
      <div className="relative">
        <svg width={220} height={220} viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={r} fill="none" stroke="#1f2937" strokeWidth="14" />
          <circle
            cx="110" cy="110" r={r} fill="none"
            stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            transform="rotate(-90 110 110)"
            style={{ transition: 'stroke-dashoffset 0.7s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-5xl font-bold text-white tabular-nums">{score}%</p>
          <p className="text-xs text-gray-400 mt-1">of devices compliant</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-5 px-4 py-2 rounded-full" style={{ backgroundColor: color + '18', border: `1px solid ${color}66` }}>
        <CheckCircle2 size={14} color={color} />
        <span className="text-sm font-bold" style={{ color }}>{label}</span>
      </div>
    </div>
  )
}

// ── Small KPI card ─────────────────────────────────────────────────────────
function KPI({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '22' }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color }}>{sub}</p>}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    Pass:     { color: '#22c55e', icon: CheckCircle2 },
    Warning:  { color: '#f59e0b', icon: AlertTriangle },
    Fail:     { color: '#ef4444', icon: XCircle },
    Pending:  { color: '#6b7280', icon: Activity },
  }[status] || { color: '#6b7280', icon: Activity }
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
      style={{
        color: cfg.color,
        backgroundColor: cfg.color + '15',
        borderColor: cfg.color + '55',
      }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {status}
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ClientPortalPage({ onLogout }) {
  const [user, setUser]               = useState(null)
  const [jobs, setJobs]               = useState([])
  const [inspections, setInspections] = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [pdfLoading, setPdfLoading]   = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [meRes, jobsRes, inspRes] = await Promise.all([getMe(), getJobs(), getInspections()])
      setUser(meRes.data)
      setJobs(jobsRes.data)
      setInspections(inspRes.data)
    } catch {
      onLogout()
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => { fetchData() }, [fetchData])

  const parsed = useMemo(
    () => inspections.map((i) => ({ ...i, ai: parseAI(i) })),
    [inspections]
  )

  const stats = useMemo(() => {
    let pass = 0, warn = 0, fail = 0, recalls = 0, expired = 0
    parsed.forEach((i) => {
      const pf = passFail(i)
      if (pf === 'Pass') pass++
      else if (pf === 'Warning') warn++
      else if (pf === 'Fail') fail++
      if (i.ai?.has_recall) recalls++
      if (i.ai?.expired) expired++
    })
    const total = parsed.length
    const score = total === 0 ? 100 : Math.round((pass / total) * 100)
    return { total, pass, warn, fail, recalls, expired, score }
  }, [parsed])

  const displayInspections = useMemo(() => {
    if (!search) return parsed
    const q = search.toLowerCase()
    return parsed.filter((i) =>
      [i.job_name, i.ai.brand, i.ai.model, i.ai.device_type, i.inspector_name]
        .some((f) => (f || '').toLowerCase().includes(q))
    )
  }, [parsed, search])

  const handleSinglePDF = async (inspection) => {
    setPdfLoading(inspection.id)
    try { await downloadInspectionPDF(inspection) }
    catch (e) { alert(e?.response?.data?.detail || 'Could not generate PDF.') }
    finally { setPdfLoading(null) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Loading your portal…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <p className="text-sm font-bold text-white leading-tight">Client Portal</p>
            <p className="text-[11px] text-gray-500">SmartInspect AI · Building Owner View</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-white">{user?.full_name}</p>
            <p className="text-[10px] text-gray-500">{user?.email}</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-border text-gray-400 hover:text-white text-sm rounded-xl transition"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-border text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm rounded-xl transition"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Welcome ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good day, {(user?.full_name || '').split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's the latest fire-safety status across your {jobs.length} {jobs.length === 1 ? 'building' : 'buildings'}.
          </p>
        </div>

        {/* ── Score + KPIs ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <ComplianceGauge score={stats.score} />
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <KPI icon={CheckCircle2}  label="Devices Pass"     value={stats.pass}    color="#22c55e" sub={stats.total ? `${stats.total} inspected` : undefined} />
            <KPI icon={AlertTriangle} label="Warnings"         value={stats.warn}    color="#f59e0b" />
            <KPI icon={XCircle}       label="Failures"         value={stats.fail}    color="#ef4444" />
            <KPI icon={ShieldAlert}   label="Active Recalls"   value={stats.recalls} color="#f97316" sub={stats.recalls > 0 ? 'Action required' : 'All clear'} />
          </div>
        </div>

        {/* ── Buildings (jobs) ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
            Your Buildings
          </h2>
          {jobs.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-10 text-center text-gray-500">
              <Building2 size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No buildings assigned to your account yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {jobs.map((j) => {
                const jobInspections = parsed.filter((i) => i.job_id === j.id)
                const pass = jobInspections.filter((i) => passFail(i) === 'Pass').length
                const total = jobInspections.length
                const pct = total === 0 ? 100 : Math.round((pass / total) * 100)
                const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={j.id} className="bg-surface border border-border rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                          <Building2 size={18} className="text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{j.name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {total} device{total === 1 ? '' : 's'} inspected · last update {fmtDate(j.completed_at || j.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{pct}%</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">compliant</p>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-gray-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Recent inspections ───────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white">Inspection Reports</h2>
            <div className="relative max-w-xs w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search device, building, technician…"
                className="w-full pl-9 pr-3 py-1.5 bg-bg border border-border rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg/50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Device</th>
                <th className="px-4 py-3 text-left">Building</th>
                <th className="px-4 py-3 text-left">Technician</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayInspections.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-600 text-sm">
                  {parsed.length === 0
                    ? 'No inspections have been performed in your buildings yet.'
                    : 'No inspections match your search.'}
                </td></tr>
              ) : displayInspections.map((i) => (
                <tr key={i.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-white">{i.ai.device_type || i.title}</p>
                    <p className="text-[11px] text-gray-500">{[i.ai.brand, i.ai.model].filter(Boolean).join(' · ') || '—'}</p>
                    {i.ai.has_recall ? (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
                        <ShieldAlert size={9} /> RECALL
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-300 max-w-[160px] truncate">{i.job_name || '—'}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-300 max-w-[140px] truncate">{i.inspector_name || '—'}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={passFail(i)} /></td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{fmtDate(i.created_at)}</td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleSinglePDF(i)}
                      disabled={pdfLoading === i.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg hover:bg-blue-600/20 border border-border hover:border-blue-500/40 text-gray-400 hover:text-blue-400 text-xs font-medium rounded-lg transition disabled:opacity-50"
                    >
                      {pdfLoading === i.id ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-[10px] text-gray-600">
          SmartInspect AI · Confidential — for the named building owner only
        </p>
      </div>
    </div>
  )
}
