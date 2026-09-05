import { collections } from '../_db.js'
import { readBody, send, methodGuard } from '../_http.js'
import { verifyPassword, signSession, setSessionCookie } from '../_auth.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  const { users } = await collections()
  const body = await readBody(req)
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  const user = await users.findOne({ email })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return send(res, 401, { error: 'Incorrect email or password.' })
  }

  const token = signSession(user)
  setSessionCookie(res, token)
  send(res, 200, { id: user._id, email: user.email, name: user.name, selfPersonId: user.selfPersonId })
}
