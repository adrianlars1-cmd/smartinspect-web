import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const login = (email, password) =>
  api.post('/auth/login', new URLSearchParams({ username: email, password }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export const register = (full_name, email, password) =>
  api.post('/auth/register', { full_name, email, password })

export const requestPasswordReset = (email) =>
  api.post('/auth/forgot-password', { email })

export const getMe = () => api.get('/auth/me')

export const getInspections = (skip = 0, limit = 200) =>
  api.get('/inspections/', { params: { skip, limit } })

export const getJobs = () => api.get('/jobs/')

// Admin/management — building-owner role + client assignment
export const listBuildingOwners  = ()             => api.get('/auth/users/clients')
export const updateUserRole      = (userId, role) => api.patch(`/auth/users/${userId}/role`, { role })
export const assignJobClient     = (jobId, clientId) =>
  api.patch(`/jobs/${jobId}/assign-client`, { client_id: clientId })

// Quotes (Money Button)
export const generateQuote = (payload) => api.post('/quotes/generate', payload)
export const listQuotes    = ()         => api.get('/quotes/')
export const getQuote      = (id)       => api.get(`/quotes/${id}`)
export const updateQuote   = (id, p)    => api.patch(`/quotes/${id}`, p)
export const deleteQuote   = (id)       => api.delete(`/quotes/${id}`)

// Scheduling helpers
export const listScheduledJobs = () => api.get('/jobs/scheduled')
export const updateJob         = (id, p) => api.patch(`/jobs/${id}`, p)
export const createJob         = (p)    => api.post('/jobs/', p)
export const deleteJob         = (id)   => api.delete(`/jobs/${id}`)

// Photo + signature URLs (authenticated blob URLs for inline preview)
export const fetchPhotoUrl = async (inspectionId, role) => {
  try {
    const r = await api.get(`/inspections/${inspectionId}/photo/${role}`, { responseType: 'blob' })
    return URL.createObjectURL(new Blob([r.data]))
  } catch { return null }
}

// Branding / Settings
export const getBranding    = () => api.get('/settings/branding')
export const updateBranding = (companyName) =>
  api.put('/settings/branding', { company_name: companyName })
export const deleteBrandingLogo = () => api.delete('/settings/branding/logo')

/** Returns an authenticated Blob URL for the current company logo (or null). */
export const fetchBrandingLogoUrl = async () => {
  try {
    const res = await api.get('/settings/branding/logo', { responseType: 'blob' })
    return URL.createObjectURL(new Blob([res.data]))
  } catch {
    return null
  }
}

/** Upload (or replace) the company logo. */
export const uploadBrandingLogo = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/settings/branding/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/**
 * Download the professional PDF report for a single inspection from the backend.
 * Streams the PDF as a Blob, then triggers a browser download.
 */
export const downloadInspectionPDF = async (inspection) => {
  const res = await api.get(`/inspections/${inspection.id}/pdf`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const safeTitle = (inspection.job_name || inspection.title || `inspection-${inspection.id}`)
    .replace(/[^\w\-]+/g, '_')
  const a = document.createElement('a')
  a.href = url
  a.download = `SmartInspect-${inspection.id}-${safeTitle}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Open the PDF in a new browser tab (for inline preview) */
export const openInspectionPDF = async (inspectionId) => {
  const res = await api.get(`/inspections/${inspectionId}/pdf`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const apiClient = api
export default api

// Super-Admin: Company Management
export const listCompanies = () => api.get('/admin/companies')
export const createCompany = (name) => api.post('/admin/companies', { name })
export const createCompanyAdmin = (companyId, payload) => api.post(`/admin/companies/${companyId}/admin`, payload)
export const getCompanyStats = (companyId) => api.get(`/admin/companies/${companyId}/stats`)

// Company-Admin: Inspector Management
export const listInspectors = () => api.get('/auth/users/technicians')
export const createInspector = (payload) => api.post('/auth/register', { ...payload, role: 'inspector' })

