import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', ico: '⚖️', label: 'Balances', end: true },
  { to: '/activity', ico: '🕓', label: 'Activity' },
  { to: '/people', ico: '👤', label: 'People' },
  { to: '/account', ico: '⚙️', label: 'Account' },
]

export default function BottomNav() {
  return (
    <nav className="bottomnav">
      <div className="navwrap">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{it.ico}</span>
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
