import { collections } from './_db.js'
import { send, methodGuard, readBody } from './_http.js'
import { withAuth } from './_auth.js'

async function handler(req, res) {
  if (!methodGuard(req, res, ['PATCH'])) return
  const { users } = await collections()
  const { uid } = req.session
  const body = await readBody(req)
  const patch = {}
  if (typeof body.currency === 'string') patch['settings.currency'] = body.currency
  if (Object.keys(patch).length) await users.updateOne({ _id: uid }, { $set: patch })
  const user = await users.findOne({ _id: uid })
  send(res, 200, user.settings || { currency: 'USD' })
}

export default withAuth(handler)
