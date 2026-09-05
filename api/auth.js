// One function serving /api/auth/signup, /login, /logout, /me -
// vercel.json rewrites /api/auth/:action here as a query param, so one
// physical file covers all four (keeps the function count under the
// Hobby plan's limit).
import { collections } from './_db.js'
import { readBody, send, methodGuard } from './_http.js'
import { hashPassword, verifyPassword, signSession, setSessionCookie, clearSessionCookie, getSession } from './_auth.js'
import { randomUUID } from 'node:crypto'

export default async function handler(req, res) {
  const action = req.query.action
  if (action === 'signup') return signup(req, res)
  if (action === 'login') return login(req, res)
  if (action === 'logout') return logout(req, res)
  if (action === 'me') return me(req, res)
  return send(res, 404, { error: 'Not found' })
}

async function signup(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  const { users, people, groups } = await collections()
  const body = await readBody(req)
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const name = String(body.name || '').trim() || 'You'

  if (!email || !email.includes('@')) return send(res, 400, { error: 'Enter a valid email.' })
  if (password.length < 8) return send(res, 400, { error: 'Password must be at least 8 characters.' })

  const existing = await users.findOne({ email })
  if (existing) return send(res, 409, { error: 'An account with that email already exists.' })

  const userId = randomUUID()
  const passwordHash = await hashPassword(password)

  // If someone already invited this email as a placeholder person, adopt
  // that record as your "self" - so you show up as yourself, not a
  // stranger, in whatever group they already added you to.
  const placeholder = await people.findOne({ inviteEmail: email, userId: null })
  let selfPersonId
  if (placeholder) {
    selfPersonId = placeholder._id
    await people.updateOne({ _id: selfPersonId }, { $set: { userId, name } })
    const groupIds = (await groups.find({ memberIds: selfPersonId }).project({ _id: 1 }).toArray()).map((g) => g._id)
    if (groupIds.length) await groups.updateMany({ _id: { $in: groupIds } }, { $addToSet: { memberUserIds: userId } })
  } else {
    selfPersonId = randomUUID()
    await people.insertOne({
      _id: selfPersonId,
      name,
      userId,
      inviteEmail: email,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    })
  }

  const user = {
    _id: userId,
    email,
    passwordHash,
    name,
    selfPersonId,
    settings: { currency: 'INR' },
    createdAt: new Date().toISOString(),
  }
  await users.insertOne(user)

  const token = signSession(user)
  setSessionCookie(res, token)
  send(res, 200, { id: userId, email, name, selfPersonId })
}

async function login(req, res) {
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

async function logout(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  clearSessionCookie(res)
  send(res, 200, { ok: true })
}

async function me(req, res) {
  if (!methodGuard(req, res, ['GET'])) return
  const session = getSession(req)
  if (!session) return send(res, 401, { error: 'Not signed in' })
  const { users } = await collections()
  const user = await users.findOne({ _id: session.uid })
  if (!user) return send(res, 401, { error: 'Not signed in' })
  send(res, 200, { id: user._id, email: user.email, name: user.name, selfPersonId: user.selfPersonId })
}
