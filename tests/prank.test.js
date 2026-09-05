// Tests for the "Put all Akash's debt on me" easter egg (src/lib/prank.js).
// This is a purely local display overlay - these tests confirm it behaves
// correctly and, just as importantly, that it can never corrupt the real
// numbers it's layered on top of.
import test from 'node:test'
import assert from 'node:assert/strict'
import { userSummary } from '../src/lib/balances.js'
import { applyPrank } from '../src/lib/prank.js'
import { splitEqual } from '../src/lib/money.js'

const expense = (id, payer, cents, participants) => ({
  id,
  groupId: 'g',
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
})

const BONUS = 199900 // ₹1,999, matching store.js's pullAkashDebtOntoMe()

test('no prank active -> summary passes through completely untouched', () => {
  const expenses = [expense('e1', 'akash', 3000, ['me', 'akash'])]
  const summary = userSummary('me', ['me', 'akash'], expenses, [], true)
  assert.deepEqual(applyPrank(summary, null, 'me'), summary)
})

test("Akash's debt in this group moves onto me, exactly (no bonus applied here - that's a one-time overall addition)", () => {
  // Akash pays nothing, owes a 1500 share -> Akash is -1500, I am +1500.
  const expenses = [expense('e1', 'me', 3000, ['me', 'akash'])]
  const summary = userSummary('me', ['me', 'akash'], expenses, [], true)
  assert.equal(summary.net.akash, -1500)
  assert.equal(summary.net.me, 1500)

  const pranked = applyPrank(summary, { targetId: 'akash', bonus: BONUS }, 'me')
  assert.equal(pranked.net.akash, 0, "Akash's displayed debt is wiped")
  assert.equal(pranked.net.me, 1500 + 1500, 'I absorb exactly what Akash owed - my existing +1500 plus their 1500 debt')
  assert.equal(pranked.balance, 3000)
})

test('the underlying summary object is never mutated - this is a display-only copy', () => {
  const expenses = [expense('e1', 'me', 3000, ['me', 'akash'])]
  const summary = userSummary('me', ['me', 'akash'], expenses, [], true)
  const before = JSON.stringify(summary)
  applyPrank(summary, { targetId: 'akash', bonus: BONUS }, 'me')
  assert.equal(JSON.stringify(summary), before, 'applyPrank must not mutate its input')
})

test('Akash owing nothing in this group -> no-op (nothing to steal here)', () => {
  // Akash paid for everything and is owed money, not in debt.
  const expenses = [expense('e1', 'akash', 3000, ['me', 'akash'])]
  const summary = userSummary('me', ['me', 'akash'], expenses, [], true)
  assert.equal(summary.net.akash, 1500) // Akash is a creditor here, not a debtor
  const pranked = applyPrank(summary, { targetId: 'akash', bonus: BONUS }, 'me')
  assert.deepEqual(pranked, summary, "can't steal debt that doesn't exist - group is untouched")
})

test('a different target id (not present in this group) -> no-op', () => {
  const expenses = [expense('e1', 'me', 3000, ['me', 'bob'])]
  const summary = userSummary('me', ['me', 'bob'], expenses, [], true)
  const pranked = applyPrank(summary, { targetId: 'someone-else-entirely', bonus: BONUS }, 'me')
  assert.deepEqual(pranked, summary)
})

test('transfers are recomputed consistently with the patched net (no stale "pay Akash" line lingering)', () => {
  const expenses = [
    expense('e1', 'me', 2000, ['me', 'akash']), // akash owes me 1000
    expense('e2', 'akash', 2000, ['akash', 'bob']), // bob owes akash 1000
  ]
  const summary = userSummary('me', ['me', 'akash', 'bob'], expenses, [], true)
  // Before the prank: bob would normally pay akash (or, once simplified, possibly me directly).
  assert.ok(summary.transfers.some((t) => t.to === 'akash' || (t.from === 'bob' && t.to === 'me')))

  const pranked = applyPrank(summary, { targetId: 'akash', bonus: BONUS }, 'me')
  assert.ok(!pranked.transfers.some((t) => t.to === 'akash' || t.from === 'akash'), 'Akash should no longer appear in any recommended payment')
  const sum = Object.values(pranked.net).reduce((s, v) => s + v, 0)
  assert.equal(sum, 0, 'money still conserves after the cosmetic patch')
})

test('the bonus (₹1,999) is applied once at the overall level, not inside applyPrank itself', () => {
  // applyPrank operates per-group and never touches `bonus` directly -
  // hooks.js's useOverall() subtracts it exactly once from the aggregate
  // total. Confirm applyPrank's output is bonus-free by construction.
  const expenses = [expense('e1', 'me', 3000, ['me', 'akash'])]
  const summary = userSummary('me', ['me', 'akash'], expenses, [], true)
  const pranked = applyPrank(summary, { targetId: 'akash', bonus: BONUS }, 'me')
  assert.equal(pranked.balance, 3000, 'exactly the stolen debt, no bonus folded in at this layer')
})
