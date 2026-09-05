import { Link, useNavigate } from 'react-router-dom'
import { useStore, selectGroups } from '../store.js'
import { useOverall, useGroupBalance } from '../hooks.js'
import { formatMoney } from '../lib/money.js'
import TopBar from '../components/TopBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { AvatarStack } from '../components/Avatar.jsx'

export default function Dashboard() {
  const nav = useNavigate()
  const groups = useStore(selectGroups)
  const people = useStore((s) => s.people)
  const loadSample = useStore((s) => s.loadSample)
  const overall = useOverall()

  const currencies = Object.keys(overall).filter((c) => overall[c] !== 0)

  return (
    <>
      <TopBar
        title="Hisheb"
        right={
          <Link to="/groups/new" className="iconbtn" aria-label="New group">
            ＋
          </Link>
        }
      />
      <div className="content">
        <div className="summary">
          <div style={{ fontSize: 13, opacity: 0.9 }}>Overall, across all groups</div>
          {currencies.length === 0 ? (
            <div className="big">You're all settled up 🎉</div>
          ) : (
            currencies.map((c) => (
              <div className="big" key={c}>
                {overall[c] > 0 ? 'you are owed ' : 'you owe '}
                {formatMoney(Math.abs(overall[c]), c)}
              </div>
            ))
          )}
        </div>

        <div className="section-title">Your groups</div>
        {groups.length === 0 ? (
          <div className="card">
            <EmptyState emoji="👥" title="No groups yet">
              Create a group for a trip, flatmates or anything you share costs on.
            </EmptyState>
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <button className="btn primary block" onClick={() => nav('/groups/new')}>
                Create a group
              </button>
              <button className="btn subtle block" onClick={loadSample}>
                Load sample data
              </button>
            </div>
          </div>
        ) : (
          <div className="card list">
            {groups.map((g) => (
              <GroupRow key={g.id} group={g} people={people} />
            ))}
          </div>
        )}
      </div>

      {groups.length > 0 && (
        <button className="fab" onClick={() => nav('/expense/new')}>
          ＋ Add expense
        </button>
      )}
    </>
  )
}

function GroupRow({ group, people }) {
  const balance = useGroupBalance(group.id)
  const members = group.memberIds.map((id) => people[id]).filter(Boolean)
  return (
    <Link to={`/groups/${group.id}`} className="row">
      <div className="emoji-badge">{group.emoji}</div>
      <div className="grow">
        <div className="title">
          {group.name} {group.archived && <span className="pill">archived</span>}
        </div>
        <div className="sub">
          <AvatarStack people={members} />
        </div>
      </div>
      <div className="trailing">
        <BalanceTag cents={balance} currency={group.currency} />
      </div>
      <span className="chev">›</span>
    </Link>
  )
}

export function BalanceTag({ cents, currency }) {
  if (cents === 0) return <span className="amt-zero">settled up</span>
  const owed = cents > 0
  return (
    <div>
      <div style={{ fontSize: 11 }} className={owed ? 'amt-pos' : 'amt-neg'}>
        {owed ? 'you are owed' : 'you owe'}
      </div>
      <div className={owed ? 'amt-pos mono' : 'amt-neg mono'}>{formatMoney(Math.abs(cents), currency)}</div>
    </div>
  )
}
