import { send, methodGuard } from '../_http.js'
import { clearSessionCookie } from '../_auth.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  clearSessionCookie(res)
  send(res, 200, { ok: true })
}
