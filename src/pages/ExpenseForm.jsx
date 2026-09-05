import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store.js'
import { useToast } from '../components/Toast.jsx'
import { toCents, fromCents, formatMoney, currencySymbol, splitEqual } from '../lib/money.js'
import { CATEGORIES } from '../lib/categories.js'
import TopBar from '../components/TopBar.jsx'
import Avatar from '../components/Avatar.jsx'

const todayLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
const dateToIso = (ymd) => new Date(ymd + 'T12:00:00').toISOString()

export default function ExpenseForm() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()

  const groups = useStore((s) => s.groups)
  const people = useStore((s) => s.people)
  const me = useStore((s) => s.currentUserId)
  const existing = useStore((s) => (id ? s.expenses[id] : null))
  const addExpense = useStore((s) => s.addExpense)
  const updateExpense = useStore((s) => s.updateExpense)
  const deleteExpense = useStore((s) => s.deleteExpense)

  const groupList = Object.values(groups)
  const [groupId, setGroupId] = useState(
    existing?.groupId || sp.get('group') || groupList[0]?.id || '',
  )
  const group = groups[groupId]
  const members = group ? group.memberIds : []

  const [description, setDescription] = useState(existing?.description || '')
  const [amountStr, setAmountStr] = useState(existing ? String(fromCents(existing.amount)) : '')
  const [categoryId, setCategoryId] = useState(existing?.category || 'general')
  const [date, setDate] = useState(existing ? existing.date.slice(0, 10) : todayLocal())
  const [payer, setPayer] = useState(existing ? Object.keys(existing.paidBy)[0] : me)
  const [mode, setMode] = useState(existing?.splitMode || 'equal')
  const [participants, setParticipants] = useState(
    existing?.participants?.length ? existing.participants : members,
  )
  const [exact, setExact] = useState(() => {
    const o = {}
    if (existing?.splitMode === 'exact') {
      for (const [k, v] of Object.entries(existing.splits)) o[k] = String(fromCents(v))
    }
    return o
  })
  const [notes, setNotes] = useState(existing?.notes || '')

  const amountCents = toCents(amountStr)
  const currency = group?.currency || 'INR'

  const preview = useMemo(() => {
    if (mode === 'equal') return splitEqual(amountCents, participants)
    const o = {}
    for (const p of participants) o[p] = toCents(exact[p] || 0)
    return o
  }, [mode, amountCents, participants, exact])

  const exactSum = participants.reduce((s, p) => s + toCents(exact[p] || 0), 0)
  const exactRemainder = amountCents - exactSum

  const toggleParticipant = (pid) =>
    setParticipants((list) => (list.includes(pid) ? list.filter((x) => x !== pid) : [...list, pid]))

  const save = () => {
    if (!group) return toast('Pick a group first')
    if (!description.trim()) return toast('Add a description')
    if (amountCents <= 0) return toast('Enter an amount')
    if (participants.length === 0) return toast('Choose who shares this')
    if (mode === 'exact' && exactRemainder !== 0)
      return toast(`Exact split is off by ${formatMoney(Math.abs(exactRemainder), currency)}`)

    const payload = {
      groupId,
      description,
      currency,
      category: categoryId,
      date: dateToIso(date),
      paidBy: { [payer]: amountCents },
      splitMode: mode,
      participants,
      splits: mode === 'exact' ? preview : {},
      notes,
    }
    if (id) {
      updateExpense(id, payload)
      toast('Expense updated')
    } else {
      addExpense(payload)
      toast('Expense added')
    }
    nav(groupId ? `/groups/${groupId}` : '/', { replace: true })
  }

  const remove = () => {
    if (!confirm('Delete this expense?')) return
    deleteExpense(id)
    toast('Expense deleted')
    nav(existing?.groupId ? `/groups/${existing.groupId}` : '/', { replace: true })
  }

  if (groupList.length === 0) {
    return (
      <div className="fullscreen-form">
        <TopBar title="Add expense" back />
        <div className="content">
          <div className="empty">
            <div className="big-emoji">👥</div>
            <h3>Create a group first</h3>
            <p>Expenses live inside a group of people.</p>
            <button className="btn primary" onClick={() => nav('/groups/new')}>
              Create a group
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fullscreen-form">
      <TopBar
        title={id ? 'Edit expense' : 'Add expense'}
        back
        onBack={() => nav(-1)}
        right={
          <button className="btn primary" onClick={save}>
            Save
          </button>
        }
      />
      <div className="content">
        <div className="field">
          <label>Group</label>
          <select
            className="select"
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value)
              const g = groups[e.target.value]
              setParticipants(g.memberIds)
              if (!g.memberIds.includes(payer)) setPayer(me)
            }}
          >
            {groupList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.emoji} {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Description</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Dinner, taxi, groceries"
            autoFocus={!id}
          />
        </div>

        <div className="field">
          <label>Amount</label>
          <div className="amount-input">
            <span>{currencySymbol(currency)}</span>
            <input
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="field">
          <label>Category</label>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip ${categoryId === c.id ? 'on' : ''}`}
                onClick={() => setCategoryId(c.id)}
              >
                <span>{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label>Paid by</label>
          <select className="select" value={payer} onChange={(e) => setPayer(e.target.value)}>
            {members.map((pid) => (
              <option key={pid} value={pid}>
                {pid === me ? 'You' : people[pid]?.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Split</label>
          <div className="seg">
            <button className={mode === 'equal' ? 'on' : ''} onClick={() => setMode('equal')}>
              Equally
            </button>
            <button className={mode === 'exact' ? 'on' : ''} onClick={() => setMode('exact')}>
              Exact amounts
            </button>
          </div>

          <div className="card" style={{ padding: '4px 14px', marginTop: 10 }}>
            {members.map((pid) => {
              const on = participants.includes(pid)
              return (
                <div className="split-row" key={pid}>
                  <Avatar person={pid === me ? { id: me, name: 'You' } : people[pid]} size="sm" />
                  <div className="grow">
                    <div className="name">{pid === me ? 'You' : people[pid]?.name}</div>
                    {on && mode === 'equal' && (
                      <div className="hint">{formatMoney(preview[pid] || 0, currency)}</div>
                    )}
                  </div>
                  {mode === 'exact' && on ? (
                    <input
                      className="mini-input mono"
                      inputMode="decimal"
                      value={exact[pid] ?? ''}
                      placeholder="0.00"
                      onChange={(e) =>
                        setExact((x) => ({ ...x, [pid]: e.target.value.replace(/[^0-9.]/g, '') }))
                      }
                    />
                  ) : (
                    <input
                      type="checkbox"
                      className="check"
                      checked={on}
                      onChange={() => toggleParticipant(pid)}
                    />
                  )}
                </div>
              )
            })}
          </div>
          {mode === 'exact' && (
            <div className="hint" style={{ color: exactRemainder === 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {exactRemainder === 0
                ? 'Splits add up ✓'
                : `${formatMoney(exactSum, currency)} of ${formatMoney(amountCents, currency)} — ${
                    exactRemainder > 0 ? formatMoney(exactRemainder, currency) + ' left' : formatMoney(-exactRemainder, currency) + ' over'
                  }`}
            </div>
          )}
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {id && (
          <button className="btn danger block" onClick={remove}>
            Delete expense
          </button>
        )}
      </div>
    </div>
  )
}
