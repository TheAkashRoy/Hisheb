import { collections } from './_db.js'
import { send, methodGuard, readBody, isValidId } from './_http.js'
import { withAuth } from './_auth.js'
import { findOrCreatePersonByEmail } from './_people.js'

async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  const { people, users } = await collections()
  const { uid } = req.session
  const body = await readBody(req)
  const name = String(body.name || '').trim() || 'Someone'
  const inviteEmail = body.inviteEmail ? String(body.inviteEmail).trim().toLowerCase() : null

  if (inviteEmail) {
    // Identity is anchored by email - reuse whatever record already claims
    // it instead of creating a duplicate placeholder for the same person.
    const person = await findOrCreatePersonByEmail({ people, users }, { email: inviteEmail, name, createdBy: uid })
    return send(res, 200, { id: person._id, name: person.name, userId: person.userId, inviteEmail: person.inviteEmail })
  }

  const id = isValidId(body.id) ? body.id : undefined
  if (!id) return send(res, 400, { error: 'Missing or invalid id.' })
  const doc = { _id: id, name, userId: null, inviteEmail: null, createdBy: uid, createdAt: new Date().toISOString() }
  try {
    await people.insertOne(doc)
  } catch (err) {
    if (err.code === 11000) return send(res, 409, { error: 'That person already exists.' })
    throw err
  }
  send(res, 200, { id, name, userId: null, inviteEmail: null })
}

export default withAuth(handler)
