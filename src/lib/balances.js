import { sumValues } from './money.js'

// Net balance per person for a set of expenses + settlements.
//   net > 0  -> this person is owed money (creditor)
//   net < 0  -> this person owes money (debtor)
export function netBalances(memberIds, expenses, settlements) {
  const net = {}
  memberIds.forEach((id) => { net[id] = 0 })

  for (const e of expenses) {
    if (e.deleted) continue
    for (const [pid, amt] of Object.entries(e.paidBy || {})) {
      net[pid] = (net[pid] || 0) + (amt || 0)
    }
    for (const [pid, amt] of Object.entries(e.splits || {})) {
      net[pid] = (net[pid] || 0) - (amt || 0)
    }
  }

  for (const s of settlements) {
    if (s.deleted) continue
    net[s.from] = (net[s.from] || 0) + s.amount
    net[s.to] = (net[s.to] || 0) - s.amount
  }

  // round tiny float noise
  for (const k of Object.keys(net)) net[k] = Math.round(net[k])
  return net
}

// Direct (non-simplified) pairwise debts: for every pair who actually
// shared an expense or settlement together, net just their own two-way
// ledger - never routes a payment through a third party the way the
// greedy min-transaction `simplify()` below can. More transactions, but
// each one traces back to an actual shared expense between those two
// people.
export function pairwiseBalances(expenses, settlements) {
  // owed[a][b] = amount a owes b, accumulated before per-pair netting.
  const owed = {}
  const add = (a, b, amount) => {
    if (!amount) return
    owed[a] ||= {}
    owed[a][b] = (owed[a][b] || 0) + amount
  }

  for (const e of expenses) {
    if (e.deleted) continue
    const total = Object.values(e.paidBy || {}).reduce((s, v) => s + (v || 0), 0)
    if (total <= 0) continue
    for (const [payer, paid] of Object.entries(e.paidBy || {})) {
      if (!paid) continue
      for (const [participant, share] of Object.entries(e.splits || {})) {
        if (participant === payer || !share) continue
        // Almost always one payer (paid/total = 1); the proportional split
        // below only matters if an expense is ever recorded with more than one.
        add(participant, payer, Math.round((share * paid) / total))
      }
    }
  }
  for (const s of settlements) {
    if (s.deleted) continue
    add(s.from, s.to, -s.amount)
  }

  const seenPairs = new Set()
  const transfers = []
  for (const a of Object.keys(owed)) {
    for (const b of Object.keys(owed[a])) {
      const key = [a, b].sort().join('\0')
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      const net = (owed[a]?.[b] || 0) - (owed[b]?.[a] || 0)
      if (net > 0) transfers.push({ from: a, to: b, amount: net })
      else if (net < 0) transfers.push({ from: b, to: a, amount: -net })
    }
  }
  return transfers
}

// Greedy minimum-cash-flow: settle everyone with the fewest transfers.
export function simplify(net) {
  const creditors = []
  const debtors = []
  for (const [id, amount] of Object.entries(net)) {
    if (amount > 0) creditors.push({ id, amount })
    else if (amount < 0) debtors.push({ id, amount: -amount })
  }
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const transfers = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)
    if (pay > 0) {
      transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay })
    }
    debtors[i].amount -= pay
    creditors[j].amount -= pay
    if (debtors[i].amount === 0) i++
    if (creditors[j].amount === 0) j++
  }
  return transfers
}

// What does `userId` owe / get back, and to/from whom, within this ledger.
// `simplifyDebts` picks which transfer list is returned: the greedy
// minimum-transaction graph (may route a payment through someone you never
// actually transacted with), or the direct pairwise one (more transactions,
// but only ever between people who actually shared an expense).
export function userSummary(userId, memberIds, expenses, settlements, simplifyDebts = true) {
  const net = netBalances(memberIds, expenses, settlements)
  const transfers = simplifyDebts ? simplify({ ...net }) : pairwiseBalances(expenses, settlements)
  const youOwe = transfers.filter((t) => t.from === userId)
  const owedToYou = transfers.filter((t) => t.to === userId)
  return {
    net,
    transfers,
    youOwe,
    owedToYou,
    youOweTotal: youOwe.reduce((s, t) => s + t.amount, 0),
    owedToYouTotal: owedToYou.reduce((s, t) => s + t.amount, 0),
    balance: net[userId] || 0,
  }
}

export function expenseTotal(e) {
  return sumValues(e.paidBy)
}
