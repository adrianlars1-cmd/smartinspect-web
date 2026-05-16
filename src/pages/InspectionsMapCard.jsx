/**
 * InspectionsMapCard — small Leaflet map showing recent inspections by GPS.
 *
 * The backend stores GPS per photo (latitude/longitude/accuracy_m), exposed
 * on inspection.result via the AI payload. Newer payloads will also carry
 * the GPS at the inspection level once we surface it through the API —
 * for now we pull GPS from the first photo of each inspection via a quick
 * fetch when the map mounts. Inspections without a fix are silently skipped.
 */

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import api from '../services/api'

// Default Leaflet markers don't load with bundlers; use inline SVG instead.
const buildIcon = (color = '#3b82f6') => L.divIcon({
  className: '',
  html: `
    <div style="position:relative; width:28px; height:36px;">
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0 C 6.5 0 0 6 0 13.6 C 0 23.6 14 36 14 36 C 14 36 28 23.6 28 13.6 C 28 6 21.5 0 14 0 Z"
              fill="${color}" stroke="#0a0f1e" stroke-width="2"/>
        <circle cx="14" cy="13.5" r="4.5" fill="#0a0f1e"/>
      </svg>
    </div>
  `,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -32],
})

const VERDICT_ICONS = {
  Pass:    buildIcon('#22c55e'),
  Warning: buildIcon('#f59e0b'),
  Fail:    buildIcon('#ef4444'),
  default: buildIcon('#3b82f6'),
}

function parseAI(i) { try { return JSON.parse(i.result || '{}') } catch { return {} } }
function passFail(i, ai) {
  return ai.pass_fail_status
    || (i.status === 'completed' ? 'Pass'
    :  i.status === 'failed'    ? 'Fail'
    :  i.status === 'in_progress' ? 'Warning'
    : 'Pending')
}

function FitToMarkers({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14)
    } else {
      map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [30, 30] })
    }
  }, [points, map])
  return null
}

/**
 * Look up GPS coords for a list of inspections by inspecting each
 * inspection's first photo metadata. We make /inspections/{id} return the
 * photo list via a new endpoint /inspections/{id}/photos.
 *
 * Since we don't have a bulk endpoint yet, we hit /inspections/{id}/photos
 * in parallel for the (recent N) inspections we care about. Skipped if
 * already loaded.
 */
async function loadGpsForInspections(inspections, limit = 30) {
  const recent = inspections.slice(0, limit)
  const results = await Promise.all(recent.map(async (i) => {
    try {
      const r = await api.get(`/inspections/${i.id}/photos`)
      const first = (r.data || []).find((p) => p.latitude != null && p.longitude != null)
      if (!first) return null
      return {
        id: i.id,
        lat: first.latitude,
        lng: first.longitude,
        accuracy: first.accuracy_m,
        captured_at: first.captured_at,
        inspection: i,
      }
    } catch {
      return null
    }
  }))
  return results.filter(Boolean)
}

export default function InspectionsMapCard({ inspections, onOpenInspection }) {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadGpsForInspections(inspections)
      .then((p) => { if (!cancelled) setPoints(p) })
      .catch((err) => {
        console.error('Failed to load GPS data:', err)
        if (!cancelled) setError(err?.message || 'Failed to load map')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [inspections])

  const fallbackCenter = [59.9139, 10.7522] // Oslo, used until we have points

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin size={14} className="text-blue-400" />
              Field Map
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Map temporarily unavailable</p>
          </div>
        </div>
        <div className="relative flex items-center justify-center bg-bg/50" style={{ height: 280 }}>
          <p className="text-sm text-gray-500">Map service unavailable. Try refreshing the page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <MapPin size={14} className="text-blue-400" />
            Field Map
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {loading ? 'Locating recent inspections…'
             : points.length === 0
                ? 'No GPS-tagged inspections yet — start one from the mobile app.'
                : `${points.length} location${points.length === 1 ? '' : 's'} on the map`}
          </p>
        </div>
      </div>
      <div className="relative" style={{ height: 280 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full bg-bg/50">
            <p className="text-sm text-gray-500">Loading map…</p>
          </div>
        ) : (
        <MapContainer
          center={points[0] ? [points[0].lat, points[0].lng] : fallbackCenter}
          zoom={points.length ? 12 : 5}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', background: '#0a0f1e' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((p) => {
            const ai = parseAI(p.inspection)
            const pf = passFail(p.inspection, ai)
            return (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={VERDICT_ICONS[pf] || VERDICT_ICONS.default}
                eventHandlers={{
                  click: () => onOpenInspection?.(p.inspection),
                }}
              >
                <Popup>
                  <div style={{ minWidth: 180, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>
                      {ai.device_type || p.inspection.title}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>
                      {[ai.brand, ai.model].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        background: pf === 'Pass' ? '#dcfce7' : pf === 'Fail' ? '#fee2e2' : '#fef3c7',
                        color:      pf === 'Pass' ? '#15803d' : pf === 'Fail' ? '#b91c1c' : '#b45309',
                      }}>{pf}</span>
                    </div>
                    {p.inspection.job_name ? (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#374151' }}>
                        📍 {p.inspection.job_name}
                      </div>
                    ) : null}
                    {p.accuracy != null ? (
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                        ± {Math.round(p.accuracy)} m · {new Date(p.captured_at || p.inspection.created_at).toLocaleString('en-GB')}
                      </div>
                    ) : null}
                    <button
                      onClick={() => onOpenInspection?.(p.inspection)}
                      style={{
                        marginTop: 8, width: '100%', padding: '6px 10px',
                        background: '#1d4ed8', color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: 11,
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Open inspection →
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
          <FitToMarkers points={points} />
        </MapContainer>
        )}
      </div>
    </div>
  )
}
