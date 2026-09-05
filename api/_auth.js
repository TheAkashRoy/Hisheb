import 'dotenv/config'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { send } from './_http.js'

const SECRET = process.env.JWT_SECRET
if (!SECRET) console.warn('[hisheb] JWT_SECRET is not set - sessions will fail.')

const COOKIE_NAME = 'hisheb_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 30 // 30 days

export const hashPassword = (pw) => bcrypt.hash(pw, 10)
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash)

export function signSession(user) {
  return jwt.sign({ uid: user._id, email: user.email }, SECRET, { expiresIn: MAX_AGE_SEC })
}

export function parseCookies(req) {
  const header = req.headers?.cookie
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secure}`,
  )
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

// Returns { uid, email } or null - never throws.
export function getSession(req) {
  const token = parseCookies(req)[COOKIE_NAME]
  if (!token) return null
  try {
    const payload = jwt.verify(token, SECRET)
    return { uid: payload.uid, email: payload.email }
  } catch {
    return null
  }
}

// Wrap a handler to require a valid session; sends 401 automatically otherwise.
export function withAuth(handler) {
  return async (req, res) => {
    const session = getSession(req)
    if (!session) return send(res, 401, { error: 'Not signed in' })
    req.session = session
    return handler(req, res)
  }
}
