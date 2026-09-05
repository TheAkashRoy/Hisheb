import { collections } from './_db.js'
import { send, methodGuard, readBody, isValidId } from './_http.js'
import { withAuth } from './_auth.js'
import { visiblePersonIds, resolveMemberUserIds } from './_people.js'

async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  const { groups, users, people } = await collections()
  const { uid } = req.session
  const user = await users.findOne({ _id: uid })
  const body = await readBody(req)

  const id = isValidId(body.id) ? body.id : undefined
  if (!id) return send(res, 400, { error: 'Missing or invalid id.' })

  const name = String(body.name || '').trim() || 'New group'
  const emoji = body.emoji || '👥'
  const currency = body.currency || user?.settings?.currency || 'USD'
  const simplify = body.simplify !== false
  const requested = Array.isArray(body.memberIds) ? body.memberIds : []

  // Only allow member ids the requester can actually see - your own
  // contacts, or people already in a group you share - so you can't add
  // an arbitrary stranger's person id by guessing it.
  const visible = await visiblePersonIds(uid, people, groups)
  const memberIds = Array.from(new Set([user.selfPersonId, ...requested.filter((pid) => visible.has(pid))]))
  const memberUserIds = await resolveMemberUserIds(memberIds, people)

  const doc = {
    _id: id,
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
  send(res, 200, { id: _id, ...rest })
}

export default withAuth(handler)
