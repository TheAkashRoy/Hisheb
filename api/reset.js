import { collections } from './_db.js'
import { send, methodGuard } from './_http.js'
import { withAuth } from './_auth.js'

// "Erase everything" in a shared, multi-user app can't mean "wipe the
// database" - that would delete other people's view of shared groups too.
// Instead: delete groups that are yours alone outright, and just leave any
// group that still has other real members in it.
async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  const { groups, expenses, settlements, users } = await collections()
  const { uid } = req.session
  const user = await users.findOne({ _id: uid })
  const myGroups = await groups.find({ memberUserIds: uid }).toArray()

  for (const g of myGroups) {
    const others = g.memberUserIds.filter((u) => u !== uid)
    if (others.length === 0) {
      await groups.deleteOne({ _id: g._id })
      await expenses.deleteMany({ groupId: g._id })
      await settlements.deleteMany({ groupId: g._id })
    } else {
      const memberIds = g.memberIds.filter((pid) => pid !== user.selfPersonId)
      await groups.updateOne({ _id: g._id }, { $set: { memberIds, memberUserIds: others } })
    }
  }
  send(res, 200, { ok: true })
}

export default withAuth(handler)
