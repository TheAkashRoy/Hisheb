// One function serving both POST /api/settlements (create) and DELETE
// /api/settlements/:id - vercel.json rewrites the :id path here as a query
// param, so one physical file covers both.
import { collections } from './_db.js'
import { send, methodGuard, readBody, isValidId } from './_http.js'
import { withAuth } from './_auth.js'

async function handler(req, res) {
  const idParts = req.query.id
  const id = Array.isArray(idParts) ? idParts[0] : idParts
  const { settlements, groups } = await collections()
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
    const members = new Set(group.memberIds)
    if (!members.has(body.from) || !members.has(body.to)) {
      return send(res, 400, { error: 'Both people must be members of the group.' })
    }

    const doc = {
      _id: newId,
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
    return send(res, 200, { id: _id, ...rest })
  }

  if (!methodGuard(req, res, ['DELETE'])) return
  const existing = await settlements.findOne({ _id: id })
  if (!existing) return send(res, 404, { error: 'Not found' })
  const group = await groups.findOne({ _id: existing.groupId })
  if (!group || !group.memberUserIds.includes(uid)) return send(res, 403, { error: 'Not allowed' })
  await settlements.deleteOne({ _id: id })
  send(res, 200, { ok: true })
}

export default withAuth(handler)
