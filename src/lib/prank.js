// Purely-cosmetic, local-only overlay for the "Put all Akash's debt on me"
// easter egg (see Account.jsx / store.js's akashPrank state, and hooks.js
// where this is applied). Never touches real ledger data, never leaves
// this browser tab - it just re-derives already-computed display numbers.
// Kept dependency-free (like balances.js) so it's independently testable.
import { simplify } from './balances.js'

// If the target isn't in debt *in this particular group*, this is a no-op
// for that group (there's nothing to "take on").
export function applyPrank(summary, prank, currentUserId) {
  if (!prank) return summary
  const targetNet = summary.net[prank.targetId]
  if (targetNet == null || targetNet >= 0) return summary
  const owed = -targetNet
  const net = { ...summary.net, [prank.targetId]: 0, [currentUserId]: (summary.net[currentUserId] || 0) + owed }
  const transfers = simplify({ ...net })
  const youOwe = transfers.filter((t) => t.from === currentUserId)
  const owedToYou = transfers.filter((t) => t.to === currentUserId)
  return {
    ...summary,
    net,
    transfers,
    youOwe,
    owedToYou,
    youOweTotal: youOwe.reduce((s, t) => s + t.amount, 0),
    owedToYouTotal: owedToYou.reduce((s, t) => s + t.amount, 0),
    balance: net[currentUserId] || 0,
  }
}
