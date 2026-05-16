import * as XLSX from 'xlsx'

/**
 * Build the canonical row shape used by both CSV and XLSX exports.
 * One row per inspection, with all data needed for billing + accounting.
 */
function parseAI(inspection) {
  try { return JSON.parse(inspection.result || '{}') } catch { return {} }
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function passFailLabel(ai, dbStatus) {
  return ai.pass_fail_status
    || (dbStatus === 'completed' ? 'Pass'
    :  dbStatus === 'failed'    ? 'Fail'
    :  dbStatus === 'in_progress' ? 'Warning'
    : 'Pending')
}

function inspectionsToRows(inspections) {
  return inspections.map((i) => {
    const ai = parseAI(i)
    const issues = Array.isArray(ai.issues) ? ai.issues : []
    return {
      'Inspection ID':  i.id,
      'Date':           fmtDate(i.created_at),
      'Time':           fmtTime(i.created_at),
      'Technician':     i.inspector_name || '',
      'Job':            i.job_name || '',
      'Device Type':    ai.device_type || i.title || '',
      'Brand':          ai.brand || '',
      'Model':          ai.model || '',
      'Date Code':      ai.date_code || '',
      'Manufactured':   ai.manufacturing_date || '',
      'Age (years)':    ai.estimated_age_years ?? '',
      'Expiration':     ai.expiration_date || '',
      'Expired':        ai.expired ? 'Yes' : 'No',
      'Status':         passFailLabel(ai, i.status),
      'AI Confidence':  ai.confidence != null ? `${Math.round(ai.confidence * 100)}%` : '',
      'Identification': ai.identification_method || '',
      'Active Recall':  ai.has_recall ? 'Yes' : 'No',
      'Recall Details': ai.recall_details || '',
      'Issues':         issues.join(' | '),
      'Compliance Notes': ai.compliance_notes || '',
      'Physical Condition': ai.physical_condition || '',
      'AI Source':      ai.ai_source || '',
    }
  })
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function csvEscape(value) {
  if (value == null) return ''
  const str = String(value)
  // Quote if it contains quotes, commas, newlines, or leading/trailing whitespace
  if (/["\n\r,]/.test(str) || /^\s|\s$/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildFilename(inspections, ext) {
  const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const suffix = inspections.length === 1
    ? `inspection-${inspections[0].id}`
    : `${inspections.length}-inspections`
  return `SmartInspect-${suffix}-${stamp}.${ext}`
}

/**
 * Export inspections to a CSV file. Triggers a browser download.
 */
export function exportInspectionsCSV(inspections) {
  if (!inspections || inspections.length === 0) return
  const rows = inspectionsToRows(inspections)
  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
  ]
  // BOM so Excel opens UTF-8 correctly
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, buildFilename(inspections, 'csv'))
}

/**
 * Export inspections to an Excel .xlsx file. Triggers a browser download.
 */
export function exportInspectionsXLSX(inspections) {
  if (!inspections || inspections.length === 0) return
  const rows = inspectionsToRows(inspections)

  const ws = XLSX.utils.json_to_sheet(rows)

  // Auto-width columns based on the widest cell content (capped).
  const headers = Object.keys(rows[0])
  ws['!cols'] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[h] ?? '').length),
    )
    return { wch: Math.min(Math.max(maxLen + 2, 10), 48) }
  })

  // Freeze the header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inspections')

  // Add a small "Summary" sheet that totals by status — useful for billing
  const summary = rows.reduce((acc, r) => {
    acc[r.Status] = (acc[r.Status] || 0) + 1
    return acc
  }, {})
  const summaryRows = [
    { Metric: 'Total Inspections', Value: rows.length },
    { Metric: 'Date Generated',    Value: new Date().toLocaleString('en-GB') },
    { Metric: '', Value: '' },
    ...Object.entries(summary).map(([k, v]) => ({ Metric: `${k} count`, Value: v })),
    { Metric: 'Active Recalls',    Value: rows.filter((r) => r['Active Recall'] === 'Yes').length },
    { Metric: 'Expired Units',     Value: rows.filter((r) => r.Expired === 'Yes').length },
  ]
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 24 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerDownload(blob, buildFilename(inspections, 'xlsx'))
}
