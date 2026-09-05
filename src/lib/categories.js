export const CATEGORIES = [
  { id: 'general', label: 'General', emoji: '🧾' },
  { id: 'food', label: 'Food & drink', emoji: '🍔' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'home', label: 'Home', emoji: '🏠' },
  { id: 'utilities', label: 'Utilities', emoji: '💡' },
  { id: 'rent', label: 'Rent', emoji: '🔑' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'hotel', label: 'Lodging', emoji: '🛏️' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'health', label: 'Health', emoji: '💊' },
  { id: 'gifts', label: 'Gifts', emoji: '🎁' },
  { id: 'other', label: 'Other', emoji: '💫' },
]

const MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

export function category(id) {
  return MAP[id] || MAP.general
}
