import { Fragment } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store.js'
import { useGroupLedger } from '../hooks.js'
import { formatMoney } from '../lib/money.js'
import { relativeDay } from '../lib/format.js'
import { category } from '../lib/categories.js'
import TopBar from '../components/TopBar.jsx'
import Avatar from '../components/Avatar.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function GroupDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const led = useGroupLedger(id)
  const people = useStore((s) => s.people)
  const me = useStore((s) => s.currentUserId)

  if (!led) {
    return (
      <>
        <TopBar title="Group" back />
        <div className="content">
          <EmptyState emoji="🤷" title="Group not found" />
        </div>
      </>
    )
  }

  const { group, expenses, settlements, net, transfers, balance } = led
  const nameOf = (pid) => (pid === me ? 'You' : people[pid]?.name || 'Someone')

  // merge expenses + settlements into one time-ordered feed
  const feed = [
    ...expenses.map((e) => ({ type: 'expense', date: e.date, createdAt: e.createdAt, data: e })),
    ...settlements.map((s) => ({ type: 'settle', date: s.date, createdAt: s.createdAt, data: s })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))

  let lastDay = null

  return (
    <>
      <TopBar
        title={
          <span>
            {group.emoji} {group.name}
          </span>
        }
        back
        onBack={() => nav('/')}
        right={
          <Link to={`/groups/${id}/edit`} className="iconbtn ghost" aria-label="Edit group">
            ⋯
          </Link>
        }
      />
      <div className="content">
        <div className="summary">
          <div style={{ fontSize: 13, opacity: 0.9 }}>Your balance in this group</div>
          <div className="big">
            {balance === 0
              ? "you're settled up"
              : (balance > 0 ? 'you are owed ' : 'you owe ') + formatMoney(Math.abs(balance), group.currency)}
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,.16)', color: '#fff', borderColor: 'transparent' }}
              onClick={() => nav(`/groups/${id}/settle`)}
            >
              Settle up
            </button>
            <button
              className="btn"
              style={{ background: '#fff', color: 'var(--brand)', borderColor: 'transparent' }}
              onClick={() => nav(`/expense/new?group=${id}`)}
            >
              ＋ Add expense
            </button>
          </div>
        </div>

        <div className="section-title">Balances</div>
        <div className="card" style={{ padding: '4px 14px' }}>
          {group.memberIds.map((pid) => {
            const v = net[pid] || 0
            return (
              <div className="balance-line" key={pid}>
                <Avatar person={pid === me ? { id: me, name: 'You' } : people[pid]} size="sm" />
                <div className="grow">
                  <b>{nameOf(pid)}</b>{' '}
                  {v === 0 ? (
                    <span className="amt-zero">is settled up</span>
                  ) : v > 0 ? (
                    <span>
                      {pid === me ? 'are' : 'is'} owed{' '}
                      <span className="amt-pos">{formatMoney(v, group.currency)}</span>
                    </span>
                  ) : (
                    <span>
                      {pid === me ? 'owe' : 'owes'}{' '}
                      <span className="amt-neg">{formatMoney(-v, group.currency)}</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {transfers.length > 0 && (
          <>
            <div className="section-title">
              {group.simplify ? 'Suggested payments (simplified)' : 'Who pays whom'}
            </div>
            <div className="card" style={{ padding: '4px 14px' }}>
              {transfers.map((t, i) => (
                <div className="balance-line" key={i}>
                  <span>➜</span>
                  <div className="grow">
                    <b>{nameOf(t.from)}</b> {t.from === me ? 'pay' : 'pays'} <b>{nameOf(t.to)}</b>{' '}
                    <span className="amt-neg">{formatMoney(t.amount, group.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="section-title">Activity</div>
        {feed.length === 0 ? (
          <div className="card">
            <EmptyState emoji="🧾" title="No expenses yet">
              Tap “Add expense” to record the first shared cost.
            </EmptyState>
          </div>
        ) : (
          <div className="list">
            {feed.map((item) => {
              const day = relativeDay(item.date)
              const showDay = day !== lastDay
              lastDay = day
              return (
                <Fragment key={item.data.id}>
                  {showDay && <div className="divider-day">{day}</div>}
                  {item.type === 'expense' ? (
                    <ExpenseRow e={item.data} me={me} people={people} currency={group.currency} />
                  ) : (
                    <SettleRow s={item.data} me={me} people={people} />
                  )}
                </Fragment>
              )
            })}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => nav(`/expense/new?group=${id}`)}>
        ＋ Add expense
      </button>
    </>
  )
}

function ExpenseRow({ e, me, people, currency }) {
  const cat = category(e.category)
  const payerId = Object.keys(e.paidBy)[0]
  const payerName = payerId === me ? 'You' : people[payerId]?.name || 'Someone'
  const paid = e.paidBy[me] || 0
  const share = e.splits[me] || 0
  const involved = payerId === me || share > 0
  const lent = paid - share

  return (
    <Link to={`/expense/${e.id}`} className="row card" style={{ marginBottom: 8, borderRadius: 12 }}>
      <div className="emoji-badge">{cat.emoji}</div>
      <div className="grow">
        <div className="title">{e.description}</div>
        <div className="sub">
          {payerName} paid {formatMoney(e.amount, currency)}
        </div>
      </div>
      <div className="trailing">
        {!involved ? (
          <span className="amt-zero" style={{ fontSize: 12 }}>
            not involved
          </span>
        ) : lent === 0 ? (
          <span className="amt-zero" style={{ fontSize: 12 }}>
            no share
          </span>
        ) : (
          <>
            <div style={{ fontSize: 11 }} className={lent > 0 ? 'amt-pos' : 'amt-neg'}>
              {lent > 0 ? 'you lent' : 'you borrowed'}
            </div>
            <div className={lent > 0 ? 'amt-pos mono' : 'amt-neg mono'}>
              {formatMoney(Math.abs(lent), currency)}
            </div>
          </>
        )}
      </div>
    </Link>
  )
}

function SettleRow({ s, me, people }) {
  const from = s.from === me ? 'You' : people[s.from]?.name || 'Someone'
  const to = s.to === me ? 'you' : people[s.to]?.name || 'someone'
  return (
    <div className="row card" style={{ marginBottom: 8, borderRadius: 12 }}>
      <div className="emoji-badge">💸</div>
      <div className="grow">
        <div className="title">
          {from} paid {to}
        </div>
        <div className="sub">{s.note || 'Settlement'}</div>
      </div>
      <div className="trailing mono">{formatMoney(s.amount, s.currency)}</div>
    </div>
  )
}
