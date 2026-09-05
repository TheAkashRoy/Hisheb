import { useMemo } from 'react'
import { useStore } from './store.js'
import { userSummary } from './lib/balances.js'
import { applyPrank } from './lib/prank.js'

const bySortedDate = (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

// Full settlement picture for one group, from the current user's point of view.
// Selects only stable store refs, then derives with useMemo to avoid render loops.
export function useGroupLedger(groupId) {
  const group = useStore((s) => s.groups[groupId])
  const expensesMap = useStore((s) => s.expenses)
  const settlementsMap = useStore((s) => s.settlements)
  const currentUserId = useStore((s) => s.currentUserId)
  const akashPrank = useStore((s) => s.akashPrank)

  return useMemo(() => {
    if (!group) return null
    const expenses = Object.values(expensesMap)
      .filter((e) => !e.deleted && e.groupId === groupId)
      .sort(bySortedDate)
    const settlements = Object.values(settlementsMap).filter((x) => !x.deleted && x.groupId === groupId)
    const summary = userSummary(currentUserId, group.memberIds, expenses, settlements, group.simplify)
    return { group, expenses, settlements, ...applyPrank(summary, akashPrank, currentUserId) }
  }, [group, expensesMap, settlementsMap, currentUserId, groupId, akashPrank])
}

// Per-currency net totals for the current user across every group.
export function useOverall() {
  const groupsMap = useStore((s) => s.groups)
  const expensesMap = useStore((s) => s.expenses)
  const settlementsMap = useStore((s) => s.settlements)
  const currentUserId = useStore((s) => s.currentUserId)
  const akashPrank = useStore((s) => s.akashPrank)

  return useMemo(() => {
    const byCurrency = {}
    for (const g of Object.values(groupsMap)) {
      const expenses = Object.values(expensesMap).filter((e) => !e.deleted && e.groupId === g.id)
      const settlements = Object.values(settlementsMap).filter((x) => !x.deleted && x.groupId === g.id)
      const summary = userSummary(currentUserId, g.memberIds, expenses, settlements, g.simplify)
      const { balance } = applyPrank(summary, akashPrank, currentUserId)
      byCurrency[g.currency] = (byCurrency[g.currency] || 0) + balance
    }
    if (akashPrank) {
      // The one-time "convenience fee" for your generosity - added once to
      // the overall total, not smeared across every group.
      const currency = Object.keys(byCurrency)[0] || 'INR'
      byCurrency[currency] = (byCurrency[currency] || 0) - akashPrank.bonus
    }
    return byCurrency
  }, [groupsMap, expensesMap, settlementsMap, currentUserId, akashPrank])
}

export function useGroupBalance(groupId) {
  const led = useGroupLedger(groupId)
  return led ? led.balance : 0
}
