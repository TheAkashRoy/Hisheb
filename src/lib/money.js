// All money is stored as integer minor units (cents) to avoid float drift.

export function toCents(value) {
  const n = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : Number(value)
  if (!isFinite(n)) return 0
  return Math.round(n * 100)
}

export function fromCents(cents) {
  return (cents || 0) / 100
}

const SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', BDT: '৳', JPY: '¥',
  AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', CNY: '¥', BRL: 'R$',
}

export function currencySymbol(code) {
  return SYMBOLS[code] || code + ' '
}

export function formatMoney(cents, currency = 'INR', { sign = false } = {}) {
  const neg = cents < 0
  const abs = Math.abs(cents || 0)
  const body = currencySymbol(currency) + (abs / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (sign) return (neg ? '-' : '+') + body
  return (neg ? '-' : '') + body
}

// Split `totalCents` across `ids` in equal parts, spreading the leftover
// cents one-by-one so the parts always sum back to the total.
export function splitEqual(totalCents, ids) {
  const n = ids.length
  if (n === 0) return {}
  const base = Math.floor(Math.abs(totalCents) / n)
  let remainder = Math.abs(totalCents) - base * n
  const sign = totalCents < 0 ? -1 : 1
  const out = {}
  ids.forEach((id, i) => {
    out[id] = sign * (base + (i < remainder ? 1 : 0))
  })
  return out
}

// Given raw weights (percentages or shares), distribute totalCents
// proportionally, correcting rounding drift on the last entry.
export function splitByWeight(totalCents, weightsById) {
  const ids = Object.keys(weightsById)
  const sum = ids.reduce((s, id) => s + (Number(weightsById[id]) || 0), 0)
  if (sum <= 0) return splitEqual(totalCents, ids)
  const out = {}
  let allocated = 0
  ids.forEach((id, i) => {
    if (i === ids.length - 1) {
      out[id] = totalCents - allocated
    } else {
      const part = Math.round((totalCents * (Number(weightsById[id]) || 0)) / sum)
      out[id] = part
      allocated += part
    }
  })
  return out
}

export function sumValues(obj) {
  return Object.values(obj || {}).reduce((s, v) => s + (Number(v) || 0), 0)
}
