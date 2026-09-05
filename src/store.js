import { create } from 'zustand'
import { splitEqual } from './lib/money.js'
import * as api from './lib/api.js'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2))
const now = () => new Date().toISOString()

const empty = {
  currentUserId: null,
  people: {},
  groups: {},
  expenses: {},
  settlements: {},
  settings: { currency: 'INR' },
}

function reportSyncError(err) {
  console.error('[hisheb]', err)
  useStore.setState({ syncError: err?.message || 'Something went wrong syncing with the server.' })
}

export const useStore = create((set, get) => ({
  ...empty,
  hydrated: false, // has the initial /api/state load finished (once signed in)
  syncError: null,
  authStatus: 'checking', // 'checking' | 'anon' | 'authed'
  user: null, // { id, email, name, selfPersonId }
  akashPrank: null, // local-only easter egg override, never persisted - see pullAkashDebtOntoMe()

  // ---- auth -----------------------------------------------------------
  async signup(email, password, name) {
    const user = await api.signup(email, password, name)
    set({ user, authStatus: 'authed' })
    await get().loadState()
  },
  async login(email, password) {
    const user = await api.login(email, password)
    set({ user, authStatus: 'authed' })
    await get().loadState()
  },
  async logout() {
    try {
      await api.logout()
    } catch {
      // ignore - clearing local state either way
    }
    set({ ...empty, hydrated: false, authStatus: 'anon', user: null, syncError: null, akashPrank: null })
  },
  async loadState() {
    try {
      const data = await api.fetchState()
      set({
        currentUserId: data.currentUserId,
        people: data.people || {},
        groups: data.groups || {},
        expenses: data.expenses || {},
        settlements: data.settlements || {},
        settings: data.settings || { currency: 'INR' },
        hydrated: true,
        syncError: null,
      })
    } catch (err) {
      console.error('[hisheb] failed to load state', err)
      set({ hydrated: true, syncError: 'Could not load your data - working offline.' })
    }
  },

  // ---- people -------------------------------------------------------
  // `inviteEmail` is optional: lets the person later sign up and "claim"
  // this spot instead of staying a plain name-only label forever.
  addPerson(name, inviteEmail) {
    const id = uid()
    set((s) => ({ people: { ...s.people, [id]: { id, name: name.trim() || 'Someone' } } }))
    api
      .createPerson({ id, name, inviteEmail })
      .then((p) => {
        // If the server matched an existing person by email, it may have
        // returned a different canonical id - re-key the local entry.
        set((s) => {
          const people = { ...s.people }
          delete people[id]
          people[p.id] = { id: p.id, name: p.name, me: false }
          return { people }
        })
      })
      .catch(reportSyncError)
    return id
  },
  updatePerson(id, patch) {
    set((s) => ({ people: { ...s.people, [id]: { ...s.people[id], ...patch } } }))
    api.patchPerson(id, patch).catch(reportSyncError)
  },
  removePerson(id) {
    const s = get()
    if (id === s.currentUserId) return { ok: false, reason: "You can't remove yourself." }
    const used =
      Object.values(s.groups).some((g) => g.memberIds.includes(id)) ||
      Object.values(s.expenses).some((e) => !e.deleted && (e.paidBy[id] != null || e.splits[id] != null)) ||
      Object.values(s.settlements).some((x) => !x.deleted && (x.from === id || x.to === id))
    if (used) return { ok: false, reason: 'This person is still part of a group or expense.' }
    set((st) => {
      const people = { ...st.people }
      delete people[id]
      return { people }
    })
    api.deletePerson(id).catch(reportSyncError)
    return { ok: true }
  },

  // ---- groups ------------------------------------------------------
  // Currency is always INR - the app doesn't offer a choice (also enforced
  // server-side in api/groups.js, so this can't be bypassed either).
  addGroup({ name, emoji = '👥', memberIds, simplify = true }) {
    const id = uid()
    const me = get().currentUserId
    const members = Array.from(new Set([me, ...(memberIds || [])]))
    const finalName = name.trim() || 'New group'
    set((s) => ({
      groups: {
        ...s.groups,
        [id]: {
          id,
          name: finalName,
          emoji,
          currency: 'INR',
          memberIds: members,
          simplify,
          archived: false,
          createdAt: now(),
        },
      },
    }))
    api
      .createGroup({ id, name: finalName, emoji, memberIds: members, simplify })
      .then((g) => set((s) => ({ groups: { ...s.groups, [id]: { ...s.groups[id], ...g, id } } })))
      .catch(reportSyncError)
    return id
  },
  updateGroup(id, patch) {
    set((s) => ({ groups: { ...s.groups, [id]: { ...s.groups[id], ...patch } } }))
    api.patchGroup(id, patch).catch(reportSyncError)
  },
  addMember(groupId, personId) {
    const g = get().groups[groupId]
    if (!g || g.memberIds.includes(personId)) return
    get().updateGroup(groupId, { memberIds: [...g.memberIds, personId] })
  },
  removeMember(groupId, personId) {
    const s = get()
    const g = s.groups[groupId]
    if (!g) return { ok: false }
    if (personId === s.currentUserId) return { ok: false, reason: "You can't leave your own group here." }
    const involved = Object.values(s.expenses).some(
      (e) => !e.deleted && e.groupId === groupId && (e.paidBy[personId] != null || e.splits[personId] != null),
    )
    if (involved) return { ok: false, reason: 'This member appears in an expense. Delete those first.' }
    get().updateGroup(groupId, { memberIds: g.memberIds.filter((m) => m !== personId) })
    return { ok: true }
  },
  deleteGroup(id) {
    set((s) => {
      const groups = { ...s.groups }
      delete groups[id]
      const expenses = Object.fromEntries(Object.entries(s.expenses).filter(([, e]) => e.groupId !== id))
      const settlements = Object.fromEntries(Object.entries(s.settlements).filter(([, x]) => x.groupId !== id))
      return { groups, expenses, settlements }
    })
    api.deleteGroup(id).catch(reportSyncError)
  },

  // ---- expenses --------------------------------------------------
  addExpense(input) {
    const id = uid()
    const e = normaliseExpense({ id, createdAt: now(), createdBy: get().currentUserId, ...input })
    set((s) => ({ expenses: { ...s.expenses, [id]: e } }))
    api
      .createExpense({ ...input, id })
      .then((server) => set((s) => ({ expenses: { ...s.expenses, [id]: server } })))
      .catch(reportSyncError)
    return id
  },
  updateExpense(id, patch) {
    set((s) => {
      const merged = { ...s.expenses[id], ...patch }
      return { expenses: { ...s.expenses, [id]: normaliseExpense(merged) } }
    })
    api
      .patchExpense(id, patch)
      .then((server) => set((s) => ({ expenses: { ...s.expenses, [id]: server } })))
      .catch(reportSyncError)
  },
  deleteExpense(id) {
    set((s) => {
      const expenses = { ...s.expenses }
      delete expenses[id]
      return { expenses }
    })
    api.deleteExpense(id).catch(reportSyncError)
  },

  // ---- settlements ---------------------------------------------
  addSettlement({ groupId, from, to, amount, currency, date, note }) {
    const id = uid()
    const doc = {
      id,
      groupId: groupId || null,
      from,
      to,
      amount,
      currency: currency || get().settings.currency,
      date: date || now(),
      note: note || '',
      createdAt: now(),
      createdBy: get().currentUserId,
    }
    set((s) => ({ settlements: { ...s.settlements, [id]: doc } }))
    api
      .createSettlement(doc)
      .then((server) => set((s) => ({ settlements: { ...s.settlements, [id]: server } })))
      .catch(reportSyncError)
    return id
  },
  deleteSettlement(id) {
    set((s) => {
      const settlements = { ...s.settlements }
      delete settlements[id]
      return { settlements }
    })
    api.deleteSettlement(id).catch(reportSyncError)
  },

  // ---- data ---------------------------------------------------------
  exportData() {
    const { people, groups, expenses, settlements, settings, currentUserId } = get()
    return JSON.stringify({ v: 1, currentUserId, people, groups, expenses, settlements, settings }, null, 2)
  },
  importData() {
    // Restoring an arbitrary JSON blob wholesale isn't safe once data is
    // shared with other accounts - it could silently overwrite or
    // fabricate entries in groups other people rely on. Export still works
    // as a personal read-only backup.
    return { ok: false, reason: 'Import is unavailable now that Hisheb syncs to your account - add data with the forms instead.' }
  },

  // ---- just for fun ---------------------------------------------------
  // Purely a local display trick: nothing here ever reaches the API, and
  // it evaporates on refresh (it's plain in-memory state, not part of
  // `empty`'s persisted-slice shape and never written by loadState()).
  pullAkashDebtOntoMe() {
    const s = get()
    const akash = Object.values(s.people).find((p) => !p.me && p.name.trim().toLowerCase() === 'akash')
    if (!akash) return { ok: false, reason: 'No one named Akash in your groups.' }
    set({ akashPrank: { targetId: akash.id, bonus: 199900 } }) // ₹1,999 "convenience fee"
    return { ok: true, name: akash.name }
  },
  clearAkashPrank() {
    set({ akashPrank: null })
  },
}))

// ---- bootstrap: figure out if we're already signed in ------------------
async function bootstrap() {
  try {
    const user = await api.me()
    useStore.setState({ user, authStatus: 'authed' })
    await useStore.getState().loadState()
  } catch {
    useStore.setState({ authStatus: 'anon', hydrated: true })
  }
}
bootstrap()

// Safety net: if the auth check somehow never resolves, don't leave the
// app stuck on the loading screen forever.
setTimeout(() => {
  const s = useStore.getState()
  if (s.authStatus === 'checking') useStore.setState({ authStatus: 'anon', hydrated: true })
}, 4000)

// Recompute splits so they always add up to what was paid. (Client-side
// optimistic preview only - api/_expense.js runs the same logic server-side
// as the authoritative version.)
function normaliseExpense(e) {
  const paidBy = {}
  for (const [k, v] of Object.entries(e.paidBy || {})) if (v) paidBy[k] = Math.round(v)
  const total = Object.values(paidBy).reduce((a, b) => a + b, 0)

  let splits = {}
  const participants = e.participants && e.participants.length ? e.participants : Object.keys(e.splits || {})

  if (e.splitMode === 'exact') {
    for (const id of participants) splits[id] = Math.round((e.splits || {})[id] || 0)
    // absorb any rounding gap onto the first participant
    const diff = total - Object.values(splits).reduce((a, b) => a + b, 0)
    if (participants[0] != null) splits[participants[0]] += diff
  } else {
    splits = splitEqual(total, participants)
  }

  return {
    id: e.id,
    groupId: e.groupId || null,
    description: (e.description || '').trim() || 'Expense',
    amount: total,
    currency: e.currency || 'INR',
    category: e.category || 'general',
    date: e.date || now(),
    paidBy,
    splitMode: e.splitMode === 'exact' ? 'exact' : 'equal',
    participants,
    splits,
    notes: e.notes || '',
    createdAt: e.createdAt || now(),
    createdBy: e.createdBy || null,
    deleted: false,
  }
}

// ---- selectors (plain functions) --------------------------------------
export const selectPeople = (s) => Object.values(s.people)
export const selectGroups = (s) =>
  Object.values(s.groups).sort((a, b) => (a.archived - b.archived) || b.createdAt.localeCompare(a.createdAt))
export const groupById = (s, id) => s.groups[id]
export const personById = (s, id) => s.people[id]
export const groupExpenses = (s, groupId) =>
  Object.values(s.expenses)
    .filter((e) => !e.deleted && e.groupId === groupId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
export const groupSettlements = (s, groupId) =>
  Object.values(s.settlements).filter((x) => !x.deleted && x.groupId === groupId)
export const allActivity = (s) =>
  [
    ...Object.values(s.expenses).filter((e) => !e.deleted).map((e) => ({ kind: 'expense', at: e.createdAt, data: e })),
    ...Object.values(s.settlements).filter((x) => !x.deleted).map((x) => ({ kind: 'settlement', at: x.createdAt, data: x })),
  ].sort((a, b) => b.at.localeCompare(a.at))
