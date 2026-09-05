import { collections } from '../_db.js'
import { send, methodGuard } from '../_http.js'
import { getSession } from '../_auth.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return
  const session = getSession(req)
  if (!session) return send(res, 401, { error: 'Not signed in' })
  const { users } = await collections()
  const user = await users.findOne({ _id: session.uid })
  if (!user) return send(res, 401, { error: 'Not signed in' })
  send(res, 200, { id: user._id, email: user.email, name: user.name, selfPersonId: user.selfPersonId })
}
