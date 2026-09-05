import { randomUUID } from 'node:crypto'

// Which of these candidate person ids actually exist. Person ids are
// unguessable 128-bit UUIDs, so "does it exist" is enough to safely accept
// it as a group member - the real access boundary is at the group/expense
// level (memberUserIds), not at "have I already interacted with this
// person id before" (that check used to create a chicken-and-egg problem:
// you can't add someone you just invited by email to a group, because you
// don't share a group with them yet - that's the whole point of adding them).
export async function existingPersonIds(candidateIds, people) {
  if (!candidateIds.length) return new Set()
  const docs = await people.find({ _id: { $in: candidateIds } }).project({ _id: 1 }).toArray()
  return new Set(docs.map((p) => p._id))
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
