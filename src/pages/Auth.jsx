import { useState } from 'react'
import { useStore } from '../store.js'

export default function Auth() {
  const login = useStore((s) => s.login)
  const signup = useStore((s) => s.signup)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await signup(email.trim(), password, name.trim())
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="content" style={{ maxWidth: 360, margin: '10vh auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="big-emoji">➗</div>
          <h1 style={{ margin: '4px 0 0' }}>Hisheb</h1>
          <p className="hint">Split shared expenses fairly</p>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          {mode === 'signup' && (
            <div className="field">
              <label>Your name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === 'login'}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>}
          <button className="btn primary block" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <button
          className="btn subtle block"
          style={{ marginTop: 10 }}
          onClick={() => {
            setMode((m) => (m === 'login' ? 'signup' : 'login'))
            setError('')
          }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
