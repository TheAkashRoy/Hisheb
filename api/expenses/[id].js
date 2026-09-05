import { collections } from '../_db.js'
import { send, methodGuard, readBody } from '../_http.js'
import { withAuth } from '../_auth.js'
import { normaliseExpense } from '../_expense.js'

async function handler(req, res) {
  const { expenses, groups } = await collections()
  const { uid } = req.session
  const id = req.query.id
  const existing = await expenses.findOne({ _id: id })
  if (!existing) return send(res, 404, { error: 'Expense not found' })
  const group = await groups.findOne({ _id: existing.groupId })
  if (!group || !group.memberUserIds.includes(uid)) return send(res, 403, { error: 'Not allowed' })

  if (req.method === 'DELETE') {
    await expenses.deleteOne({ _id: id })
    return send(res, 200, { ok: true })
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req)
    const merged = normaliseExpense({ ...existing, ...body, id })
    const members = new Set(group.memberIds)
    if (!merged.participants.every((p) => members.has(p)) || !Object.keys(merged.paidBy).every((p) => members.has(p))) {
      return send(res, 400, { error: 'Everyone on this expense must be a member of the group.' })
    }
    const { id: _id, ...rest } = merged
    await expenses.updateOne({ _id: id }, { $set: rest })
    return send(res, 200, merged)
  }

  res.setHeader('Allow', 'PATCH, DELETE')
  send(res, 405, { error: 'Method not allowed' })
}

export default withAuth(handler)
