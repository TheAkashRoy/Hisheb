import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { useToast } from '../components/Toast.jsx'
import TopBar from '../components/TopBar.jsx'
import Avatar from '../components/Avatar.jsx'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'BDT', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'CNY', 'BRL']

export default function Account() {
  const toast = useToast()
  const me = useStore((s) => s.currentUserId)
  const myName = useStore((s) => s.people[s.currentUserId]?.name || 'You')
  const email = useStore((s) => s.user?.email)
  const settings = useStore((s) => s.settings)
  const updatePerson = useStore((s) => s.updatePerson)
  const setSettings = useStore((s) => s.setSettings)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)
  const loadSample = useStore((s) => s.loadSample)
  const logout = useStore((s) => s.logout)

  const [name, setName] = useState(myName)
  const fileRef = useRef(null)
  const [installEvt, setInstallEvt] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const saveName = () => {
    updatePerson(me, { name: name.trim() || 'You' })
    toast('Saved')
  }

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hisheb-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = importData(String(reader.result))
      toast(res.ok ? 'Backup restored' : res.reason)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const install = async () => {
    if (!installEvt) return toast('Use your browser menu → “Install app”')
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  return (
    <>
      <TopBar title="Account" />
      <div className="content">
        <div className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar person={{ id: me, name }} size="lg" />
          <div className="grow">
            <div className="title" style={{ fontSize: 18 }}>
              {name}
            </div>
            <div className="sub">{email}</div>
          </div>
        </div>

        <div className="section-title">Your name</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" onClick={saveName}>
            Save
          </button>
        </div>

        <div className="section-title">Default currency</div>
        <select
          className="select"
          value={settings.currency}
          onChange={(e) => {
            setSettings({ currency: e.target.value })
            toast('Default currency updated')
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="hint">Used for new groups. Each group keeps its own currency.</div>

        <div className="section-title">App</div>
        <div className="card list">
          <button className="row" onClick={install}>
            <div className="emoji-badge">📲</div>
            <div className="grow">
              <div className="title">Install Hisheb</div>
              <div className="sub">Add to your home screen, works offline</div>
            </div>
            <span className="chev">›</span>
          </button>
        </div>

        <div className="section-title">Your data</div>
        <div className="card list">
          <button className="row" onClick={doExport}>
            <div className="emoji-badge">⬇️</div>
            <div className="grow">
              <div className="title">Export backup</div>
              <div className="sub">Download a JSON file of what you can see</div>
            </div>
          </button>
          <button className="row" onClick={() => fileRef.current?.click()}>
            <div className="emoji-badge">⬆️</div>
            <div className="grow">
              <div className="title">Restore backup</div>
              <div className="sub">Not available while synced to your account</div>
            </div>
          </button>
          <button className="row" onClick={loadSample}>
            <div className="emoji-badge">✨</div>
            <div className="grow">
              <div className="title">Load sample data</div>
              <div className="sub">Adds an example trip group</div>
            </div>
          </button>
          <button
            className="row"
            onClick={() => {
              if (confirm('Leave every group and delete the ones only you are in? This cannot be undone.')) {
                resetAll()
                toast('Cleared')
              }
            }}
          >
            <div className="emoji-badge">🗑️</div>
            <div className="grow">
              <div className="title" style={{ color: 'var(--danger)' }}>
                Erase everything
              </div>
              <div className="sub">Leaves shared groups for everyone else</div>
            </div>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={doImport} />

        <div className="section-title">Session</div>
        <div className="card list">
          <button
            className="row"
            onClick={() => {
              logout()
              toast('Logged out')
            }}
          >
            <div className="emoji-badge">🚪</div>
            <div className="grow">
              <div className="title">Log out</div>
            </div>
          </button>
        </div>

        <p className="hint" style={{ marginTop: 20, textAlign: 'center' }}>
          Hisheb · v1.0
        </p>
      </div>
    </>
  )
}
