import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchLedger } from '../lib/api.js'
import { relativeDay } from '../lib/format.js'
import TopBar from '../components/TopBar.jsx'
import EmptyState from '../components/EmptyState.jsx'

const ICON = {
  'expense.add': '🧾',
  'expense.update': '✏️',
  'expense.delete': '🗑️',
  'settlement.add': '💸',
  'settlement.delete': '↩️',
  'group.create': '✨',
  'group.delete': '🗑️',
  'group.rename': '✏️',
  'group.archive': '📦',
  'group.unarchive': '📤',
  'member.add': '🙋',
  'member.remove': '👋',
}

const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export default function Ledger() {
  const nav = useNavigate()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLedger()
      .then(setRows)
      .catch((e) => setError(e.message || 'Could not load the ledger'))
  }, [])

  let lastDay = null

  return (
    <>
      <TopBar title="Ledger" back onBack={() => nav('/account')} />
      <div className="content">
        <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
          Every add, edit, delete and settle-up — kept permanently, even after the thing itself is removed.
        </p>

        {error && <div className="card" style={{ padding: 16 }}>{error}</div>}

        {rows && rows.length === 0 && (
          <div className="card">
            <EmptyState emoji="📜" title="Nothing recorded yet">
              Your history starts building the moment you add an expense or settle up.
            </EmptyState>
          </div>
        )}

        {rows &&
          rows.map((r) => {
            const day = relativeDay(r.at)
            const showDay = day !== lastDay
            lastDay = day
            return (
              <Fragment key={r.id}>
                {showDay && <div className="divider-day">{day}</div>}
                <div className="row card" style={{ marginBottom: 8, borderRadius: 12, alignItems: 'flex-start' }}>
                  <div className="emoji-badge">{ICON[r.action] || '•'}</div>
                  <div className="grow">
                    <div className="title" style={{ whiteSpace: 'normal' }}>{r.detail}</div>
                    <div className="sub" style={{ whiteSpace: 'normal' }}>
                      {r.groupName ? r.groupName + ' · ' : ''}
                      {r.actorName} · {timeOf(r.at)}
                    </div>
                  </div>
                </div>
              </Fragment>
            )
          })}
      </div>
    </>
  )
}
