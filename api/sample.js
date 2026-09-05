import { collections } from './_db.js'
import { send, methodGuard } from './_http.js'
import { withAuth } from './_auth.js'
import { randomUUID } from 'node:crypto'
import { splitEqual } from '../src/lib/money.js'

async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return
  const { people, groups, expenses, users } = await collections()
  const { uid } = req.session
  const user = await users.findOne({ _id: uid })
  const me = user.selfPersonId
  const iso = () => new Date().toISOString()

  const mk = (name) => ({ _id: randomUUID(), name, userId: null, inviteEmail: null, createdBy: uid, createdAt: iso() })
  const alex = mk('Alex')
  const sam = mk('Sam')
  const jo = mk('Jordan')
  await people.insertMany([alex, sam, jo])

  const gid = randomUUID()
  const memberIds = [me, alex._id, sam._id, jo._id]
  await groups.insertOne({
    _id: gid,
    name: 'Lisbon trip',
    emoji: '✈️',
    currency: 'EUR',
    memberIds,
    memberUserIds: [uid],
    simplify: true,
    archived: false,
    createdBy: uid,
    createdAt: iso(),
  })

  const expense = (desc, payerId, cents, cat, daysAgo) => {
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString()
    return {
      _id: randomUUID(),
      groupId: gid,
      description: desc,
      amount: cents,
      currency: 'EUR',
      category: cat,
      date,
      paidBy: { [payerId]: cents },
      splitMode: 'equal',
      participants: memberIds,
      splits: splitEqual(cents, memberIds),
      notes: '',
      createdAt: date,
      createdBy: uid,
      deleted: false,
    }
  }
  await expenses.insertMany([
    expense('Airbnb - 3 nights', me, 42000, 'hotel', 6),
    expense('Groceries', sam._id, 8640, 'groceries', 5),
    expense('Tram tickets', alex._id, 2400, 'transport', 4),
    expense('Seafood dinner', jo._id, 15200, 'food', 3),
    expense('Museum entry', me, 4800, 'entertainment', 2),
    expense('Airport taxi', alex._id, 3600, 'transport', 1),
  ])

  send(res, 200, { ok: true })
}

export default withAuth(handler)
