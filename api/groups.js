// One function serving both POST /api/groups (create) and PATCH/DELETE
// /api/groups/:id - vercel.json rewrites the :id path here as a query
// param, so one physical file covers both.
import { collections } from './_db.js'
import { send, methodGuard, readBody, isValidId } from './_http.js'
import { withAuth } from './_auth.js'
import { existingPersonIds, resolveMemberUserIds } from './_people.js'

function toClient(g) {
  const { _id, memberUserIds, ...rest } = g
  return { id: _id, ...rest }
}

async function handler(req, res) {
  const idParts = req.query.id
  const id = Array.isArray(idParts) ? idParts[0] : idParts
  const { groups, users, people, expenses, settlements } = await collections()
  const { uid } = req.session

  if (!id) {
    if (!methodGuard(req, res, ['POST'])) return
    const user = await users.findOne({ _id: uid })
    const body = await readBody(req)

    const newId = isValidId(body.id) ? body.id : undefined
    if (!newId) return send(res, 400, { error: 'Missing or invalid id.' })

    const name = String(body.name || '').trim() || 'New group'
    const emoji = body.emoji || '👥'
    const currency = body.currency || user?.settings?.currency || 'USD'
    const simplify = body.simplify !== false
    const requested = Array.isArray(body.memberIds) ? body.memberIds : []

    const exists = await existingPersonIds(requested, people)
    const memberIds = Array.from(new Set([user.selfPersonId, ...requested.filter((pid) => exists.has(pid))]))
    const memberUserIds = await resolveMemberUserIds(memberIds, people)

    const doc = {
      _id: newId,
      name,
      emoji,
      currency,
      simplify,
      archived: false,
      memberIds,
      memberUserIds,
      createdBy: uid,
      createdAt: new Date().toISOString(),
    }
    try {
      await groups.insertOne(doc)
    } catch (err) {
      if (err.code === 11000) return send(res, 409, { error: 'That group already exists.' })
      throw err
    }
    const { _id, memberUserIds: _mu, ...rest } = doc
    return send(res, 200, { id: _id, ...rest })
  }

  const group = await groups.findOne({ _id: id })
  if (!group) return send(res, 404, { error: 'Group not found' })
  if (!group.memberUserIds.includes(uid)) return send(res, 403, { error: 'Not a member of this group' })

  if (req.method === 'DELETE') {
    await groups.deleteOne({ _id: id })
    await expenses.deleteMany({ groupId: id })
    await settlements.deleteMany({ groupId: id })
    return send(res, 200, { ok: true })
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req)
    const patch = {}
    if (typeof body.name === 'string') patch.name = body.name.trim() || group.name
    if (typeof body.emoji === 'string') patch.emoji = body.emoji
    if (typeof body.currency === 'string') patch.currency = body.currency
    if (typeof body.simplify === 'boolean') patch.simplify = body.simplify
    if (typeof body.archived === 'boolean') patch.archived = body.archived

    if (Array.isArray(body.memberIds)) {
      const user = await users.findOne({ _id: uid })
      const exists = await existingPersonIds(body.memberIds, people)
      const memberIds = Array.from(
        new Set(body.memberIds.filter((pid) => exists.has(pid) || group.memberIds.includes(pid))),
      )
      if (!memberIds.includes(user.selfPersonId)) memberIds.push(user.selfPersonId)

      const removed = group.memberIds.filter((pid) => !memberIds.includes(pid))
      if (removed.length) {
        const stillUsed = await expenses.findOne({
          groupId: id,
          deleted: { $ne: true },
          $or: removed.flatMap((pid) => [
            { [`paidBy.${pid}`]: { $exists: true } },
            { [`splits.${pid}`]: { $exists: true } },
          ]),
        })
        if (stillUsed) return send(res, 400, { error: 'A member here appears in an expense. Delete those first.' })
      }
      patch.memberIds = memberIds
      patch.memberUserIds = await resolveMemberUserIds(memberIds, people)
    }

    if (Object.keys(patch).length) await groups.updateOne({ _id: id }, { $set: patch })
    const updated = await groups.findOne({ _id: id })
    return send(res, 200, toClient(updated))
  }

  res.setHeader('Allow', 'PATCH, DELETE')
  send(res, 405, { error: 'Method not allowed' })
}

export default withAuth(handler)
