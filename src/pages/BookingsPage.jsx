import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../store'
import { fmtDate, today, nightsLabel } from '../lib/dates'
import { balance, endOf, nightsOf } from '../lib/calc'
import { money, sourceLabel } from '../lib/format'
import { Chips, Dot, Empty, PropertySelect } from '../components/ui'

const FILTERS = [
  { id: 'now', label: 'Текущие и будущие' },
  { id: 'past', label: 'Прошедшие' },
  { id: 'cancelled', label: 'Отменённые' },
  { id: 'all', label: 'Все' },
]

export default function BookingsPage() {
  const { data, activeProperties, propertyById } = useData()
  const [filter, setFilter] = useState('now')
  const [pid, setPid] = useState(null)
  const [q, setQ] = useState('')
  const t = today()

  const query = q.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  const list = data.bookings
    .filter((b) => {
      if (pid && b.property_id !== pid) return false
      if (filter === 'now' && (b.status === 'cancelled' || endOf(b) < t)) return false
      if (filter === 'past' && (b.status === 'cancelled' || endOf(b) >= t)) return false
      if (filter === 'cancelled' && b.status !== 'cancelled') return false
      if (query && !(b.guest_name || '').toLowerCase().includes(query) &&
        !(digits && (b.guest_phone || '').replace(/\D/g, '').includes(digits))) return false
      return true
    })
    .sort((a, b) => (filter === 'now' ? (a.check_in < b.check_in ? -1 : 1) : (a.check_in < b.check_in ? 1 : -1)))

  return (
    <div className="page">
      <div className="page-head">
        <h1>Брони</h1>
        <Link className="btn primary" to="/booking/new">+ Бронь</Link>
      </div>
      <Chips value={filter} onChange={setFilter} options={FILTERS} />
      <div className="toolbar">
        <input type="search" placeholder="Поиск по имени или телефону" value={q} onChange={(e) => setQ(e.target.value)} />
        {activeProperties.length > 1 && <PropertySelect properties={activeProperties} value={pid} onChange={setPid} allowAll />}
      </div>

      {!list.length && <Empty>Броней нет</Empty>}
      <div className="cards">
        {list.map((b) => {
          const p = propertyById.get(b.property_id)
          const bal = balance(b, data.payments, t)
          const n = nightsOf(b)
          const now = b.check_in <= t && endOf(b) > t
          return (
            <Link key={b.id} to={`/booking/${b.id}`} className="card booking-card" style={{ '--c': p?.color }}>
              <div className="bc-top">
                <b>{b.guest_name || 'Гость'}</b>
                {now && b.status !== 'cancelled' && <span className="badge live">живёт</span>}
                {b.status === 'pending' && <span className="badge warn">ждём предоплату</span>}
                {b.status === 'cancelled' && <span className="badge">отменена</span>}
                {b.mode === 'monthly' && <span className="badge">помесячно</span>}
              </div>
              <div className="muted"><Dot color={p?.color} />{p?.name}</div>
              <div>{fmtDate(b.check_in)} — {b.check_out ? fmtDate(b.check_out) : 'бессрочно'}{n ? ` · ${nightsLabel(n)}` : ''}</div>
              <div className="bc-bottom">
                <span>{b.mode === 'daily' ? money(b.price_total) : `${money(b.monthly_rate)}/мес`}</span>
                <span className="muted">{sourceLabel(b.source)}</span>
                {bal.left > 0 && b.status !== 'cancelled' && <span className="badge danger">долг {money(bal.left)}</span>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
