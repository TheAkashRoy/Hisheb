// One function serving both POST /api/expenses (create) and PATCH/DELETE
// /api/expenses/:id - merged to stay under the Hobby plan's function limit.
import { collections } from '../_db.js'
import { send, methodGuard, readBody, isValidId } from '../_http.js'
import { withAuth } from '../_auth.js'
import { normaliseExpense } from '../_expense.js'

async function handler(req, res) {
  const idParts = req.query.id
  const id = Array.isArray(idParts) ? idParts[0] : idParts
  const { expenses, groups } = await collections()
  const { uid } = req.session

  if (!id) {
    if (!methodGuard(req, res, ['POST'])) return
    const body = await readBody(req)
    const group = await groups.findOne({ _id: body.groupId })
    if (!group || !group.memberUserIds.includes(uid)) {
      return send(res, 403, { error: "You're not a member of that group." })
    }
    const newId = isValidId(body.id) ? body.id : undefined
    if (!newId) return send(res, 400, { error: 'Missing or invalid id.' })

    const doc = normaliseExpense({ ...body, id: newId, createdAt: new Date().toISOString(), createdBy: uid })
    const members = new Set(group.memberIds)
    if (!doc.participants.every((p) => members.has(p)) || !Object.keys(doc.paidBy).every((p) => members.has(p))) {
      return send(res, 400, { error: 'Everyone on this expense must be a member of the group.' })
    }

    const { id: _id, ...rest } = doc
    try {
      await expenses.insertOne({ _id, ...rest })
    } catch (err) {
      if (err.code === 11000) return send(res, 409, { error: 'That expense already exists.' })
      throw err
    }
    return send(res, 200, doc)
  }

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
