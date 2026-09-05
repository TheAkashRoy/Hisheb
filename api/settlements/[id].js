import { collections } from '../_db.js'
import { send, methodGuard } from '../_http.js'
import { withAuth } from '../_auth.js'

async function handler(req, res) {
  if (!methodGuard(req, res, ['DELETE'])) return
  const { settlements, groups } = await collections()
  const { uid } = req.session
  const id = req.query.id
  const existing = await settlements.findOne({ _id: id })
  if (!existing) return send(res, 404, { error: 'Not found' })
  const group = await groups.findOne({ _id: existing.groupId })
  if (!group || !group.memberUserIds.includes(uid)) return send(res, 403, { error: 'Not allowed' })
  await settlements.deleteOne({ _id: id })
  send(res, 200, { ok: true })
}

export default withAuth(handler)
