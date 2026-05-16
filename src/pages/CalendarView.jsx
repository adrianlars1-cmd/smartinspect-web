/**
 * CalendarView — admin / dispatcher view of scheduled jobs.
 *
 * Uses FullCalendar (dayGrid + timeGrid). Each event = one Job with a
 * scheduled_time. Drag-and-drop to reschedule, click empty slot to create
 * a new job, click an event to reassign technician / edit details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { X, MapPin, User2, Clock, Trash2, RefreshCw, CalendarPlus } from 'lucide-react'
import {
  getJobs, createJob, updateJob, deleteJob,
} from '../services/api'
import api from '../services/api'

// Tiny helper — list of technicians (= inspectors + admins)
const listTechnicians = () => api.get('/auth/users/technicians')

// Colours per status
const STATUS_COLORS = {
  in_progress: '#3b82f6',   // blue
  completed:   '#22c55e',   // green
}

function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  // datetime-local needs YYYY-MM-DDTHH:MM in local tz
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  return local.toISOString().slice(0, 16)
}

function CSSInjector() {
  // Inject FullCalendar dark theme overrides once (avoids importing a separate CSS file).
  useEffect(() => {
    const id = 'fullcalendar-dark-overrides'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      .fc { background:#0a0f1e; color:#f9fafb; border-color:#1f2937; }
      .fc-theme-standard td, .fc-theme-standard th, .fc-theme-standard .fc-scrollgrid { border-color:#1f2937 !important; }
      .fc .fc-toolbar-title { color:#f9fafb; font-size:18px; font-weight:700; }
      .fc .fc-button { background:#111827 !important; border-color:#1f2937 !important; color:#f9fafb !important; box-shadow:none !important; font-size:12px !important; padding:6px 10px !important; }
      .fc .fc-button-primary:not(:disabled).fc-button-active { background:#1d4ed8 !important; border-color:#1d4ed8 !important; }
      .fc .fc-col-header-cell-cushion, .fc .fc-daygrid-day-number { color:#9ca3af; font-size:11px; padding:6px; }
      .fc-day-today { background:rgba(59,130,246,0.06) !important; }
      .fc-event { border:none !important; padding:2px 6px; font-size:11px; cursor:pointer; }
      .fc-h-event { background:#3b82f6; border-color:#3b82f6; }
      .fc .fc-scroller-liquid-absolute { background:#0a0f1e; }
      .fc .fc-timegrid-slot { background:#0a0f1e; }
      .fc-event-title { font-weight:600; }
      .fc-event-time { opacity:0.8; }
    `
    document.head.appendChild(style)
  }, [])
  return null
}

export default function CalendarView() {
  const [jobs, setJobs]               = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading]         = useState(true)
  const [editorJob, setEditorJob]     = useState(null)   // open in side panel
  const [newJobStart, setNewJobStart] = useState(null)
  const calendarRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [j, t] = await Promise.all([
        getJobs(),
        listTechnicians().catch(() => ({ data: [] })),
      ])
      setJobs(j.data)
      setTechnicians(t.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Map jobs → FullCalendar event objects
  const events = useMemo(() => jobs
    .filter((j) => j.scheduled_time)
    .map((j) => ({
      id: String(j.id),
      title: `${j.name}${j.client_name ? ` — ${j.client_name}` : ''}`,
      start: j.scheduled_time,
      // No fixed end time — render as ~1h block in time grid
      backgroundColor: STATUS_COLORS[j.status] || '#3b82f6',
      borderColor: STATUS_COLORS[j.status] || '#3b82f6',
      extendedProps: { job: j },
    })), [jobs])

  // Drag-and-drop to reschedule
  const handleEventDrop = async (info) => {
    const id = Number(info.event.id)
    const newStart = info.event.start?.toISOString()
    if (!newStart) return
    try {
      await updateJob(id, { scheduled_time: newStart })
      refresh()
    } catch (e) {
      info.revert()
      alert(e?.response?.data?.detail || 'Could not reschedule job.')
    }
  }

  const handleEventClick = (info) => {
    const job = info.event.extendedProps.job
    setEditorJob(job)
  }

  const handleDateClick = (info) => {
    setEditorJob(null)
    setNewJobStart(info.dateStr)
  }

  return (
    <>
      <CSSInjector />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">Scheduled Jobs</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Click a date to schedule a new job · drag events to reschedule · click an event to edit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-border text-gray-400 hover:text-white text-sm rounded-xl transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditorJob(null)
              setNewJobStart(new Date().toISOString().slice(0, 10))
            }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition"
          >
            <CalendarPlus size={14} />
            New scheduled job
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          height="auto"
          events={events}
          editable={true}
          selectable={true}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
          dayMaxEvents={3}
          firstDay={1}
        />
      </div>

      {(editorJob || newJobStart) && (
        <JobEditor
          job={editorJob}
          initialStart={newJobStart}
          technicians={technicians}
          onClose={() => { setEditorJob(null); setNewJobStart(null) }}
          onSaved={() => { setEditorJob(null); setNewJobStart(null); refresh() }}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Side-panel editor for create + edit + reassign + delete
// ─────────────────────────────────────────────────────────────────────────────
function JobEditor({ job, initialStart, technicians, onClose, onSaved }) {
  const isNew = !job
  const [name, setName]                 = useState(job?.name || '')
  const [clientName, setClientName]     = useState(job?.client_name || '')
  const [location, setLocation]         = useState(job?.location || '')
  const [scheduledTime, setScheduledTime] = useState(
    toLocalInputValue(job?.scheduled_time || initialStart || '')
  )
  const [technicianId, setTechnicianId] = useState(job?.inspector_id ? String(job.inspector_id) : '')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const isoTime = scheduledTime ? new Date(scheduledTime).toISOString() : null
      if (isNew) {
        await createJob({
          name: name.trim(),
          client_name: clientName.trim() || null,
          location: location.trim() || null,
          scheduled_time: isoTime,
          technician_id: technicianId ? Number(technicianId) : null,
        })
      } else {
        await updateJob(job.id, {
          name: name.trim(),
          client_name: clientName.trim() || null,
          location: location.trim() || null,
          scheduled_time: isoTime,
        })
      }
      onSaved()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save job.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!job) return
    if (!confirm(`Delete "${job.name}"? This removes the job and all its inspections.`)) return
    try {
      await deleteJob(job.id)
      onSaved()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to delete.')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-[420px] max-w-full bg-surface border-l border-border h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h3 className="text-base font-bold text-white">
              {isNew ? 'Schedule a Job' : `Edit Job #${job.id}`}
            </h3>
            <p className="text-xs text-gray-500">
              {isNew ? 'Assign to a technician and set time' : 'Reassign, reschedule, or edit details'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Job name">
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blokk E — Q2 Inspection"
              className="ipt" />
          </Field>

          <Field label="Client / Building owner">
            <input
              value={clientName} onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Property Mgmt"
              className="ipt" />
          </Field>

          <Field label="Location" icon={MapPin}>
            <input
              value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Address or building/floor"
              className="ipt" />
          </Field>

          <Field label="Scheduled time" icon={Clock}>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="ipt" />
          </Field>

          <Field label="Assigned technician" icon={User2}>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              disabled={!isNew}
              className="ipt"
            >
              <option value="">— Self —</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.email})
                </option>
              ))}
            </select>
            {!isNew && (
              <p className="text-[10px] text-gray-500 mt-1">
                Reassign is set on creation only — delete and re-create to reassign.
              </p>
            )}
          </Field>

          {error ? (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl px-3 py-2">
              {error}
            </div>
          ) : null}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition"
            >
              {saving ? 'Saving…' : isNew ? 'Schedule' : 'Save changes'}
            </button>
            {!isNew && (
              <button
                onClick={handleDelete}
                className="px-3 py-2.5 bg-surface border border-border text-gray-400 hover:text-red-400 hover:border-red-500/50 text-sm rounded-xl transition"
                title="Delete job"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <style>{`.ipt { width:100%; background:#0a0f1e; border:1px solid #1f2937; border-radius:10px; padding:9px 12px; color:#f9fafb; font-size:13px; }`}</style>
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        {Icon ? <Icon size={11} /> : null}
        {label}
      </label>
      {children}
    </div>
  )
}
