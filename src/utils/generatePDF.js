import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const BG       = [10, 15, 30]
const SURFACE  = [17, 24, 39]
const ACCENT   = [59, 130, 246]
const GREEN    = [34, 197, 94]
const YELLOW   = [245, 158, 11]
const RED      = [239, 68, 68]
const WHITE    = [249, 250, 251]
const MUTED    = [107, 114, 128]
const BORDER   = [31, 41, 55]

function statusColor(status) {
  if (status === 'Verified'     || status === 'completed') return GREEN
  if (status === 'Needs Service'|| status === 'in_progress') return YELLOW
  if (status === 'Flagged'      || status === 'failed')   return RED
  return MUTED
}

function parseResult(inspection) {
  try { return JSON.parse(inspection.result || '{}') } catch { return {} }
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function generateInspectionPDF(inspection) {
  const ai = parseResult(inspection)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(...BG)
  doc.rect(0, 0, pageW, 38, 'F')

  doc.setTextColor(...WHITE)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('SmartInspect AI', 14, 16)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text('Control Center  ·  Inspection Report', 14, 23)

  // Report ID pill (top-right)
  doc.setFillColor(...ACCENT)
  doc.roundedRect(pageW - 52, 10, 38, 10, 2, 2, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Report #${inspection.id}`, pageW - 33, 16.5, { align: 'center' })

  // ── Recall warning banner (shown only when applicable) ─────────────────────
  let y = 46
  if (ai.has_recall) {
    doc.setFillColor(239, 68, 68, 0.15)
    doc.setDrawColor(...RED)
    doc.setLineWidth(0.4)
    doc.roundedRect(14, y, pageW - 28, 22, 3, 3, 'FD')

    doc.setTextColor(...RED)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('⚠  SAFETY RECALL DETECTED', 20, y + 8)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const recallText = ai.recall_details || 'This device has an active safety recall. Discontinue use immediately.'
    const lines = doc.splitTextToSize(recallText, pageW - 40)
    doc.text(lines, 20, y + 15)

    y += 28
  }

  // ── Status badge ───────────────────────────────────────────────────────────
  const aiStatus = ai.status || inspection.result || 'Unknown'
  const sColor = statusColor(aiStatus)
  doc.setFillColor(sColor[0], sColor[1], sColor[2])
  doc.roundedRect(14, y, 50, 10, 2, 2, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(aiStatus.toUpperCase(), 39, y + 6.5, { align: 'center' })

  if (ai.ai_source === 'gpt-4o') {
    doc.setFillColor(...SURFACE)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(70, y, 36, 10, 2, 2, 'FD')
    doc.setTextColor(...MUTED)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('GPT-4o Vision', 88, y + 6.5, { align: 'center' })
  }

  y += 16

  // ── Device Identification table ────────────────────────────────────────────
  doc.setTextColor(...WHITE)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Device Identification', 14, y)
  y += 4

  const ageText = ai.estimated_age_years != null
    ? `${ai.estimated_age_years} year${ai.estimated_age_years === 1 ? '' : 's'}`
    : '—'

  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Device Type',         ai.device_type || inspection.title || '—'],
      ['Brand',               ai.brand        || '—'],
      ['Model',               ai.model        || '—'],
      ['Manufacturing Date',  ai.manufacturing_date || 'Not visible'],
      ['Estimated Age',       ageText],
      ['Status',              aiStatus],
      ['AI Confidence',       ai.confidence != null ? `${Math.round(ai.confidence * 100)}%` : '—'],
      ['Safety Recall',       ai.has_recall ? 'YES — Recall Active' : 'None'],
      ['Inspection Date',     fmt(inspection.created_at)],
      ['Inspection ID',       `#${inspection.id}`],
    ],
    styles: {
      fillColor: SURFACE,
      textColor: WHITE,
      lineColor: BORDER,
      lineWidth: 0.3,
      fontSize: 9,
    },
    headStyles: {
      fillColor: BG,
      textColor: MUTED,
      fontStyle: 'bold',
      fontSize: 8,
      textTransform: 'uppercase',
    },
    alternateRowStyles: { fillColor: [26, 34, 53] },
    columnStyles: {
      0: { cellWidth: 50, textColor: MUTED },
      1: { fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Compliance Assessment section ──────────────────────────────────────────
  const hasComplianceData =
    ai.physical_condition || ai.compliance_notes || ai.manufacturing_date

  if (hasComplianceData) {
    doc.setTextColor(...WHITE)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Compliance Assessment', 14, y)
    y += 4

    const complianceRows = []
    if (ai.physical_condition) {
      complianceRows.push(['Physical Condition', ai.physical_condition])
    }
    if (ai.compliance_notes) {
      complianceRows.push(['NFPA / Code Compliance', ai.compliance_notes])
    }

    autoTable(doc, {
      startY: y,
      body: complianceRows,
      styles: {
        fillColor: SURFACE,
        textColor: WHITE,
        lineColor: BORDER,
        lineWidth: 0.3,
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 50, textColor: MUTED, fontStyle: 'bold', fontSize: 8 },
        1: {},
      },
      didParseCell(data) {
        // Highlight code violations in red
        if (
          data.section === 'body' &&
          data.column.index === 1 &&
          typeof data.cell.raw === 'string' &&
          data.cell.raw.toLowerCase().includes('violation')
        ) {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: 14, right: 14 },
    })

    y = doc.lastAutoTable.finalY + 10
  }

  // ── Issues section ─────────────────────────────────────────────────────────
  const issues = Array.isArray(ai.issues) ? ai.issues : []
  if (issues.length > 0) {
    doc.setTextColor(...WHITE)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Inspector Findings', 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['#', 'Issue']],
      body: issues.map((issue, i) => [i + 1, issue]),
      styles: {
        fillColor: SURFACE,
        textColor: WHITE,
        lineColor: BORDER,
        lineWidth: 0.3,
        fontSize: 9,
      },
      headStyles: {
        fillColor: BG,
        textColor: MUTED,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [26, 34, 53] },
      columnStyles: { 0: { cellWidth: 12, textColor: MUTED } },
      margin: { left: 14, right: 14 },
    })

    y = doc.lastAutoTable.finalY + 10
  }

  // ── Notes / description ────────────────────────────────────────────────────
  if (inspection.description) {
    doc.setFillColor(...SURFACE)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(14, y, pageW - 28, 18, 3, 3, 'FD')

    doc.setTextColor(...MUTED)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('DESCRIPTION', 20, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...WHITE)
    const descLines = doc.splitTextToSize(inspection.description, pageW - 50)
    doc.text(descLines, 20, y + 12)
    y += 24
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...BG)
    doc.rect(0, pageH - 14, pageW, 14, 'F')
    doc.setTextColor(...MUTED)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Generated by SmartInspect AI Control Center  ·  ${new Date().toLocaleString('en-GB')}`,
      14, pageH - 5,
    )
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 5, { align: 'right' })
  }

  doc.save(`smartinspect-report-${inspection.id}.pdf`)
}

export function generateBulkPDF(inspections) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(...BG)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('SmartInspect AI — Inspection Summary', 14, 14)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(`${inspections.length} inspections  ·  Generated ${new Date().toLocaleString('en-GB')}`, 14, 22)

  // Stats row
  const total     = inspections.length
  const verified  = inspections.filter(i => { const r = parseResult(i); return r.status === 'Verified' || i.status === 'completed' }).length
  const service   = inspections.filter(i => { const r = parseResult(i); return r.status === 'Needs Service' || i.status === 'in_progress' }).length
  const flagged   = inspections.filter(i => { const r = parseResult(i); return r.status === 'Flagged' || i.status === 'failed' }).length
  const recalls   = inspections.filter(i => parseResult(i).has_recall).length

  const stats = [
    ['Total', total, ACCENT],
    ['Verified', verified, GREEN],
    ['Needs Service', service, YELLOW],
    ['Flagged', flagged, RED],
    ['Active Recalls', recalls, RED],
  ]

  let sx = 14
  stats.forEach(([label, val, color]) => {
    doc.setFillColor(color[0], color[1], color[2])
    doc.roundedRect(sx, 34, 46, 18, 3, 3, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(String(val), sx + 23, 46, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(label.toUpperCase(), sx + 23, 50, { align: 'center' })
    sx += 52
  })

  // Table
  autoTable(doc, {
    startY: 58,
    head: [['ID', 'Device', 'Brand', 'Model', 'Status', 'Confidence', 'Recall', 'Date']],
    body: inspections.map(i => {
      const ai = parseResult(i)
      return [
        `#${i.id}`,
        ai.device_type || i.title,
        ai.brand  || '—',
        ai.model  || '—',
        ai.status || i.status,
        ai.confidence != null ? `${Math.round(ai.confidence * 100)}%` : '—',
        ai.has_recall ? 'YES' : 'No',
        new Date(i.created_at).toLocaleDateString('en-GB'),
      ]
    }),
    styles: {
      fillColor: SURFACE,
      textColor: WHITE,
      lineColor: BORDER,
      lineWidth: 0.3,
      fontSize: 8,
    },
    headStyles: {
      fillColor: BG,
      textColor: MUTED,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [26, 34, 53] },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 6 && data.cell.raw === 'YES') {
        data.cell.styles.textColor = RED
        data.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: 14, right: 14 },
  })

  // Footer
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...BG)
    doc.rect(0, pageH - 12, pageW, 12, 'F')
    doc.setTextColor(...MUTED)
    doc.setFontSize(7)
    doc.text('SmartInspect AI Control Center', 14, pageH - 4)
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 4, { align: 'right' })
  }

  doc.save(`smartinspect-summary-${Date.now()}.pdf`)
}
