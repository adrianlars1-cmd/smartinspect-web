import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  LogOut, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Clock, FileText, Download, ShieldAlert,
  Activity, TrendingUp, Search, ChevronUp, ChevronDown,
  Cpu, User, AlertCircle, CalendarClock, Wrench, Building2,
  Eye, ImageOff, FileSpreadsheet, Table as TableIcon,
  UserPlus, Briefcase, Settings as SettingsIcon, Upload, Trash2, Image as ImageIcon,
  Calendar as CalendarIcon, MapPin,
} from 'lucide-react'
import CalendarView from './CalendarView'
import InspectionsMapCard from './InspectionsMapCard'
import InspectionDetailDrawer from './InspectionDetailDrawer'
import InspectorsManagementPage from './InspectorsManagementPage'
import Logo from '../components/Logo'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import {
  getMe, getInspections, downloadInspectionPDF,
  getJobs, listBuildingOwners, updateUserRole, assignJobClient,
  getBranding, updateBranding, fetchBrandingLogoUrl,
  uploadBrandingLogo, deleteBrandingLogo,
} from '../services/api'
import { generateBulkPDF } from '../utils/generatePDF'
import { exportInspectionsCSV, exportInspectionsXLSX } from '../utils/exportData'

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseResult(inspection) {
  try { return JSON.parse(inspection.result || '{}') } catch (err) {
      console.error("Fetch error:", err); return {} }
}

function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}
function fmtTime(str) {
  return new Date(str).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_CFG = {
  Verified:       { color: '#22c55e', bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30',  icon: CheckCircle2 },
  'Needs Service':{ color: '#f59e0b', bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: AlertTriangle },
  Flagged:        { color: '#ef4444', bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30',    icon: XCircle },
  completed:      { color: '#22c55e', bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30',  icon: CheckCircle2 },
  in_progress:    { color: '#38bdf8', bg: 'bg-sky-500/15',    text: 'text-sky-400',    border: 'border-sky-500/30',    icon: Activity },
  failed:         { color: '#ef4444', bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30',    icon: XCircle },
  pending:        { color: '#6b7280', bg: 'bg-gray-500/15',   text: 'text-gray-400',   border: 'border-gray-500/30',   icon: Clock },
}

function statusLabel(i) {
  return i.ai?.status
    || (i.status === 'completed' ? 'Verified'
    : i.status === 'failed' ? 'Flagged'
    : 'Needs Service')
}

// Map internal status → user-facing Pass/Warning/Fail terminology used by the
// Senior Fire Safety Expert.
const PASS_FAIL_LABEL = {
  Verified: 'Pass',
  'Needs Service': 'Warning',
  Flagged: 'Fail',
  completed: 'Pass',
  in_progress: 'Warning',
  failed: 'Fail',
  pending: 'Pending',
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending
  const Icon = cfg.icon
  const label = PASS_FAIL_LABEL[status] ?? status
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  )
}

function ConfBar({ value }) {
  const pct = Math.round((value || 0) * 100)
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '22' }}>
        <Icon size={22} style={{ color }} strokeWidth={2} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color }}>{sub}</p>}
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-semibold" style={{ color: p.fill || p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function TH({ children, sortKey, currentSort, onSort }) {
  const active = currentSort?.key === sortKey
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition ${active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          currentSort.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronDown size={12} className="opacity-30" />
        )}
      </span>
    </th>
  )
}

// ── Nav config ───────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',   icon: Activity,    label: 'Dashboard',   title: 'Dashboard',                subtitle: 'Operational overview' },
  { id: 'inspections', icon: FileText,    label: 'Inspections', title: 'Inspections',              subtitle: 'All inspection reports' },
  { id: 'recalls',     icon: ShieldAlert, label: 'Recalls',     title: 'Active Recalls',           subtitle: 'Devices with open recalls' },
  { id: 'analytics',   icon: TrendingUp,  label: 'Analytics',   title: 'Analytics',                subtitle: 'Trends & inspector performance' },
  { id: 'inspectors',  icon: User,        label: 'Inspectors',  title: 'Manage Inspectors',        subtitle: 'Create and manage your team' },
  { id: 'calendar',    icon: CalendarIcon, label: 'Calendar',   title: 'Schedule & Dispatch',      subtitle: 'Assign jobs to technicians' },
  { id: 'clients',     icon: Building2,   label: 'Clients',     title: 'Building Owners',          subtitle: 'Manage who can see which jobs' },
  { id: 'settings',    icon: SettingsIcon, label: 'Settings',   title: 'Company Settings',         subtitle: 'Logo, branding & report header' },
]

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage({ onLogout }) {
  const [user, setUser]               = useState(null)
  const [inspections, setInspections] = useState([])
  const [loading, setLoading]         = useState(true)
  const [activePage, setActivePage]   = useState('dashboard')

  // Inspections-page state (shared with embedded recent table on Dashboard)
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sort, setSort]               = useState({ key: 'created_at', asc: false })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [pdfLoading, setPdfLoading]   = useState(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [openInspection, setOpenInspection] = useState(null)

  const fetchData = useCallback(async () => {
    console.log("Fetching data...")
    setLoading(true)
    try {
      const [meRes, inspRes] = await Promise.all([getMe(), getInspections()])
      setUser(meRes.data)
      setInspections(inspRes.data)
    } catch (err) {
      console.error("Fetch error:", err)
      onLogout()
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived data ──────────────────────────────────────────────────────────
  const parsed = useMemo(
    () => (inspections || []).map(i => ({ ...i, ai: parseResult(i) })),
    [inspections]
  )

  const stats = useMemo(() => {
    if (!parsed) return { total: 0, verified: 0, service: 0, flagged: 0, recalls: 0 }
    return {
      total:    parsed.length,
      verified: (parsed || []).filter(i => i.ai.status === 'Verified'      || i.status === 'completed').length,
      service:  (parsed || []).filter(i => i.ai.status === 'Needs Service' || i.status === 'in_progress').length,
      flagged:  (parsed || []).filter(i => i.ai.status === 'Flagged'       || i.status === 'failed').length,
      recalls:  (parsed || []).filter(i => i.ai.has_recall).length,
    }
  }, [parsed])

  const recalls = useMemo(() => (parsed || []).filter(i => i.ai.has_recall), [parsed])

  // Pie data
  const pieData = [
    { name: 'Verified',      value: stats.verified, color: '#22c55e' },
    { name: 'Needs Service', value: stats.service,  color: '#f59e0b' },
    { name: 'Flagged',       value: stats.flagged,  color: '#ef4444' },
  ].filter(d => d.value > 0)

  // Daily counts helper
  const buildDaily = (days) => Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const key = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    const count = (parsed || []).filter(p => new Date(p.created_at).toDateString() === d.toDateString()).length
    return { day: key, count }
  })
  const last7  = useMemo(() => buildDaily(7),  [parsed])
  const last30 = useMemo(() => buildDaily(30), [parsed])

  // Brand breakdown (top 6)
  const brandData = useMemo(() => {
    const map = new Map()
    parsed.forEach(i => {
      const b = i.ai.brand || 'Unknown'
      map.set(b, (map.get(b) || 0) + 1)
    })
    return [...map.entries()]
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [parsed])

  // Confidence buckets (for analytics)
  const confBuckets = useMemo(() => {
    const buckets = [
      { range: '<60%',   min: 0,   max: 0.6,  count: 0 },
      { range: '60–75%', min: 0.6, max: 0.75, count: 0 },
      { range: '75–90%', min: 0.75,max: 0.9,  count: 0 },
      { range: '≥90%',   min: 0.9, max: 1.01, count: 0 },
    ]
    parsed.forEach(i => {
      const c = i.ai.confidence ?? 0
      const b = buckets.find(b => c >= b.min && c < b.max)
      if (b) b.count++
    })
    return buckets
  }, [parsed])

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const handleSort = (key) => {
    setSort(prev => prev.key === key ? { key, asc: !prev.asc } : { key, asc: true })
  }

  const displayData = useMemo(() => parsed
    .filter(i => {
      const aiStatus = i.ai.status || ''
      const dbStatus = i.status    || ''
      if (filterStatus === 'verified' && aiStatus !== 'Verified'      && dbStatus !== 'completed')  return false
      if (filterStatus === 'service'  && aiStatus !== 'Needs Service' && dbStatus !== 'in_progress') return false
      if (filterStatus === 'flagged'  && aiStatus !== 'Flagged'       && dbStatus !== 'failed')      return false
      if (filterStatus === 'recall'   && !i.ai.has_recall)                                           return false
      if (search) {
        const q = search.toLowerCase()
        const fields = [
          i.title, i.job_name, i.inspector_name,
          i.ai.brand, i.ai.model, i.ai.device_type,
        ].map(f => (f || '').toLowerCase())
        if (!fields.some(f => f.includes(q))) return false
      }
      return true
    })
    .sort((a, b) => {
      let va, vb
      if (sort.key === 'created_at') { va = new Date(a.created_at); vb = new Date(b.created_at) }
      else if (sort.key === 'confidence') { va = a.ai.confidence || 0; vb = b.ai.confidence || 0 }
      else if (sort.key === 'status') { va = a.ai.status || ''; vb = b.ai.status || '' }
      else if (sort.key === 'device') { va = a.ai.device_type || a.title || ''; vb = b.ai.device_type || b.title || '' }
      else if (sort.key === 'job') { va = (a.job_name || '').toLowerCase(); vb = (b.job_name || '').toLowerCase() }
      else if (sort.key === 'inspector') { va = (a.inspector_name || '').toLowerCase(); vb = (b.inspector_name || '').toLowerCase() }
      else { va = a.id; vb = b.id }
      if (va < vb) return sort.asc ? -1 : 1
      if (va > vb) return sort.asc ?  1 : -1
      return 0
    }), [parsed, filterStatus, search, sort])

  // ── Bulk selection ────────────────────────────────────────────────────────
  const allSelected  = displayData.length > 0 && displayData.every(i => selectedIds.has(i.id))
  const someSelected = selectedIds.size > 0
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(displayData.map(i => i.id)))
  }
  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // ── PDF handlers ──────────────────────────────────────────────────────────
  // Single-inspection PDF is now generated by the backend (includes photos,
  // professional layout). Bulk export is still a quick client-side summary.
  const handleSinglePDF = async (inspection) => {
    setPdfLoading(inspection.id)
    try {
      await downloadInspectionPDF(inspection)
    } catch (err) {
      console.error('PDF download failed', err)
      alert(err?.response?.data?.detail || 'Could not generate the PDF report.')
    } finally {
      setPdfLoading(null)
    }
  }
  const handleBulkPDF = () => {
    const selected = inspections.filter(i => selectedIds.has(i.id))
    generateBulkPDF(selected.length > 0 ? selected : inspections)
  }

  // Data export — selection-aware: exports selected rows if any, else all.
  const exportTargets = () => {
    const selected = inspections.filter(i => selectedIds.has(i.id))
    return selected.length > 0 ? selected : inspections
  }
  const handleExportCSV = () => {
    exportInspectionsCSV(exportTargets())
    setExportMenuOpen(false)
  }
  const handleExportXLSX = () => {
    exportInspectionsXLSX(exportTargets())
    setExportMenuOpen(false)
  }

    if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Loading Control Center…</span>
        </div>
      </div>
    )
  }

  if (!inspections || inspections.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-surface/50 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <span className="text-lg font-bold text-white tracking-tight">SmartInspect AI</span>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-medium">
            <LogOut size={16} />
            Sign Out
          </button>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-6 border border-blue-500/20">
            <Activity size={40} className="text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to SmartInspect AI</h1>
          <p className="text-gray-400 max-w-md mb-8">
            Your dashboard is ready! Start your first inspection using the mobile app to see your data and analytics here.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
            <div className="bg-surface border border-border p-6 rounded-2xl text-left">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                Step 1: Mobile App
              </h3>
              <p className="text-sm text-gray-500">Open the SmartInspect app on your phone and scan a fire safety device.</p>
            </div>
            <div className="bg-surface border border-border p-6 rounded-2xl text-left">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                Step 2: View Reports
              </h3>
              <p className="text-sm text-gray-500">Once an inspection is submitted, it will appear here automatically.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }


  const currentNav = NAV.find(n => n.id === activePage) || NAV[0]

  return (
    <div className="min-h-screen bg-bg flex">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-surface border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div>
              <p className="text-sm font-semibold text-white leading-tight tracking-tight">
                SmartInspect AI
              </p>
              <p className="text-[10px] text-gray-500">Control Center</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ id, icon: Icon, label }) => {
            const active = activePage === id
            const badge = id === 'recalls' && stats.recalls > 0 ? stats.recalls : null
            return (
              <button
                key={id}
                onClick={() => { setActivePage(id); setSelectedIds(new Set()) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="flex-1 text-left">{label}</span>
                {badge && (
                  <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg border border-border mb-2">
            <div className="w-7 h-7 bg-blue-900/50 rounded-lg flex items-center justify-center">
              <User size={14} color="#3b82f6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Admin'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut size={15} strokeWidth={2} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">

        <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{currentNav.title}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentNav.subtitle} · {inspections.length} inspections total · Last updated {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(activePage === 'inspections' || activePage === 'recalls') && someSelected && (
              <button
                onClick={handleBulkPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-sm font-medium rounded-xl transition"
              >
                <Download size={15} strokeWidth={2} />
                Export {selectedIds.size} PDF{selectedIds.size !== 1 ? 's' : ''}
              </button>
            )}
            {(activePage === 'dashboard' || activePage === 'inspections') && (
              <button
                onClick={handleBulkPDF}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-gray-400 hover:text-white text-sm font-medium rounded-xl transition"
              >
                <FileText size={15} strokeWidth={2} />
                Export PDF
              </button>
            )}

            {/* Export Data (CSV / XLSX) — for billing & accounting */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(v => !v)}
                onBlur={() => setTimeout(() => setExportMenuOpen(false), 150)}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-gray-400 hover:text-white text-sm font-medium rounded-xl transition"
              >
                <Download size={15} strokeWidth={2} />
                Export Data
                <ChevronDown size={13} className={`transition ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-xl shadow-2xl z-30 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-semibold text-white">
                      {selectedIds.size > 0
                        ? `Export ${selectedIds.size} selected inspection${selectedIds.size !== 1 ? 's' : ''}`
                        : `Export all ${inspections.length} inspections`}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Date · Technician · Device · Status · Issues
                    </p>
                  </div>
                  <button
                    onMouseDown={handleExportXLSX}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <FileSpreadsheet size={16} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">Excel (.xlsx)</p>
                      <p className="text-[10px] text-gray-500">Includes Summary sheet for billing</p>
                    </div>
                  </button>
                  <button
                    onMouseDown={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left border-t border-border"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                      <TableIcon size={16} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">CSV (.csv)</p>
                      <p className="text-[10px] text-gray-500">UTF-8, opens in any accounting tool</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition"
            >
              <RefreshCw size={15} strokeWidth={2} />
              Refresh
            </button>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">

          {activePage === 'dashboard' && (
            <DashboardView
              stats={stats}
              last7={last7}
              pieData={pieData}
              parsed={parsed}
              onOpenInspections={() => setActivePage('inspections')}
              onOpenRecalls={() => setActivePage('recalls')}
              handleSinglePDF={handleSinglePDF}
              pdfLoading={pdfLoading}
              onOpenInspection={setOpenInspection}
            />
          )}

          {activePage === 'inspections' && (
            <InspectionsView
              displayData={displayData}
              inspections={inspections}
              search={search} setSearch={setSearch}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              sort={sort} handleSort={handleSort}
              allSelected={allSelected} someSelected={someSelected}
              selectedIds={selectedIds}
              toggleAll={toggleAll} toggleOne={toggleOne}
              handleSinglePDF={handleSinglePDF}
              handleBulkPDF={handleBulkPDF}
              pdfLoading={pdfLoading}
              onOpenInspection={setOpenInspection}
            />
          )}

          {activePage === 'recalls' && (
            <RecallsView
              recalls={recalls}
              handleSinglePDF={handleSinglePDF}
              pdfLoading={pdfLoading}
            />
          )}

          {activePage === 'analytics' && (
            <AnalyticsView
              stats={stats}
              last30={last30}
              pieData={pieData}
              brandData={brandData}
              confBuckets={confBuckets}
              parsed={parsed}
            />
          )}

          {activePage === 'inspectors' && (
            <InspectorsManagementPage />
          )}

          {activePage === 'clients' && (
            <ClientsView />
          )}

          {activePage === 'calendar' && (
            <CalendarView />
          )}

          {activePage === 'settings' && (
            <SettingsView />
          )}

        </div>
      </main>

      {/* Slide-over Inspection Detail panel (with the Money Button™) */}
      {openInspection ? (
        <InspectionDetailDrawer
          inspection={openInspection}
          onClose={() => { setOpenInspection(null); fetchData() }}
        />
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS VIEW — company branding (logo + name) used on every PDF
// ─────────────────────────────────────────────────────────────────────────────
function SettingsView() {
  const [branding, setBranding]   = useState(null)
  const [logoUrl, setLogoUrl]     = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [dragOver, setDragOver]   = useState(false)
  const fileInputRef = useRef(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getBranding()
      setBranding(data)
      setCompanyName(data.company_name || '')
      // Revoke the previous blob URL before fetching a fresh one.
      setLogoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
      if (data.has_logo) {
        const url = await fetchBrandingLogoUrl()
        setLogoUrl(url)
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load company settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])
  useEffect(() => () => { if (logoUrl) URL.revokeObjectURL(logoUrl) }, [logoUrl])

  const handleSaveName = async () => {
    setSaving(true)
    setError('')
    try {
      await updateBranding(companyName)
      await reload()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not save company name.')
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelected = async (file) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/i.test(file.type)) {
      setError('Logo must be a PNG, JPG, WEBP, or SVG image.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Logo must be under 4 MB.')
      return
    }
    setUploading(true)
    setError('')
    try {
      await uploadBrandingLogo(file)
      await reload()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Remove the company logo? The PDF header will fall back to text-only.')) return
    try {
      await deleteBrandingLogo()
      await reload()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not remove logo.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
        <RefreshCw size={18} className="animate-spin" /> Loading settings…
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Logo uploader ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <ImageIcon size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Company Logo</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Appears at the top of every PDF inspection report.
              </p>
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFileSelected(file)
            }}
            className={`mt-5 border-2 border-dashed rounded-2xl p-8 transition flex flex-col items-center justify-center text-center min-h-[200px] ${
              dragOver
                ? 'border-blue-500 bg-blue-500/5'
                : branding?.has_logo
                  ? 'border-border bg-bg'
                  : 'border-border bg-bg/50 hover:border-blue-500/50'
            }`}
          >
            {branding?.has_logo && logoUrl ? (
              <>
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="max-h-32 max-w-full object-contain"
                />
                <p className="text-[11px] text-gray-500 mt-4">
                  {branding.logo_mime} · uploaded {branding.updated_at ? new Date(branding.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition"
                  >
                    {uploading
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <Upload size={14} />}
                    Replace logo
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm font-medium rounded-xl transition"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <>
                <ImageIcon size={28} className="text-gray-600 mb-3" />
                <p className="text-sm text-white font-semibold">Drop your logo here</p>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  PNG, JPG, or WEBP · up to 4 MB · transparent background recommended
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition"
                >
                  {uploading
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <Upload size={14} />}
                  Choose file
                </button>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelected(f)
              e.target.value = ''
            }}
          />

          {error ? (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl px-3 py-2">
              {error}
            </div>
          ) : null}
        </div>

        {/* ── Company name + sidebar info ────────────────────────────── */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Building2 size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Company name</h3>
              <p className="text-xs text-gray-500 mt-0.5">Shown in the report header</p>
            </div>
          </div>

          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Display name
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Fire Safety AS"
            className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
          />
          <button
            onClick={handleSaveName}
            disabled={saving}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Save
          </button>

          <p className="text-[10px] text-gray-500 mt-5 leading-relaxed">
            Leave blank to fall back to the default "SmartInspect AI" branding on PDFs.
          </p>
        </div>
      </div>

      {/* ── Preview banner ─────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-white">PDF Header Preview</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            This is roughly how the top of every generated PDF report will look.
          </p>
        </div>
        <div className="bg-[#111827] px-6 py-5 flex items-center gap-4 border-b-2 border-blue-600">
          {branding?.has_logo && logoUrl ? (
            <img src={logoUrl} alt="" className="h-12 max-w-[160px] object-contain" />
          ) : null}
          <div>
            <p className="text-white font-bold text-lg leading-tight">
              {companyName?.trim() || 'SmartInspect AI'}
            </p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
              Official Fire Safety Inspection Report
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS VIEW — manage Building Owners + assign jobs to them
// ─────────────────────────────────────────────────────────────────────────────
function ClientsView() {
  const [clients, setClients] = useState([])
  const [jobs, setJobs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [promoteEmail, setPromoteEmail] = useState('')
  const [promoting, setPromoting]       = useState(false)
  const [error, setError]               = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [c, j] = await Promise.all([listBuildingOwners(), getJobs()])
      setClients(c.data)
      setJobs(j.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const handlePromote = async (e) => {
    e?.preventDefault?.()
    setError('')
    const email = promoteEmail.trim().toLowerCase()
    if (!email) return
    // Find the user by email from the inspector's visible jobs — we don't have
    // a public list-users endpoint, so we look up by email via /me-ish lookup.
    // Simplest path: ask the user to register the building owner first, then
    // promote by email. For that we need a user-id lookup endpoint or accept
    // email here. Backend currently expects user_id, so we'll add a quick
    // /auth/users/by-email route — but for now we just give a helpful error.
    setError("Promote-by-email isn't wired yet — for now register the building owner via the Sign Up page, then ask an admin to PATCH /auth/users/<id>/role with role=building_owner.")
  }

  const handleAssign = async (jobId, clientId) => {
    try {
      await assignJobClient(jobId, clientId || null)
      await reload()
    } catch (e) {
      alert(e?.response?.data?.detail || 'Could not assign client.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
        <RefreshCw size={18} className="animate-spin" /> Loading clients…
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Promote user to building owner ─────────────────────────── */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <UserPlus size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Add a Building Owner</h3>
              <p className="text-xs text-gray-500 mt-0.5">Promote an existing account</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed mb-3">
            Tell the building owner to register at the sign-up page. Then an admin can promote their account to the
            <span className="text-blue-400 font-semibold"> Building Owner </span> role via the API:
          </p>
          <code className="block bg-bg border border-border rounded-lg p-2 text-[10px] text-gray-300 font-mono break-all">
            PATCH /auth/users/&lt;user_id&gt;/role &nbsp; &#123;"role":"building_owner"&#125;
          </code>
          {error ? <p className="text-xs text-yellow-400 mt-3">{error}</p> : null}
        </div>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Linked Buildings</p>
            <Briefcase size={14} className="text-gray-500" />
          </div>
          <p className="text-4xl font-bold text-white">
            {jobs.filter((j) => j.client_id != null).length}
            <span className="text-gray-500 text-lg font-medium"> / {jobs.length}</span>
          </p>
          <p className="text-xs text-gray-500">
            jobs are visible to a client portal. The rest are inspector-internal.
          </p>
        </div>
      </div>

      {/* ── Clients list ───────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-white">Building Owners ({clients.length})</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            These users only see the jobs explicitly assigned to them in their Client Portal.
          </p>
        </div>
        {clients.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No Building Owner accounts yet — promote one from the API.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-border bg-bg/40">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Assigned buildings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((c) => {
                const owned = jobs.filter((j) => j.client_id === c.id)
                return (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-5 py-3.5 text-sm text-white font-semibold">{c.full_name}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-400">{c.email}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-300">
                      {owned.length === 0 ? <span className="text-gray-600">— none —</span> : (
                        <ul className="space-y-1">
                          {owned.map((j) => <li key={j.id} className="truncate">📍 {j.name}</li>)}
                        </ul>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Job assignment matrix ──────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-white">Assign Buildings to Clients</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pick a Building Owner for each job. They'll see only those jobs when they log in.
          </p>
        </div>
        {jobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">No jobs created yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-border bg-bg/40">
                <th className="px-5 py-3 text-left">Job</th>
                <th className="px-4 py-3 text-left">Inspector</th>
                <th className="px-4 py-3 text-left">Devices</th>
                <th className="px-4 py-3 text-left">Assigned to client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-5 py-3.5 text-sm text-white font-semibold">{j.name}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{j.inspector_name || '—'}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{j.device_count}</td>
                  <td className="px-4 py-3.5">
                    <select
                      value={j.client_id || ''}
                      onChange={(e) => handleAssign(j.id, e.target.value ? Number(e.target.value) : null)}
                      className="bg-bg border border-border rounded-lg text-xs text-white px-2 py-1.5 focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="">— Not assigned —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD VIEW — overview with stats, charts, recent activity
// ─────────────────────────────────────────────────────────────────────────────
function DashboardView({ stats, last7, pieData, parsed, onOpenInspections, onOpenRecalls, handleSinglePDF, pdfLoading, onOpenInspection }) {
  const recent = parsed.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Cpu}           label="Total Inspections" value={stats.total}    color="#3b82f6" />
        <StatCard icon={CheckCircle2}  label="Verified"          value={stats.verified} color="#22c55e" sub={stats.total ? `${Math.round(stats.verified/stats.total*100)}%` : undefined} />
        <StatCard icon={AlertTriangle} label="Needs Service"     value={stats.service}  color="#f59e0b" />
        <StatCard icon={XCircle}       label="Flagged"           value={stats.flagged}  color="#ef4444" />
        <StatCard icon={ShieldAlert}   label="Active Recalls"    value={stats.recalls}  color="#f97316" sub={stats.recalls > 0 ? 'Action required' : 'All clear'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Inspections — Last 7 Days</h2>
              <p className="text-xs text-gray-500 mt-0.5">Daily inspection volume</p>
            </div>
            <TrendingUp size={16} color="#3b82f6" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last7} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
              <Bar dataKey="count" name="Inspections" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Status Distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">Across all inspections</p>
            </div>
            <Activity size={16} color="#3b82f6" />
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-600 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Quick links row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={onOpenInspections}
          className="bg-surface border border-border hover:border-blue-500/40 rounded-2xl p-5 text-left transition group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition">View All Inspections</h3>
              <p className="text-xs text-gray-500">Search, filter, and export reports</p>
            </div>
          </div>
        </button>
        <button
          onClick={onOpenRecalls}
          className={`bg-surface border ${stats.recalls > 0 ? 'border-red-500/40' : 'border-border'} hover:border-red-500/60 rounded-2xl p-5 text-left transition group`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center">
              <ShieldAlert size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white group-hover:text-red-400 transition">
                {stats.recalls > 0 ? `${stats.recalls} Active Recall${stats.recalls !== 1 ? 's' : ''}` : 'No Active Recalls'}
              </h3>
              <p className="text-xs text-gray-500">{stats.recalls > 0 ? 'Devices require immediate attention' : 'All inspected devices are clear'}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Field map — pins where recent inspections happened */}
      <InspectionsMapCard inspections={parsed} onOpenInspection={onOpenInspection} />

      {/* Recent activity */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Inspections</h2>
            <p className="text-xs text-gray-500 mt-0.5">Latest 5 reports</p>
          </div>
          <button
            onClick={onOpenInspections}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
          >
            View all →
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-bg/50 text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-3 text-left">Device / Job</th>
              <th className="px-4 py-3 text-left">Inspector</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Recall</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recent.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-600 text-sm">No inspections yet</td></tr>
            ) : recent.map(i => (
              <tr key={i.id} className="hover:bg-white/[0.02] transition cursor-pointer" onClick={() => onOpenInspection?.(i)}>
                <td className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-white">{i.ai.device_type || i.title}</p>
                  <p className="text-xs text-gray-500">{[i.ai.brand, i.ai.model].filter(Boolean).join(' · ') || '—'}</p>
                  {i.job_name && <p className="text-[11px] text-gray-400 mt-0.5 italic truncate max-w-[260px]">{i.job_name}</p>}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                      <User size={9} className="text-blue-400" />
                    </div>
                    <p className="text-xs text-gray-300 truncate max-w-[130px]">{i.inspector_name || '—'}</p>
                  </div>
                </td>
                <td className="px-4 py-3.5"><StatusBadge status={statusLabel(i)} /></td>
                <td className="px-4 py-3.5">{i.ai.has_recall
                  ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30"><ShieldAlert size={10} />RECALL</span>
                  : <span className="text-xs text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3.5 text-xs text-gray-400">{fmtDate(i.created_at)}</td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleSinglePDF(i)}
                    disabled={pdfLoading === i.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg hover:bg-blue-600/20 border border-border hover:border-blue-500/40 text-gray-400 hover:text-blue-400 text-xs font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {pdfLoading === i.id ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTIONS VIEW — full filterable / sortable table
// ─────────────────────────────────────────────────────────────────────────────
function InspectionsView({
  displayData, inspections,
  search, setSearch, filterStatus, setFilterStatus,
  sort, handleSort,
  allSelected, someSelected, selectedIds, toggleAll, toggleOne,
  onOpenInspection,
  handleSinglePDF, handleBulkPDF, pdfLoading,
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search device, job, inspector, brand…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg border border-border rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all',      label: 'All' },
            { key: 'verified', label: 'Pass' },
            { key: 'service',  label: 'Warning' },
            { key: 'flagged',  label: 'Fail' },
            { key: 'recall',   label: '⚠ Recall' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterStatus === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-bg border border-border text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 ml-auto">{displayData.length} results</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-bg/50">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-blue-500 cursor-pointer" />
              </th>
              <TH sortKey="id"         currentSort={sort} onSort={handleSort}>#</TH>
              <TH sortKey="device"     currentSort={sort} onSort={handleSort}>Device</TH>
              <TH sortKey="job"        currentSort={sort} onSort={handleSort}>Job</TH>
              <TH sortKey="inspector"  currentSort={sort} onSort={handleSort}>Inspector</TH>
              <TH sortKey="status"     currentSort={sort} onSort={handleSort}>Status</TH>
              <TH sortKey="confidence" currentSort={sort} onSort={handleSort}>Confidence</TH>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Recall</th>
              <TH sortKey="created_at" currentSort={sort} onSort={handleSort}>Date</TH>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-gray-600">
                  <FileText size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No inspections found</p>
                </td>
              </tr>
            ) : displayData.map(i => {
              const ai = i.ai
              const aiStatus = statusLabel(i)
              const isSelected = selectedIds.has(i.id)
              return (
                <tr key={i.id} className={`transition cursor-pointer ${isSelected ? 'bg-blue-600/5' : 'hover:bg-white/[0.02]'}`} onClick={() => onOpenInspection?.(i)}>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOne(i.id)} className="accent-blue-500 cursor-pointer" />
                  </td>
                  <td className="px-4 py-3.5"><span className="text-xs text-gray-500 font-mono">#{i.id}</span></td>
                  <td className="px-4 py-3.5 min-w-[200px]">
                    <p className="text-sm font-semibold text-white">{ai.device_type || i.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[ai.brand, ai.model].filter(Boolean).join(' · ') || i.description?.split('|')[0] || '—'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {ai.ai_source === 'gpt-4o' && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-400/70 font-medium">
                          <Cpu size={9} /> GPT-4o
                        </span>
                      )}
                      {ai.identification_method === 'label' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-1.5 py-0.5 rounded">
                          <CheckCircle2 size={9} /> Exact label
                        </span>
                      )}
                      {ai.identification_method === 'visual' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded" title={ai.visual_match_basis || ''}>
                          <Eye size={9} /> Visual match
                        </span>
                      )}
                      {ai.identification_method === 'blocked' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded">
                          <ImageOff size={9} /> Image quality
                        </span>
                      )}
                      {Number(ai.photo_count) > 1 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded">
                          {ai.photo_count} photos
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 min-w-[140px]">
                    <p className="text-xs text-gray-300 truncate max-w-[200px]">{i.job_name || <span className="text-gray-600">—</span>}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                        <User size={11} className="text-blue-400" />
                      </div>
                      <p className="text-xs text-gray-300 truncate max-w-[120px]">
                        {i.inspector_name || <span className="text-gray-600">Unknown</span>}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={aiStatus} /></td>
                  <td className="px-4 py-3.5"><ConfBar value={ai.confidence} /></td>
                  <td className="px-4 py-3.5">
                    {ai.has_recall ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                        <ShieldAlert size={11} />RECALL
                      </span>
                    ) : <span className="text-xs text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs text-gray-300">{fmtDate(i.created_at)}</p>
                    <p className="text-[10px] text-gray-600">{fmtTime(i.created_at)}</p>
                  </td>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleSinglePDF(i)}
                      disabled={pdfLoading === i.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg hover:bg-blue-600/20 border border-border hover:border-blue-500/40 text-gray-400 hover:text-blue-400 text-xs font-medium rounded-lg transition disabled:opacity-50"
                    >
                      {pdfLoading === i.id ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                      PDF
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {displayData.length > 0 && (
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {someSelected ? `${selectedIds.size} selected · ` : ''}
            Showing {displayData.length} of {inspections.length} inspections
          </p>
          {someSelected && (
            <button onClick={handleBulkPDF} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition">
              <Download size={12} />
              Download selected as PDF
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RECALLS VIEW — focused list of recall-flagged inspections
// ─────────────────────────────────────────────────────────────────────────────
function RecallsView({ recalls, handleSinglePDF, pdfLoading }) {
  if (recalls.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-2xl mb-4">
          <CheckCircle2 size={30} className="text-green-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">All Clear</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          No devices currently have active manufacturer recalls. New inspections will appear here automatically
          if the AI detects a matching recall (e.g. Kidde PI2010/PI9010 #18-129, BRK SC9120B #14-289).
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-400">
            {recalls.length} device{recalls.length !== 1 ? 's' : ''} require immediate action
          </p>
          <p className="text-xs text-red-400/80 mt-1">
            These inspections matched an active manufacturer recall. Notify the property owner and replace the unit per the recall instructions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recalls.map(i => {
          const ai = i.ai
          return (
            <div key={i.id} className="bg-surface border border-red-500/30 rounded-2xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert size={14} className="text-red-400" />
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Active Recall · #{i.id}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white truncate">{ai.device_type || i.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{[ai.brand, ai.model].filter(Boolean).join(' · ') || '—'}</p>
                  {i.job_name && <p className="text-xs text-gray-400 mt-1 italic truncate">📍 {i.job_name}</p>}
                </div>
                <StatusBadge status={statusLabel(i)} />
              </div>

              <div className="flex items-center gap-2 mb-3 text-xs">
                <div className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                  <User size={10} className="text-blue-400" />
                </div>
                <span className="text-gray-500">Inspected by</span>
                <span className="text-gray-300 font-medium truncate">{i.inspector_name || 'Unknown'}</span>
              </div>

              {ai.recall_info && (
                <div className="bg-bg border border-border rounded-xl p-3 mb-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Recall Notice</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{ai.recall_info}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                {ai.manufacturing_date && (
                  <div className="flex items-start gap-2">
                    <CalendarClock size={12} className="text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-gray-500">Mfg date</p>
                      <p className="text-gray-300 font-medium">{ai.manufacturing_date}</p>
                    </div>
                  </div>
                )}
                {ai.expiration_date && (
                  <div className="flex items-start gap-2">
                    <CalendarClock size={12} className={ai.expired ? 'text-red-400 mt-0.5' : 'text-gray-500 mt-0.5'} />
                    <div>
                      <p className="text-gray-500">{ai.expired ? 'Expired on' : '10-yr expiry'}</p>
                      <p className={`font-medium ${ai.expired ? 'text-red-400' : 'text-gray-300'}`}>
                        {ai.expiration_date}
                      </p>
                    </div>
                  </div>
                )}
                {ai.physical_condition && (
                  <div className="flex items-start gap-2 col-span-2">
                    <Wrench size={12} className="text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-gray-500">Condition</p>
                      <p className="text-gray-300 font-medium">{ai.physical_condition}</p>
                    </div>
                  </div>
                )}
              </div>

              {ai.identification_method === 'visual' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-3 flex items-start gap-2">
                  <Eye size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Visual fingerprint match</p>
                    <p className="text-xs text-gray-300 leading-relaxed">{ai.visual_match_basis}</p>
                  </div>
                </div>
              )}

              {ai.technical_explanation && (
                <div className="bg-bg border border-border rounded-xl p-3 mb-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Inspector Verdict
                  </p>
                  <p className="text-xs text-gray-300 leading-relaxed">{ai.technical_explanation}</p>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
                <p className="text-[10px] text-gray-500">Inspected {fmtDate(i.created_at)}</p>
                <button
                  onClick={() => handleSinglePDF(i)}
                  disabled={pdfLoading === i.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {pdfLoading === i.id ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                  Notice PDF
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS VIEW — trends and breakdowns
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsView({ stats, last30, pieData, brandData, confBuckets, parsed }) {
  const avgConfidence = parsed.length
    ? Math.round(parsed.reduce((s, p) => s + (p.ai.confidence || 0), 0) / parsed.length * 100)
    : 0
  const violationRate = stats.total
    ? Math.round((stats.flagged + stats.recalls) / stats.total * 100)
    : 0
  const verificationRate = stats.total
    ? Math.round(stats.verified / stats.total * 100)
    : 0

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Cpu}           label="Total Inspections" value={stats.total}        color="#3b82f6" />
        <StatCard icon={CheckCircle2}  label="Verification Rate" value={`${verificationRate}%`} color="#22c55e" sub={`${stats.verified} verified`} />
        <StatCard icon={TrendingUp}    label="Avg. AI Confidence" value={`${avgConfidence}%`} color="#a855f7" />
        <StatCard icon={ShieldAlert}   label="Violation Rate"    value={`${violationRate}%`}  color="#ef4444" sub={`${stats.flagged + stats.recalls} of ${stats.total}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Inspection Volume — Last 30 Days</h2>
              <p className="text-xs text-gray-500 mt-0.5">Daily activity trend</p>
            </div>
            <TrendingUp size={16} color="#3b82f6" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={last30} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="count" name="Inspections" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Status Distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">All inspections</p>
            </div>
            <Activity size={16} color="#3b82f6" />
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={88} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-600 text-sm">No data yet</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Top Brands Inspected</h2>
              <p className="text-xs text-gray-500 mt-0.5">Most common manufacturers</p>
            </div>
            <Building2 size={16} color="#3b82f6" />
          </div>
          {brandData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={brandData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="brand" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                <Bar dataKey="count" name="Inspections" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-600 text-sm">No data yet</div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">AI Confidence Distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">How sure the inspector AI was</p>
            </div>
            <Cpu size={16} color="#a855f7" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={confBuckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(168,85,247,0.06)' }} />
              <Bar dataKey="count" name="Inspections" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}
