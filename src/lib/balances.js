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
export function userSummary(userId, memberIds, expenses, settlements) {
  const net = netBalances(memberIds, expenses, settlements)
  const transfers = simplify({ ...net })
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
