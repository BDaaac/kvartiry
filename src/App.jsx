import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase, isDemo } from './lib/db'
import { DataProvider, useData } from './store'
import Login from './pages/Login'
import CalendarPage from './pages/CalendarPage'
import BookingsPage from './pages/BookingsPage'
import BookingPage from './pages/BookingPage'
import DashboardPage from './pages/DashboardPage'
import ExpensesPage from './pages/ExpensesPage'
import PropertiesPage from './pages/PropertiesPage'
import MorePage from './pages/MorePage'
import GuestsPage from './pages/GuestsPage'
import DepositsPage from './pages/DepositsPage'
import Icon, { Logo } from './components/Icon'
import { fmtDate, today } from './lib/dates'

export default function App() {
  const [session, setSession] = useState(isDemo ? 'demo' : undefined)

  useEffect(() => {
    if (isDemo) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="splash">Загрузка…</div>
  if (!session) return <Login />

  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}

const TABS = [
  { to: '/calendar', label: 'Календарь', icon: 'calendar' },
  { to: '/bookings', label: 'Брони', icon: 'key' },
  { to: '/money', label: 'Деньги', icon: 'chart' },
  { to: '/expenses', label: 'Расходы', icon: 'receipt' },
  { to: '/more', label: 'Ещё', icon: 'grid' },
]

function Shell() {
  const { loading, error, reload, toast } = useData()
  return (
    <div className="app">
      {isDemo && <div className="demo-bar">Демо-режим: данные хранятся только в этом браузере</div>}
      <header className="topbar">
        <Logo />
        <span className="topbar-date">{fmtDate(today())}</span>
      </header>
      <main className="main">
        {loading ? (
          <div className="splash">Загрузка…</div>
        ) : error ? (
          <div className="card error-card">
            <p>Не удалось загрузить данные: {error}</p>
            <button className="btn" onClick={reload}>Повторить</button>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/calendar" replace />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/booking/:id" element={<BookingPage />} />
            <Route path="/money" element={<DashboardPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/guests" element={<GuestsPage />} />
            <Route path="/deposits" element={<DepositsPage />} />
            <Route path="*" element={<Navigate to="/calendar" replace />} />
          </Routes>
        )}
      </main>
      <nav className="tabbar">
        <div className="tabbar-logo"><Logo /></div>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  )
}
