import { collections } from '../_db.js'
import { send, methodGuard, readBody, isValidId } from '../_http.js'
import { withAuth } from '../_auth.js'

async function canAccessPerson(person, uid, groups) {
  if (person.createdBy === uid || person.userId === uid) return true
  const shared = await groups.findOne({ memberUserIds: uid, memberIds: person._id })
  return !!shared
}

async function handler(req, res) {
  const { people, groups, expenses, settlements, users } = await collections()
  const { uid } = req.session
  const id = req.query.id
  const person = await people.findOne({ _id: id })
  if (!person) return send(res, 404, { error: 'Person not found' })
  if (!(await canAccessPerson(person, uid, groups))) return send(res, 403, { error: 'Not allowed' })

  if (req.method === 'PATCH') {
    const body = await readBody(req)
    const patch = {}
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (Object.keys(patch).length) {
      await people.updateOne({ _id: id }, { $set: patch })
      if (person.userId === uid) await users.updateOne({ _id: uid }, { $set: { name: patch.name } })
    }
    const updated = await people.findOne({ _id: id })
    return send(res, 200, { id: updated._id, name: updated.name, userId: updated.userId })
  }

  if (req.method === 'DELETE') {
    if (person.userId) return send(res, 400, { error: "You can't remove someone's account." })
    const inGroup = await groups.findOne({ memberIds: id })
    if (inGroup) return send(res, 400, { error: 'This person is still part of a group or expense.' })
    if (!isValidId(id)) return send(res, 400, { error: 'Invalid id.' })
    const inExpense = await expenses.findOne({
      deleted: { $ne: true },
      $or: [{ [`paidBy.${id}`]: { $exists: true } }, { [`splits.${id}`]: { $exists: true } }],
    })
    const inSettlement = await settlements.findOne({ $or: [{ from: id }, { to: id }] })
    if (inExpense || inSettlement) return send(res, 400, { error: 'This person is still part of a group or expense.' })
    await people.deleteOne({ _id: id })
    return send(res, 200, { ok: true })
  }

  res.setHeader('Allow', 'PATCH, DELETE')
  send(res, 405, { error: 'Method not allowed' })
}

export default withAuth(handler)
