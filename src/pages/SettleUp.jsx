import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store.js'
import { useGroupLedger } from '../hooks.js'
import { useToast } from '../components/Toast.jsx'
import { toCents, fromCents, formatMoney } from '../lib/money.js'
import TopBar from '../components/TopBar.jsx'
import EmptyState from '../components/EmptyState.jsx'

const todayLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export default function SettleUp() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const led = useGroupLedger(id)
  const people = useStore((s) => s.people)
  const me = useStore((s) => s.currentUserId)
  const addSettlement = useStore((s) => s.addSettlement)

  const [from, setFrom] = useState(me)
  const [to, setTo] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [note, setNote] = useState('')

  if (!led) {
    return (
      <>
        <TopBar title="Settle up" back />
        <div className="content">
          <EmptyState emoji="🤷" title="Group not found" />
        </div>
      </>
    )
  }
  const { group, transfers } = led
  const nameOf = (pid) => (pid === me ? 'You' : people[pid]?.name || 'Someone')

  const applySuggestion = (t) => {
    setFrom(t.from)
    setTo(t.to)
    setAmountStr(String(fromCents(t.amount)))
  }

  const record = () => {
    if (!from || !to || from === to) return toast('Pick two different people')
    const cents = toCents(amountStr)
    if (cents <= 0) return toast('Enter an amount')
    addSettlement({
      groupId: id,
      from,
      to,
      amount: cents,
      currency: group.currency,
      date: new Date(date + 'T12:00:00').toISOString(),
      note,
    })
    toast('Payment recorded')
    nav(`/groups/${id}`, { replace: true })
  }

  return (
    <>
      <TopBar title="Settle up" back onBack={() => nav(`/groups/${id}`)} />
      <div className="content">
        {transfers.length > 0 && (
          <>
            <div className="section-title">Suggested payments</div>
            <div className="card" style={{ padding: '4px 14px' }}>
              {transfers.map((t, i) => (
                <button
                  key={i}
                  className="balance-line"
                  style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left' }}
                  onClick={() => applySuggestion(t)}
                >
                  <span>➜</span>
                  <div className="grow">
                    <b>{nameOf(t.from)}</b> → <b>{nameOf(t.to)}</b>
                  </div>
                  <span className="mono amt-neg">{formatMoney(t.amount, group.currency)}</span>
                </button>
              ))}
            </div>
            <div className="hint">Tap a row to fill in the payment below.</div>
          </>
        )}

        <div className="section-title">Record a payment</div>
        <div className="field">
          <label>From (who pays)</label>
          <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
            {group.memberIds.map((pid) => (
              <option key={pid} value={pid}>
                {nameOf(pid)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>To (who receives)</label>
          <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Select…</option>
            {group.memberIds
              .filter((pid) => pid !== from)
              .map((pid) => (
                <option key={pid} value={pid}>
                  {nameOf(pid)}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label>Amount</label>
          <input
            className="input mono"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Note</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. bank transfer"
          />
        </div>
        <button className="btn primary block" onClick={record}>
          Record payment
        </button>
      </div>
    </>
  )
}
