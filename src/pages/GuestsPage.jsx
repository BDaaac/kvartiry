import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../store'
import { buildGuests } from '../lib/guests'
import { fmtDate, nightsLabel, plural } from '../lib/dates'
import { nightsOf } from '../lib/calc'
import { money, whatsappLink, statusLabel } from '../lib/format'
import { Sheet, Dot, Empty } from '../components/ui'
import Icon from '../components/Icon'

export default function GuestsPage() {
  const { data } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const guests = useMemo(() => buildGuests(data.bookings, data.payments), [data.bookings, data.payments])

  const query = q.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  const list = guests.filter((g) => !query || g.name.toLowerCase().includes(query) ||
    (digits && (g.phone || '').replace(/\D/g, '').includes(digits)))
  const current = open && guests.find((g) => g.key === open)

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost" onClick={() => navigate(-1)}>‹ Назад</button>
        <h1>Гости</h1>
      </div>
      <input type="search" placeholder="Поиск по имени или телефону" value={q} onChange={(e) => setQ(e.target.value)} />
      {!list.length && <Empty>Гостей пока нет — они появятся после первых броней</Empty>}
      <div className="cards">
        {list.map((g) => (
          <button key={g.key} className="card prop-card" onClick={() => setOpen(g.key)}>
            <div className="bc-top">
              <b>{g.name || 'Без имени'}</b>
              {g.stays > 1 && <span className="badge live">постоянный</span>}
            </div>
            {g.phone && <div className="muted">{g.phone}</div>}
            <div>
              {g.stays} {plural(g.stays, 'визит', 'визита', 'визитов')}
              {g.nights ? ` · ${nightsLabel(g.nights)}` : ''} · {money(g.paid)}
            </div>
            <small className="muted">последний раз: {fmtDate(g.last)}</small>
          </button>
        ))}
      </div>
      {current && <GuestSheet guest={current} onClose={() => setOpen(null)} />}
    </div>
  )
}

function GuestSheet({ guest, onClose }) {
  const { propertyById } = useData()
  const navigate = useNavigate()
  const wa = whatsappLink(guest.phone)
  const last = guest.bookings[0]

  return (
    <Sheet title={guest.name || 'Гость'} onClose={onClose}>
      <div className="stats">
        <div><small>Визитов</small><b>{guest.stays}</b></div>
        <div><small>Ночей</small><b>{guest.nights}</b></div>
        <div><small>Оплатил всего</small><b>{money(guest.paid)}</b></div>
      </div>
      <div className="btn-row">
        <button className="btn primary" onClick={() => navigate(`/booking/new?from=${last.id}`)}><Icon name="repeat" size={18} /> Повторить бронь</button>
        {wa && <a className="btn whatsapp" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
        {guest.phone && <a className="btn" href={`tel:${guest.phone.replace(/[^\d+]/g, '')}`}>Позвонить</a>}
      </div>
      <h3>История</h3>
      <ul className="list">
        {guest.bookings.map((b) => {
          const p = propertyById.get(b.property_id)
          const n = nightsOf(b)
          return (
            <li key={b.id}>
              <Link to={`/booking/${b.id}`} className="grow">
                <b><Dot color={p?.color} />{p?.name}</b>
                <small>
                  {fmtDate(b.check_in, true)} — {b.check_out ? fmtDate(b.check_out, true) : 'бессрочно'}
                  {n ? ` · ${nightsLabel(n)}` : ''} · {b.mode === 'daily' ? money(b.price_total) : `${money(b.monthly_rate)}/мес`}
                  {b.status === 'cancelled' ? ` · ${statusLabel(b.status)}` : ''}
                </small>
              </Link>
              <button className="btn small" onClick={() => navigate(`/booking/new?from=${b.id}`)}>Повторить</button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
