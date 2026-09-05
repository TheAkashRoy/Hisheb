import { collections } from './_db.js'
import { send, methodGuard } from './_http.js'
import { withAuth } from './_auth.js'

// One user's whole view of their data: every group they're a real member
// of, the people involved in those groups (plus their own standalone
// contacts), and every expense/settlement inside those groups.
async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return
  const { users, people, groups, expenses, settlements } = await collections()
  const { uid } = req.session

  const user = await users.findOne({ _id: uid })
  if (!user) return send(res, 401, { error: 'Not signed in' })

  const [myGroups, ownPeople] = await Promise.all([
    groups.find({ memberUserIds: uid }).toArray(),
    people.find({ createdBy: uid }).toArray(),
  ])
  const groupIds = myGroups.map((g) => g._id)
  const personIds = new Set(ownPeople.map((p) => p._id))
  personIds.add(user.selfPersonId)
  for (const g of myGroups) for (const pid of g.memberIds) personIds.add(pid)

  const [peopleList, expenseList, settlementList] = await Promise.all([
    people.find({ _id: { $in: Array.from(personIds) } }).toArray(),
    groupIds.length ? expenses.find({ groupId: { $in: groupIds } }).toArray() : [],
    groupIds.length ? settlements.find({ groupId: { $in: groupIds } }).toArray() : [],
  ])

  send(res, 200, {
    currentUserId: user.selfPersonId,
    people: Object.fromEntries(
      peopleList.map((p) => [p._id, { id: p._id, name: p.name, me: p._id === user.selfPersonId }]),
    ),
    groups: Object.fromEntries(myGroups.map((g) => [g._id, toClientGroup(g)])),
    expenses: Object.fromEntries(expenseList.map((e) => [e._id, toClientDoc(e)])),
    settlements: Object.fromEntries(settlementList.map((s) => [s._id, toClientDoc(s)])),
    settings: user.settings || { currency: 'USD' },
  })
}

function toClientGroup(g) {
  return {
    id: g._id,
    name: g.name,
    emoji: g.emoji,
    currency: g.currency,
    memberIds: g.memberIds,
    simplify: g.simplify,
    archived: g.archived,
    createdAt: g.createdAt,
  }
}

function toClientDoc(d) {
  const { _id, ...rest } = d
  return { id: _id, ...rest }
}

export default withAuth(handler)
