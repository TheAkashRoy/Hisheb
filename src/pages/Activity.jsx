import { Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store.js'
import { formatMoney } from '../lib/money.js'
import { relativeDay } from '../lib/format.js'
import { category } from '../lib/categories.js'
import TopBar from '../components/TopBar.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Activity() {
  const expenses = useStore((s) => s.expenses)
  const settlements = useStore((s) => s.settlements)
  const groups = useStore((s) => s.groups)
  const people = useStore((s) => s.people)
  const me = useStore((s) => s.currentUserId)

  const feed = useMemo(() => {
    const items = [
      ...Object.values(expenses)
        .filter((e) => !e.deleted)
        .map((e) => ({ kind: 'expense', at: e.createdAt, data: e })),
      ...Object.values(settlements)
        .filter((s) => !s.deleted)
        .map((s) => ({ kind: 'settle', at: s.createdAt, data: s })),
    ]
    return items.sort((a, b) => b.at.localeCompare(a.at))
  }, [expenses, settlements])

  const nameOf = (pid) => (pid === me ? 'You' : people[pid]?.name || 'Someone')

  let lastDay = null

  return (
    <>
      <TopBar title="Activity" />
      <div className="content">
        {feed.length === 0 ? (
          <div className="card">
            <EmptyState emoji="🕓" title="Nothing here yet">
              Your expenses and payments will show up as a timeline.
            </EmptyState>
          </div>
        ) : (
          feed.map((item) => {
            const g = groups[item.data.groupId]
            const day = relativeDay(item.at)
            const showDay = day !== lastDay
            lastDay = day
            const e = item.data

            if (item.kind === 'expense') {
              const cat = category(e.category)
              const payer = Object.keys(e.paidBy)[0]
              const yourShare = e.splits[me] || 0
              const yourPaid = e.paidBy[me] || 0
              const delta = yourPaid - yourShare
              return (
                <Fragment key={e.id}>
                  {showDay && <div className="divider-day">{day}</div>}
                  <Link to={`/expense/${e.id}`} className="row card" style={{ marginBottom: 8, borderRadius: 12 }}>
                    <div className="emoji-badge">{cat.emoji}</div>
                    <div className="grow">
                      <div className="title">{e.description}</div>
                      <div className="sub">
                        {g ? g.emoji + ' ' + g.name + ' · ' : ''}
                        {nameOf(payer)} paid {formatMoney(e.amount, e.currency)}
                      </div>
                    </div>
                    <div className="trailing">
                      {delta === 0 ? (
                        <span className="amt-zero" style={{ fontSize: 12 }}>
                          —
                        </span>
                      ) : (
                        <span className={delta > 0 ? 'amt-pos mono' : 'amt-neg mono'}>
                          {delta > 0 ? '+' : '-'}
                          {formatMoney(Math.abs(delta), e.currency)}
                        </span>
                      )}
                    </div>
                  </Link>
                </Fragment>
              )
            }

            return (
              <Fragment key={e.id}>
                {showDay && <div className="divider-day">{day}</div>}
                <div className="row card" style={{ marginBottom: 8, borderRadius: 12 }}>
                  <div className="emoji-badge">💸</div>
                  <div className="grow">
                    <div className="title">
                      {nameOf(e.from)} paid {e.to === me ? 'you' : nameOf(e.to)}
                    </div>
                    <div className="sub">
                      {g ? g.emoji + ' ' + g.name : 'Payment'}
                      {e.note ? ' · ' + e.note : ''}
                    </div>
                  </div>
                  <div className="trailing mono">{formatMoney(e.amount, e.currency)}</div>
                </div>
              </Fragment>
            )
          })
        )}
      </div>
    </>
  )
}
