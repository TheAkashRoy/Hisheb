// Server-side twin of the normalisation logic in src/store.js - same rules,
// so what gets persisted always matches what the client already showed.
import { splitEqual } from '../src/lib/money.js'

export function normaliseExpense(e) {
  const paidBy = {}
  for (const [k, v] of Object.entries(e.paidBy || {})) if (v) paidBy[k] = Math.round(v)
  const total = Object.values(paidBy).reduce((a, b) => a + b, 0)

  let splits = {}
  const participants = e.participants && e.participants.length ? e.participants : Object.keys(e.splits || {})

  if (e.splitMode === 'exact') {
    for (const id of participants) splits[id] = Math.round((e.splits || {})[id] || 0)
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
    currency: e.currency || 'USD',
    category: e.category || 'general',
    date: e.date || new Date().toISOString(),
    paidBy,
    splitMode: e.splitMode === 'exact' ? 'exact' : 'equal',
    participants,
    splits,
    notes: e.notes || '',
    createdAt: e.createdAt || new Date().toISOString(),
    createdBy: e.createdBy || null,
    deleted: false,
  }
}
