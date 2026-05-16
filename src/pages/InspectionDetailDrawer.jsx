/**
 * InspectionDetailDrawer — slide-over right panel showing the full inspection
 * (photos, AI verdict, history, notes, signature status) plus a prominent
 * "Generate Repair Quote" button → preview & save the quote inline.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  X, CheckCircle2, AlertTriangle, XCircle, Activity,
  ShieldAlert, Download, FileText, Sparkles, Cpu, Eye, ImageOff,
  CalendarClock, MapPin, User, Building2, RefreshCw, Trash2,
} from 'lucide-react'
import {
  fetchPhotoUrl, downloadInspectionPDF,
  generateQuote, updateQuote, deleteQuote,
} from '../services/api'

const STATUS_BADGE = {
  Pass:    { bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30',  icon: CheckCircle2 },
  Warning: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: AlertTriangle },
  Fail:    { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30',    icon: XCircle },
  Pending: { bg: 'bg-gray-500/15',   text: 'text-gray-400',   border: 'border-gray-500/30',   icon: Activity },
  NEEDS_MORE_INFO: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30', icon: Activity },
}

function parseAI(i) { try { return JSON.parse(i.result || '{}') } catch { return {} } }
function passFail(i, ai) {
  return ai.pass_fail_status
    || (i.status === 'completed' ? 'Pass'
    :  i.status === 'failed'    ? 'Fail'
    :  i.status === 'in_progress' ? 'Warning'
    : 'Pending')
}
function fmtMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100)
}
function fmtDate(s) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function InspectionDetailDrawer({ inspection, onClose }) {
  const [photoUrls, setPhotoUrls]   = useState({})  // role → blob URL
  const [pdfLoading, setPdfLoading] = useState(false)
  const [quote, setQuote]           = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')

  const ai = useMemo(() => inspection ? parseAI(inspection) : {}, [inspection])
  const verdict = inspection ? passFail(inspection, ai) : 'Pending'
  const cfg = STATUS_BADGE[verdict] || STATUS_BADGE.Pending
  const VerdictIcon = cfg.icon

  // Load any captured photos
  useEffect(() => {
    if (!inspection) return
    let cancelled = false
    const next = {}
    const roles = ['front', 'label', 'context', 'followup']
    Promise.all(roles.map((r) =>
      fetchPhotoUrl(inspection.id, r).then((url) => { if (url) next[r] = url })
    )).then(() => { if (!cancelled) setPhotoUrls(next) })
    return () => {
      cancelled = true
      Object.values(next).forEach((u) => u && URL.revokeObjectURL(u))
    }
  }, [inspection?.id])

  const handlePDF = async () => {
    setPdfLoading(true)
    try { await downloadInspectionPDF(inspection) }
    catch (e) { alert(e?.response?.data?.detail || 'PDF failed') }
    finally { setPdfLoading(false) }
  }

  const handleGenerateQuote = useCallback(async () => {
    if (!inspection) return
    setQuoteLoading(true); setQuoteError('')
    try {
      const { data } = await generateQuote({
        inspection_id: inspection.id,
        currency: 'USD',
        tax_rate: 0.0,
      })
      setQuote(data)
    } catch (e) {
      setQuoteError(e?.response?.data?.detail || 'Could not generate quote.')
    } finally {
      setQuoteLoading(false)
    }
  }, [inspection])

  const handleMarkSent = async () => {
    if (!quote) return
    try {
      const { data } = await updateQuote(quote.id, { status: 'sent' })
      setQuote(data)
    } catch (e) { alert(e?.response?.data?.detail || 'Failed.') }
  }
  const handleDiscardQuote = async () => {
    if (!quote) return
    if (!confirm('Discard this draft quote?')) return
    try {
      await deleteQuote(quote.id)
      setQuote(null)
    } catch (e) { alert(e?.response?.data?.detail || 'Failed.') }
  }

  if (!inspection) return null

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-[640px] max-w-full bg-surface border-l border-border h-full overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Inspection #{inspection.id}</p>
            <h2 className="text-base font-bold text-white truncate">
              {ai.device_type || inspection.title}
            </h2>
            <p className="text-xs text-gray-500 truncate">
              {[ai.brand, ai.model].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Verdict banner */}
          <div className={`rounded-2xl p-5 border ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center gap-3">
              <VerdictIcon size={28} className={cfg.text} strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className={`text-2xl font-bold ${cfg.text}`}>{verdict.replace('_', ' ')}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  AI confidence: {Math.round((ai.confidence || 0) * 100)}% · {' '}
                  {ai.identification_method === 'label' ? 'Exact label match' :
                   ai.identification_method === 'visual' ? 'Visual fingerprint match' :
                   ai.identification_method === 'blocked' ? 'Image quality issue' : 'AI identified'}
                </p>
              </div>
            </div>
            {ai.technical_explanation ? (
              <p className="text-sm text-gray-300 mt-4 leading-relaxed">{ai.technical_explanation}</p>
            ) : null}
          </div>

          {/* Recall banner */}
          {ai.has_recall ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-400">ACTIVE SAFETY RECALL</p>
                <p className="text-xs text-gray-300 mt-1">{ai.recall_details || 'Subject to a CPSC recall.'}</p>
              </div>
            </div>
          ) : null}

          {/* THE MONEY BUTTON */}
          {!quote ? (
            <button
              onClick={handleGenerateQuote}
              disabled={quoteLoading}
              className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-60 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition"
            >
              {quoteLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Generating quote…</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span className="text-base">Generate Repair Quote</span>
                  <span className="text-[10px] font-medium opacity-70 uppercase tracking-wider">AI-priced</span>
                </>
              )}
            </button>
          ) : (
            <QuotePreview
              quote={quote}
              onMarkSent={handleMarkSent}
              onDiscard={handleDiscardQuote}
              onRegenerate={handleGenerateQuote}
            />
          )}
          {quoteError ? (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl px-3 py-2">
              {quoteError}
            </div>
          ) : null}

          {/* Meta + photos */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Meta icon={CalendarClock} label="Manufactured" value={ai.manufacturing_date || 'Not visible'} />
            <Meta icon={CalendarClock} label={ai.expired ? 'Expired on' : '10-yr expiry'} value={ai.expiration_date || '—'} alert={ai.expired} />
            <Meta icon={User} label="Inspector" value={inspection.inspector_name || '—'} />
            <Meta icon={Building2} label="Building / Job" value={inspection.job_name || '—'} />
          </div>

          {Object.keys(photoUrls).length > 0 ? (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Photos</h3>
              <div className="grid grid-cols-3 gap-2">
                {['front', 'label', 'context'].map((role) => (
                  photoUrls[role] ? (
                    <div key={role} className="relative bg-bg rounded-xl overflow-hidden border border-border">
                      <img src={photoUrls[role]} alt={role} className="w-full aspect-square object-cover" />
                      <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide font-bold">
                        {role}
                      </span>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          ) : null}

          {ai.compliance_notes ? (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">NFPA / Code Compliance</h3>
              <p className={`text-sm leading-relaxed ${(ai.compliance_notes || '').toLowerCase().includes('violation') ? 'text-red-400' : 'text-gray-300'}`}>
                {ai.compliance_notes}
              </p>
            </div>
          ) : null}

          {Array.isArray(ai.issues) && ai.issues.length > 0 ? (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Inspector Findings</h3>
              <ul className="space-y-1.5">
                {ai.issues.map((issue, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${ai.has_recall ? 'bg-red-400' : 'bg-yellow-400'}`} />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {inspection.inspector_notes ? (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Inspector Note</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{inspection.inspector_notes}</p>
            </div>
          ) : null}

          <button
            onClick={handlePDF}
            disabled={pdfLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-border hover:border-blue-500/50 text-gray-400 hover:text-blue-400 text-sm rounded-xl transition"
          >
            {pdfLoading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Download official PDF report
          </button>

        </div>
      </div>
    </div>
  )
}

function Meta({ icon: Icon, label, value, alert }) {
  return (
    <div className={`bg-bg border ${alert ? 'border-red-500/40' : 'border-border'} rounded-xl p-3`}>
      <div className="flex items-center gap-1.5 text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">
        <Icon size={11} /> {label}
      </div>
      <p className={`text-sm font-semibold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote preview panel
// ─────────────────────────────────────────────────────────────────────────────
function QuotePreview({ quote, onMarkSent, onDiscard, onRegenerate }) {
  const isDraft = quote.status === 'draft'
  return (
    <div className="bg-bg border border-blue-500/30 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-400" />
          <p className="text-sm font-bold text-white">Repair Quote #{quote.id}</p>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            quote.status === 'sent' ? 'bg-blue-500/20 text-blue-400'
            : quote.status === 'accepted' ? 'bg-green-500/20 text-green-400'
            : quote.status === 'rejected' ? 'bg-red-500/20 text-red-400'
            : 'bg-gray-500/20 text-gray-400'
          }`}>
            {quote.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onRegenerate} className="p-1.5 text-gray-500 hover:text-white" title="Regenerate from AI findings">
            <RefreshCw size={13} />
          </button>
          {isDraft ? (
            <button onClick={onDiscard} className="p-1.5 text-gray-500 hover:text-red-400" title="Discard">
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-gray-500 bg-bg/40">
          <tr>
            <th className="px-5 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Unit</th>
            <th className="px-5 py-2 text-right">Line Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {quote.line_items.map((li) => (
            <tr key={li.id}>
              <td className="px-5 py-3">
                <div className="flex items-start gap-2">
                  {li.severity === 'critical' ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-white">{li.description}</p>
                    {li.detail ? <p className="text-[11px] text-gray-500 mt-0.5">{li.detail}</p> : null}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-right text-gray-300 tabular-nums">{li.quantity}</td>
              <td className="px-3 py-3 text-right text-gray-400 tabular-nums">{fmtMoney(li.unit_price_cents, quote.currency)}</td>
              <td className="px-5 py-3 text-right text-white font-semibold tabular-nums">{fmtMoney(li.total_cents, quote.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-bg/40 text-xs">
          <tr><td className="px-5 py-2 text-gray-500" colSpan={3}>Subtotal</td><td className="px-5 py-2 text-right text-gray-300 tabular-nums">{fmtMoney(quote.subtotal_cents, quote.currency)}</td></tr>
          {quote.tax_cents > 0 ? (
            <tr><td className="px-5 py-2 text-gray-500" colSpan={3}>Tax ({Math.round(quote.tax_rate * 100)}%)</td><td className="px-5 py-2 text-right text-gray-300 tabular-nums">{fmtMoney(quote.tax_cents, quote.currency)}</td></tr>
          ) : null}
          <tr><td className="px-5 py-3 text-white font-bold" colSpan={3}>TOTAL</td><td className="px-5 py-3 text-right text-white font-bold tabular-nums text-base">{fmtMoney(quote.total_cents, quote.currency)}</td></tr>
        </tfoot>
      </table>

      {isDraft ? (
        <div className="border-t border-border px-5 py-3 flex justify-end">
          <button
            onClick={onMarkSent}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition"
          >
            Mark as sent to client
          </button>
        </div>
      ) : null}
    </div>
  )
}
