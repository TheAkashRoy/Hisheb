import { collections } from './_db.js'
import { send, methodGuard, readBody, isValidId } from './_http.js'
import { withAuth } from './_auth.js'
import { normaliseExpense } from './_expense.js'

async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  const { expenses, groups } = await collections()
  const { uid } = req.session
  const body = await readBody(req)

  const group = await groups.findOne({ _id: body.groupId })
  if (!group || !group.memberUserIds.includes(uid)) {
    return send(res, 403, { error: "You're not a member of that group." })
  }
  const id = isValidId(body.id) ? body.id : undefined
  if (!id) return send(res, 400, { error: 'Missing or invalid id.' })

  const doc = normaliseExpense({ ...body, id, createdAt: new Date().toISOString(), createdBy: uid })
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
  send(res, 200, doc)
}

export default withAuth(handler)
