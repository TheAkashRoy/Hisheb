import { randomUUID } from 'node:crypto'

// Person ids the requester is allowed to reference: people they created
// themselves, plus anyone in a group they already share.
export async function visiblePersonIds(uid, people, groups) {
  const [own, shared] = await Promise.all([
    people.find({ createdBy: uid }).project({ _id: 1 }).toArray(),
    groups.find({ memberUserIds: uid }).project({ memberIds: 1 }).toArray(),
  ])
  const ids = new Set(own.map((p) => p._id))
  for (const g of shared) for (const pid of g.memberIds) ids.add(pid)
  return ids
}

// Denormalized real-user ids backing a list of person ids - lets group
// access-control queries be a plain `memberUserIds: uid` match instead of
// a join through people on every request.
export async function resolveMemberUserIds(memberIds, people) {
  if (!memberIds.length) return []
  const docs = await people.find({ _id: { $in: memberIds } }).project({ userId: 1 }).toArray()
  return Array.from(new Set(docs.filter((p) => p.userId).map((p) => p.userId)))
}

// A person's identity is anchored by their invite email: reuse the existing
// record for that email instead of creating a duplicate, and link it to a
// real account immediately if one already exists. This is what makes
// "claim your spot later" work without ever having to merge two ledgers.
export async function findOrCreatePersonByEmail({ people, users }, { email, name, createdBy }) {
  const existing = await people.findOne({ inviteEmail: email })
  if (existing) return existing
  const user = await users.findOne({ email })
  const doc = {
    _id: randomUUID(),
    name: user ? user.name : name,
    userId: user ? user._id : null,
    inviteEmail: email,
    createdBy,
    createdAt: new Date().toISOString(),
  }
  await people.insertOne(doc)
  return doc
}
