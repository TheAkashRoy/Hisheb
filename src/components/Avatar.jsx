import { colorFor, initials } from '../lib/format.js'

export default function Avatar({ person, name, id, size = '' }) {
  const label = person?.name ?? name ?? '?'
  const seed = person?.id ?? id ?? label
  return (
    <div className={`avatar ${size}`} style={{ background: colorFor(seed) }} title={label}>
      {initials(label)}
    </div>
  )
}

export function AvatarStack({ people = [], max = 4 }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <div className="stack">
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size="sm" />
      ))}
      {extra > 0 && (
        <div className="avatar sm" style={{ background: 'var(--text-dim)' }}>
          +{extra}
        </div>
      )}
    </div>
  )
}
