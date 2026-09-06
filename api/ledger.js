// GET /api/ledger - the append-only history, scoped to entries the caller
// is allowed to see (snapshotted at write time in visibleToUserIds, so it
// keeps working for groups that have since been deleted).
import { collections } from './_db.js'
import { send, methodGuard } from './_http.js'
import { withAuth } from './_auth.js'

async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return
  const { ledger } = await collections()
  const { uid } = req.session
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 250, 1), 500)

  const rows = await ledger.find({ visibleToUserIds: uid }).sort({ at: -1 }).limit(limit).toArray()
  send(
    res,
    200,
    rows.map(({ _id, visibleToUserIds, ...rest }) => ({ id: _id, ...rest })),
  )
}

export default withAuth(handler)
