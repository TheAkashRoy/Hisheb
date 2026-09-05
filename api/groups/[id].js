import { collections } from '../_db.js'
import { send, methodGuard, readBody } from '../_http.js'
import { withAuth } from '../_auth.js'
import { visiblePersonIds, resolveMemberUserIds } from '../_people.js'

function toClient(g) {
  const { _id, memberUserIds, ...rest } = g
  return { id: _id, ...rest }
}

async function handler(req, res) {
  const { groups, people, expenses, settlements, users } = await collections()
  const { uid } = req.session
  const id = req.query.id
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
      const visible = await visiblePersonIds(uid, people, groups)
      const memberIds = Array.from(
        new Set(body.memberIds.filter((pid) => visible.has(pid) || group.memberIds.includes(pid))),
      )
      if (!memberIds.includes(user.selfPersonId)) memberIds.push(user.selfPersonId) // can't remove yourself this way

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
