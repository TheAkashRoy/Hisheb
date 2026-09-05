import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store.js'
import { useToast } from '../components/Toast.jsx'
import TopBar from '../components/TopBar.jsx'
import Avatar from '../components/Avatar.jsx'

const EMOJIS = ['👥', '✈️', '🏠', '🍽️', '🏝️', '🎉', '⛰️', '🚗', '🛒', '💼', '❤️', '🎓']

export default function GroupForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()

  const existing = useStore((s) => (id ? s.groups[id] : null))
  const people = useStore((s) => s.people)
  const currentUserId = useStore((s) => s.currentUserId)
  const addGroup = useStore((s) => s.addGroup)
  const updateGroup = useStore((s) => s.updateGroup)
  const deleteGroup = useStore((s) => s.deleteGroup)
  const addPerson = useStore((s) => s.addPerson)

  const [name, setName] = useState(existing?.name || '')
  const [emoji, setEmoji] = useState(existing?.emoji || '👥')
  const [simplify, setSimplify] = useState(existing?.simplify ?? true)
  const [memberIds, setMemberIds] = useState(existing?.memberIds || [currentUserId])
  const [newName, setNewName] = useState('')

  const otherPeople = useMemo(
    () => Object.values(people).filter((p) => p.id !== currentUserId),
    [people, currentUserId],
  )

  const toggleMember = (pid) =>
    setMemberIds((ids) => (ids.includes(pid) ? ids.filter((x) => x !== pid) : [...ids, pid]))

  const addNewPerson = () => {
    const n = newName.trim()
    if (!n) return
    const pid = addPerson(n)
    setMemberIds((ids) => [...ids, pid])
    setNewName('')
  }

  const save = () => {
    if (!name.trim()) return toast('Give the group a name')
    if (id) {
      updateGroup(id, { name, emoji, simplify, memberIds })
      toast('Group updated')
      nav(`/groups/${id}`)
    } else {
      const gid = addGroup({ name, emoji, simplify, memberIds })
      nav(`/groups/${gid}`, { replace: true })
    }
  }

  const remove = () => {
    if (!confirm('Delete this group and all its expenses?')) return
    deleteGroup(id)
    toast('Group deleted')
    nav('/', { replace: true })
  }

  return (
    <div className="fullscreen-form">
      <TopBar
        title={id ? 'Edit group' : 'New group'}
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
          <label>Icon</label>
          <div className="chips">
            {EMOJIS.map((e) => (
              <button key={e} className={`chip ${emoji === e ? 'on' : ''}`} onClick={() => setEmoji(e)}>
                <span style={{ fontSize: 18 }}>{e}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Group name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lisbon trip"
            autoFocus={!id}
          />
        </div>

        <div className="field">
          <label>Members</label>
          <div className="card" style={{ padding: '4px 14px' }}>
            <div className="split-row">
              <Avatar person={people[currentUserId]} size="sm" />
              <div className="grow">
                <div className="name">You</div>
              </div>
              <span className="pill">owner</span>
            </div>
            {otherPeople.map((p) => (
              <label key={p.id} className="split-row" style={{ cursor: 'pointer' }}>
                <Avatar person={p} size="sm" />
                <div className="grow">
                  <div className="name">{p.name}</div>
                </div>
                <input
                  type="checkbox"
                  className="check"
                  checked={memberIds.includes(p.id)}
                  onChange={() => toggleMember(p.id)}
                />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              className="input"
              placeholder="Add a person by name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNewPerson()}
            />
            <button className="btn subtle" onClick={addNewPerson}>
              Add
            </button>
          </div>
        </div>

        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="checkbox"
            className="check"
            checked={simplify}
            onChange={(e) => setSimplify(e.target.checked)}
          />
          <span>
            <b style={{ display: 'block' }}>Simplify debts</b>
            <span className="hint">Combine balances so people make the fewest payments.</span>
          </span>
        </label>

        {id && (
          <>
            <button
              className="btn subtle block"
              style={{ marginTop: 8 }}
              onClick={() => {
                updateGroup(id, { archived: !existing.archived })
                toast(existing.archived ? 'Group un-archived' : 'Group archived')
              }}
            >
              {existing.archived ? 'Un-archive group' : 'Archive group'}
            </button>
            <button className="btn danger block" style={{ marginTop: 10 }} onClick={remove}>
              Delete group
            </button>
          </>
        )}
      </div>
    </div>
  )
}
