// Append-only audit trail. Every add / edit / delete / settle-up writes one
// entry here, and entries are NEVER modified or removed afterwards - so the
// history survives even when the expense/settlement/group it describes is
// deleted. Read back via api/ledger.js.
import { randomUUID } from 'node:crypto'
import { collections } from './_db.js'
import { formatMoney } from '../src/lib/money.js'

export const money = (cents) => formatMoney(cents, 'INR')

// Best-effort: a failure to write the audit entry must never fail the
// mutation it describes. (Same cluster - if the mutation committed, this
// almost certainly will too.)
export async function recordLedger({
  actorUserId,
  actorName,
  group, // the group doc, if handy - used for name + audience snapshot
  groupId,
  groupName,
  audience, // explicit list of user ids who may see this entry
  action,
  detail,
  amount = null,
  meta = {},
}) {
  try {
    const { ledger, users } = await collections()
    let name = actorName
    if (!name && actorUserId) name = (await users.findOne({ _id: actorUserId }, { projection: { name: 1 } }))?.name
    await ledger.insertOne({
      _id: randomUUID(),
      at: new Date().toISOString(),
      actorUserId: actorUserId || null,
      actorName: name || 'Someone',
      groupId: group?._id ?? groupId ?? null,
      groupName: group?.name ?? groupName ?? null,
      // Snapshot the audience now, so the entry stays visible to the right
      // people after the group is gone.
      visibleToUserIds:
        audience || (group?.memberUserIds ? [...group.memberUserIds] : actorUserId ? [actorUserId] : []),
      action,
      detail,
      amount,
      meta,
    })
  } catch (err) {
    console.error('[hisheb] ledger write failed:', action, err)
  }
}
