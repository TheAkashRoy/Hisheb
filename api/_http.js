// Small, runtime-agnostic HTTP helpers shared by every /api handler - work
// identically under Vercel's Node runtime and under the local dev router
// in vite.config.js (both hand handlers a plain Node req/res).

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export function methodGuard(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '))
    send(res, 405, { error: 'Method not allowed' })
    return false
  }
  return true
}

// All ids in this app are client- or server-generated UUIDs. Anywhere an id
// gets interpolated into a Mongo field *path* (e.g. `paidBy.${id}`) rather
// than used as a plain filter value, validate it against this first -
// closes off dotted/`$`-prefixed field-path tricks.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
export function isValidId(x) {
  return typeof x === 'string' && ID_RE.test(x)
}
