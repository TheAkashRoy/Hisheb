export function formatDate(iso, { withYear } = {}) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function relativeDay(iso) {
  const d = new Date(iso)
  const now = new Date()
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return formatDate(iso, { withYear: d.getFullYear() !== now.getFullYear() })
}

export function monthKey(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

const COLORS = [
  '#12b886', '#4c6ef5', '#e8590c', '#ae3ec9', '#f03e3e',
  '#1098ad', '#f59f00', '#7048e8', '#0ca678', '#d6336c',
]
export function colorFor(seed) {
  let h = 0
  for (let i = 0; i < String(seed).length; i++) h = (h * 31 + String(seed).charCodeAt(i)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}
