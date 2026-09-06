// Talks to the /api/* serverless functions backed by MongoDB Atlas.
const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body && body.error) message = body.error
    } catch {
      // ignore - not JSON
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

// ---- auth --------------------------------------------------------------
export const signup = (email, password, name) =>
  request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) })
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
export const logout = () => request('/auth/logout', { method: 'POST' })
export const me = () => request('/auth/me')

// ---- state ---------------------------------------------------------------
export const fetchState = () => request('/state')

// ---- ledger (append-only history) -------------------------------------
export const fetchLedger = () => request('/ledger')

// ---- people --------------------------------------------------------------
export const createPerson = (payload) => request('/people', { method: 'POST', body: JSON.stringify(payload) })
export const patchPerson = (id, patch) => request(`/people/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const deletePerson = (id) => request(`/people/${id}`, { method: 'DELETE' })

// ---- groups ----------------------------------------------------------
export const createGroup = (payload) => request('/groups', { method: 'POST', body: JSON.stringify(payload) })
export const patchGroup = (id, patch) => request(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const deleteGroup = (id) => request(`/groups/${id}`, { method: 'DELETE' })

// ---- expenses --------------------------------------------------------
export const createExpense = (payload) => request('/expenses', { method: 'POST', body: JSON.stringify(payload) })
export const patchExpense = (id, patch) => request(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const deleteExpense = (id) => request(`/expenses/${id}`, { method: 'DELETE' })

// ---- settlements -------------------------------------------------------
export const createSettlement = (payload) => request('/settlements', { method: 'POST', body: JSON.stringify(payload) })
export const deleteSettlement = (id) => request(`/settlements/${id}`, { method: 'DELETE' })
