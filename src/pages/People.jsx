import { useMemo, useState } from 'react'
import { useStore } from '../store.js'
import { useToast } from '../components/Toast.jsx'
import TopBar from '../components/TopBar.jsx'
import Avatar from '../components/Avatar.jsx'
import Sheet from '../components/Sheet.jsx'

export default function People() {
  const toast = useToast()
  const people = useStore((s) => s.people)
  const groups = useStore((s) => s.groups)
  const me = useStore((s) => s.currentUserId)
  const addPerson = useStore((s) => s.addPerson)
  const updatePerson = useStore((s) => s.updatePerson)
  const removePerson = useStore((s) => s.removePerson)

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')

  const groupsOf = useMemo(() => {
    const map = {}
    for (const g of Object.values(groups)) {
      for (const pid of g.memberIds) (map[pid] ||= []).push(g.name)
    }
    return map
  }, [groups])

  const list = Object.values(people).sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0) || a.name.localeCompare(b.name))

  const add = () => {
    const n = newName.trim()
    if (!n) return
    const email = newEmail.trim()
    addPerson(n, email || undefined)
    setNewName('')
    setNewEmail('')
    toast(email ? 'Added — they can claim this by signing up with that email' : 'Person added')
  }

  const openEdit = (p) => {
    setEditing(p)
    setEditName(p.name)
  }

  const saveEdit = () => {
    updatePerson(editing.id, { name: editName.trim() || editing.name })
    setEditing(null)
    toast('Saved')
  }

  const del = (p) => {
    const res = removePerson(p.id)
    if (!res.ok) toast(res.reason)
    else toast('Person removed')
    setEditing(null)
  }

  return (
    <>
      <TopBar title="People" />
      <div className="content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            className="input"
            placeholder="Add someone by name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn primary" onClick={add}>
            Add
          </button>
        </div>
        <input
          className="input"
          style={{ marginBottom: 14 }}
          type="email"
          placeholder="Their email (optional — lets them claim this later)"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />

        <div className="card list">
          {list.map((p) => (
            <button key={p.id} className="row" onClick={() => openEdit(p)}>
              <Avatar person={p.me ? { id: me, name: p.name } : p} />
              <div className="grow">
                <div className="title">
                  {p.name} {p.me && <span className="pill">you</span>}
                </div>
                <div className="sub">
                  {groupsOf[p.id]?.length ? groupsOf[p.id].join(', ') : 'Not in any group'}
                </div>
              </div>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
        <div className="hint" style={{ marginTop: 12 }}>
          Add someone by email so they can sign up and see shared groups themselves — or just by name as a
          placeholder.
        </div>
      </div>

      {editing && (
        <Sheet title={editing.me ? 'Your name' : 'Edit person'} onClose={() => setEditing(null)}>
          <div className="field">
            <label>Name</label>
            <input
              className="input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn primary block" onClick={saveEdit}>
            Save
          </button>
          {!editing.me && (
            <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => del(editing)}>
              Remove person
            </button>
          )}
        </Sheet>
      )}
    </>
  )
}
