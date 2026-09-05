// Rigorous tests for src/lib/balances.js - in particular the "simplify
// debts" toggle (netBalances / simplify / pairwiseBalances / userSummary).
// Run with: npm test  (node --test)
import test from 'node:test'
import assert from 'node:assert/strict'
import { netBalances, simplify, pairwiseBalances, userSummary } from '../src/lib/balances.js'
import { splitEqual } from '../src/lib/money.js'

// ---- small helpers -------------------------------------------------------

const expense = (id, groupId, payer, cents, participants, overrides = {}) => ({
  id,
  groupId,
  description: id,
  amount: cents,
  currency: 'INR',
  category: 'general',
  date: '2026-01-01T00:00:00.000Z',
  paidBy: { [payer]: cents },
  splitMode: 'equal',
  participants,
  splits: splitEqual(cents, participants),
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: payer,
  deleted: false,
  ...overrides,
})

const settlement = (id, from, to, cents, overrides = {}) => ({
  id,
  groupId: 'g',
  from,
  to,
  amount: cents,
  currency: 'INR',
  date: '2026-01-01T00:00:00.000Z',
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: from,
  deleted: false,
  ...overrides,
})

// Applying a set of transfers should leave every balance at exactly zero -
// the strongest possible correctness statement for a settle-up algorithm:
// whatever it recommends, actually paying it settles everyone completely.
function replay(net, transfers) {
  const result = { ...net }
  for (const t of transfers) {
    result[t.from] = (result[t.from] || 0) + t.amount
    result[t.to] = (result[t.to] || 0) - t.amount
  }
  return result
}

function sumOf(obj) {
  return Object.values(obj).reduce((s, v) => s + v, 0)
}

// ---- netBalances ----------------------------------------------------------

test('netBalances: money is always conserved (sums to zero)', () => {
  const expenses = [
    expense('e1', 'g', 'A', 9000, ['A', 'B', 'C']),
    expense('e2', 'g', 'B', 6000, ['A', 'B', 'C']),
  ]
  const settlements = [settlement('s1', 'C', 'A', 3000)]
  const net = netBalances(['A', 'B', 'C'], expenses, settlements)
  assert.equal(sumOf(net), 0)
})

test('netBalances: deleted expenses/settlements are ignored', () => {
  const expenses = [expense('e1', 'g', 'A', 9000, ['A', 'B'], { deleted: true })]
  const settlements = [settlement('s1', 'B', 'A', 100, { deleted: true })]
  const net = netBalances(['A', 'B'], expenses, settlements)
  assert.deepEqual(net, { A: 0, B: 0 })
})

test('netBalances: a person not on an expense is untouched', () => {
  const expenses = [expense('e1', 'g', 'A', 2000, ['A', 'B'])]
  const net = netBalances(['A', 'B', 'C'], expenses, [])
  assert.equal(net.C, 0)
  assert.equal(net.A, 1000) // paid 2000, owes 1000 share
  assert.equal(net.B, -1000)
})

// ---- the core "simplify debts" guarantee ----------------------------------

test('simplify=true can route a payment between two people who never shared an expense', () => {
  // A pays for A+B ($20 -> B owes A $10). B pays for B+C ($20 -> C owes B
  // $10). A and C never appear on the same expense.
  const expenses = [
    expense('e1', 'g', 'A', 2000, ['A', 'B']),
    expense('e2', 'g', 'B', 2000, ['B', 'C']),
  ]
  const net = netBalances(['A', 'B', 'C'], expenses, [])
  const transfers = simplify({ ...net })
  assert.equal(transfers.length, 1)
  assert.deepEqual(transfers[0], { from: 'C', to: 'A', amount: 1000 })
})

test('simplify=false (pairwise) never invents a relationship between two people who never transacted', () => {
  const expenses = [
    expense('e1', 'g', 'A', 2000, ['A', 'B']),
    expense('e2', 'g', 'B', 2000, ['B', 'C']),
  ]
  const transfers = pairwiseBalances(expenses, [])
  assert.equal(transfers.length, 2)
  const pairs = new Set(transfers.map((t) => [t.from, t.to].sort().join('-')))
  assert.ok(pairs.has('A-B'))
  assert.ok(pairs.has('B-C'))
  assert.ok(!pairs.has('A-C'), 'A and C never shared an expense - there must be no transfer between them')
})

test('a debt cycle nets to zero for everyone, but only simplify collapses it to zero transfers', () => {
  // A pays for A+B, B pays for B+C, C pays for C+A - each $20, so each
  // person is owed $10 by one neighbor and owes $10 to another. Overall
  // net per person is exactly zero, but no *pair* offsets directly.
  const expenses = [
    expense('e1', 'g', 'A', 2000, ['A', 'B']),
    expense('e2', 'g', 'B', 2000, ['B', 'C']),
    expense('e3', 'g', 'C', 2000, ['C', 'A']),
  ]
  const net = netBalances(['A', 'B', 'C'], expenses, [])
  assert.deepEqual(net, { A: 0, B: 0, C: 0 })

  const simplified = simplify({ ...net })
  assert.deepEqual(simplified, [], 'everyone is net-even, so simplify should recommend paying nobody')

  const direct = pairwiseBalances(expenses, [])
  assert.equal(direct.length, 3, 'but the three real, unresolved debts around the cycle still exist')
})

test('a settlement can flip the direction of a pairwise debt (overpayment)', () => {
  const expenses = [expense('e1', 'g', 'A', 2000, ['A', 'B'])] // B owes A 1000
  const settlements = [settlement('s1', 'B', 'A', 1500)] // B overpays by 500
  const transfers = pairwiseBalances(expenses, settlements)
  assert.equal(transfers.length, 1)
  assert.deepEqual(transfers[0], { from: 'A', to: 'B', amount: 500 })
})

test('a settlement can exactly zero out a pairwise debt (fully settled -> no transfer listed)', () => {
  const expenses = [expense('e1', 'g', 'A', 2000, ['A', 'B'])]
  const settlements = [settlement('s1', 'B', 'A', 1000)]
  const transfers = pairwiseBalances(expenses, settlements)
  assert.deepEqual(transfers, [])
})

test('userSummary: simplify=true and simplify=false agree on net balances but differ on transfers', () => {
  const expenses = [
    expense('e1', 'g', 'A', 2000, ['A', 'B']),
    expense('e2', 'g', 'B', 2000, ['B', 'C']),
  ]
  const simplified = userSummary('A', ['A', 'B', 'C'], expenses, [], true)
  const direct = userSummary('A', ['A', 'B', 'C'], expenses, [], false)
  assert.deepEqual(simplified.net, direct.net)
  assert.equal(simplified.balance, direct.balance)
  assert.notDeepEqual(simplified.transfers, direct.transfers)
})

test('userSummary defaults to simplify=true when the flag is omitted', () => {
  const expenses = [expense('e1', 'g', 'A', 2000, ['A', 'B'])]
  const withDefault = userSummary('A', ['A', 'B'], expenses, [])
  const explicit = userSummary('A', ['A', 'B'], expenses, [], true)
  assert.deepEqual(withDefault, explicit)
})

// ---- exact-split rounding (feeds directly into balance correctness) ------

test('a $10 exact split three ways still balances to the cent after rounding', () => {
  const e = expense('e1', 'g', 'A', 1000, ['A', 'B', 'C'], {
    splitMode: 'exact',
    splits: { A: 334, B: 333, C: 333 }, // rounding gap already absorbed, as store.js/api do
  })
  const net = netBalances(['A', 'B', 'C'], [e], [])
  assert.equal(sumOf(net), 0)
  assert.equal(sumOf(e.splits), 1000)
})

// ---- property-based fuzzing ------------------------------------------------
// Deterministic PRNG so failures are always reproducible from the seed.
function mulberry32(seed) {
  return function rand() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomLedger(rand, seed) {
  const memberCount = 2 + Math.floor(rand() * 5) // 2-6 people
  const members = Array.from({ length: memberCount }, (_, i) => `P${i}`)
  const expenses = []
  const expenseCount = 3 + Math.floor(rand() * 12)
  for (let i = 0; i < expenseCount; i++) {
    const payer = members[Math.floor(rand() * members.length)]
    const participantCount = 1 + Math.floor(rand() * members.length)
    const participants = [...members].sort(() => rand() - 0.5).slice(0, Math.max(participantCount, 1))
    if (!participants.includes(payer)) participants.push(payer)
    const cents = 1 + Math.floor(rand() * 500000)
    expenses.push(expense(`seed${seed}-e${i}`, 'g', payer, cents, participants))
  }
  const settlements = []
  const settleCount = Math.floor(rand() * 6)
  for (let i = 0; i < settleCount; i++) {
    const from = members[Math.floor(rand() * members.length)]
    let to = members[Math.floor(rand() * members.length)]
    if (to === from) to = members[(members.indexOf(from) + 1) % members.length]
    const cents = 1 + Math.floor(rand() * 300000)
    settlements.push(settlement(`seed${seed}-s${i}`, from, to, cents))
  }
  return { members, expenses, settlements }
}

// Does {from,to} appear together on at least one expense (one paid, the
// other has a share - in either role) or as a direct settlement?
function everTransactedDirectly(a, b, expenses, settlements) {
  for (const e of expenses) {
    if (e.deleted) continue
    const inPaidBy = (id) => e.paidBy?.[id] != null
    const inSplits = (id) => e.splits?.[id] != null
    if ((inPaidBy(a) && inSplits(b)) || (inPaidBy(b) && inSplits(a))) return true
  }
  for (const s of settlements) {
    if (s.deleted) continue
    if ((s.from === a && s.to === b) || (s.from === b && s.to === a)) return true
  }
  return false
}

const FUZZ_ITERATIONS = 300

test(`fuzz (${FUZZ_ITERATIONS} random ledgers): netBalances always conserves money`, () => {
  const rand = mulberry32(12345)
  for (let seed = 0; seed < FUZZ_ITERATIONS; seed++) {
    const { members, expenses, settlements } = randomLedger(rand, seed)
    const net = netBalances(members, expenses, settlements)
    assert.equal(sumOf(net), 0, `seed ${seed}: net balances should sum to zero`)
  }
})

test(`fuzz (${FUZZ_ITERATIONS} random ledgers): simplify() transfers, if actually paid, fully settle everyone`, () => {
  const rand = mulberry32(23456)
  for (let seed = 0; seed < FUZZ_ITERATIONS; seed++) {
    const { members, expenses, settlements } = randomLedger(rand, seed)
    const net = netBalances(members, expenses, settlements)
    const transfers = simplify({ ...net })
    const settled = replay(net, transfers)
    for (const id of members) {
      assert.equal(settled[id], 0, `seed ${seed}: ${id} should be fully settled after paying simplify()'s transfers`)
    }
  }
})

test(`fuzz (${FUZZ_ITERATIONS} random ledgers): simplify() never uses more than (creditors+debtors-1) transfers`, () => {
  const rand = mulberry32(23456)
  for (let seed = 0; seed < FUZZ_ITERATIONS; seed++) {
    const { members, expenses, settlements } = randomLedger(rand, seed)
    const net = netBalances(members, expenses, settlements)
    const nonZero = Object.values(net).filter((v) => v !== 0).length
    const transfers = simplify({ ...net })
    assert.ok(
      transfers.length <= Math.max(0, nonZero - 1),
      `seed ${seed}: ${transfers.length} transfers for only ${nonZero} non-zero balances`,
    )
  }
})

test(`fuzz (${FUZZ_ITERATIONS} random ledgers): pairwiseBalances() transfers also fully settle everyone`, () => {
  const rand = mulberry32(34567)
  for (let seed = 0; seed < FUZZ_ITERATIONS; seed++) {
    const { members, expenses, settlements } = randomLedger(rand, seed)
    const net = netBalances(members, expenses, settlements)
    const transfers = pairwiseBalances(expenses, settlements)
    const settled = replay(net, transfers)
    for (const id of members) {
      assert.equal(settled[id], 0, `seed ${seed}: ${id} should be fully settled after paying pairwiseBalances()'s transfers`)
    }
  }
})

test(`fuzz (${FUZZ_ITERATIONS} random ledgers): pairwiseBalances() never invents a transfer between two people who never transacted`, () => {
  const rand = mulberry32(34567)
  for (let seed = 0; seed < FUZZ_ITERATIONS; seed++) {
    const { expenses, settlements } = randomLedger(rand, seed)
    const transfers = pairwiseBalances(expenses, settlements)
    for (const t of transfers) {
      assert.ok(
        everTransactedDirectly(t.from, t.to, expenses, settlements),
        `seed ${seed}: transfer ${t.from}->${t.to} has no direct shared expense or settlement between them`,
      )
    }
  }
})

test(`fuzz (${FUZZ_ITERATIONS} random ledgers): every transfer amount is a non-negative integer number of cents`, () => {
  const rand = mulberry32(45678)
  for (let seed = 0; seed < FUZZ_ITERATIONS; seed++) {
    const { members, expenses, settlements } = randomLedger(rand, seed)
    const net = netBalances(members, expenses, settlements)
    for (const t of [...simplify({ ...net }), ...pairwiseBalances(expenses, settlements)]) {
      assert.ok(Number.isInteger(t.amount) && t.amount > 0, `seed ${seed}: bad transfer amount ${t.amount}`)
    }
  }
})
