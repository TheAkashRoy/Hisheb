// Shared MongoDB connection, reused across warm serverless invocations
// (and across every request during local dev, since the dev router
// imports each handler module once and keeps it in memory).
import 'dotenv/config'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) console.warn('[hisheb] MONGODB_URI is not set.')

let dbPromise
function getDb() {
  if (!dbPromise) {
    const client = new MongoClient(uri)
    dbPromise = client.connect().then((c) => c.db('hisheb'))
  }
  return dbPromise
}

let indexesReady = false

export async function collections() {
  const db = await getDb()
  const cols = {
    users: db.collection('users'),
    people: db.collection('people'),
    groups: db.collection('groups'),
    expenses: db.collection('expenses'),
    settlements: db.collection('settlements'),
  }
  if (!indexesReady) {
    indexesReady = true
    await Promise.all([
      cols.users.createIndex({ email: 1 }, { unique: true }).catch(() => {}),
      // A person's identity is anchored by invite email - at most one
      // person record may claim a given email (see api/_people.js).
      cols.people
        .createIndex({ inviteEmail: 1 }, { unique: true, partialFilterExpression: { inviteEmail: { $type: 'string' } } })
        .catch(() => {}),
      cols.groups.createIndex({ memberUserIds: 1 }).catch(() => {}),
      cols.expenses.createIndex({ groupId: 1 }).catch(() => {}),
      cols.settlements.createIndex({ groupId: 1 }).catch(() => {}),
    ])
  }
  return cols
}
