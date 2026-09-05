import { collections } from './_db.js'
import { send, methodGuard, readBody, isValidId } from './_http.js'
import { withAuth } from './_auth.js'

async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  const { settlements, groups } = await collections()
  const { uid } = req.session
  const body = await readBody(req)

  const group = await groups.findOne({ _id: body.groupId })
  if (!group || !group.memberUserIds.includes(uid)) {
    return send(res, 403, { error: "You're not a member of that group." })
  }

  const id = isValidId(body.id) ? body.id : undefined
  if (!id) return send(res, 400, { error: 'Missing or invalid id.' })
  const members = new Set(group.memberIds)
  if (!members.has(body.from) || !members.has(body.to)) {
    return send(res, 400, { error: 'Both people must be members of the group.' })
  }

  const doc = {
    _id: id,
    groupId: body.groupId,
    from: body.from,
    to: body.to,
    amount: Math.round(Number(body.amount) || 0),
    currency: body.currency || group.currency,
    date: body.date || new Date().toISOString(),
    note: body.note || '',
    createdAt: new Date().toISOString(),
    createdBy: uid,
  }
  try {
    await settlements.insertOne(doc)
  } catch (err) {
    if (err.code === 11000) return send(res, 409, { error: 'That payment already exists.' })
    throw err
  }
  const { _id, ...rest } = doc
  send(res, 200, { id: _id, ...rest })
}

export default withAuth(handler)
