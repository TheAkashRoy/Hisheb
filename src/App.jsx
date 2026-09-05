import { Routes, Route, useLocation } from 'react-router-dom'
import { useStore } from './store.js'
import BottomNav from './components/BottomNav.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Activity from './pages/Activity.jsx'
import People from './pages/People.jsx'
import Account from './pages/Account.jsx'
import GroupDetail from './pages/GroupDetail.jsx'
import GroupForm from './pages/GroupForm.jsx'
import ExpenseForm from './pages/ExpenseForm.jsx'
import SettleUp from './pages/SettleUp.jsx'

export default function App() {
  const authStatus = useStore((s) => s.authStatus)
  const hydrated = useStore((s) => s.hydrated)
  const syncError = useStore((s) => s.syncError)
  const { pathname } = useLocation()
  const hideNav = pathname.startsWith('/expense') || pathname.endsWith('/edit') || pathname === '/groups/new'

  if (authStatus === 'checking' || (authStatus === 'authed' && !hydrated)) {
    return (
      <div className="app">
        <div className="empty" style={{ marginTop: '40vh' }}>
          <div className="big-emoji">➗</div>
        </div>
      </div>
    )
  }

  if (authStatus === 'anon') {
    return <Auth />
  }

  return (
    <div className="app">
      {syncError && (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 13,
            textAlign: 'center',
            background: '#f59f0022',
            color: '#b8860b',
          }}
        >
          {syncError}
        </div>
      )}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/people" element={<People />} />
        <Route path="/account" element={<Account />} />
        <Route path="/groups/new" element={<GroupForm />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/groups/:id/edit" element={<GroupForm />} />
        <Route path="/groups/:id/settle" element={<SettleUp />} />
        <Route path="/expense/new" element={<ExpenseForm />} />
        <Route path="/expense/:id" element={<ExpenseForm />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  )
}
