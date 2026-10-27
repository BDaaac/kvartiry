import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../store'
import { depositInfo } from '../lib/calc'
import { fmtDate, today } from '../lib/dates'
import { money } from '../lib/format'
import { Dot, Empty, Chips } from '../components/ui'
import DepositBox from '../components/DepositBox'

const GROUPS = [
  { id: 'to_return', title: 'Пора вернуть', hint: 'Гость уже выехал — деньги нужно отдать' },
  { id: 'holding', title: 'Держим сейчас', hint: 'Гость ещё живёт или скоро заедет' },
  { id: 'waiting', title: 'Ждём депозит', hint: 'Гость ещё не внёс' },
  { id: 'closed', title: 'История', hint: 'Возвращены или удержаны' },
]

export default function DepositsPage() {
  const { data, propertyById } = useData()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('open')
  const t = today()

  const rows = useMemo(() => data.bookings
    .map((b) => ({ b, d: depositInfo(b, data.payments, t) }))
    .filter((r) => r.d.status !== 'none')
    .sort((a, c) => (a.b.check_out || '9999') < (c.b.check_out || '9999') ? -1 : 1), [data.bookings, data.payments, t])

  const sum = (st, key) => rows.filter((r) => st.includes(r.d.status)).reduce((s, r) => s + r.d[key], 0)
  const held = sum(['holding', 'to_return'], 'held')
  const toReturn = sum(['to_return'], 'held')
  const waiting = rows.filter((r) => r.d.status === 'waiting').reduce((s, r) => s + r.d.expected - r.d.received, 0)
  const kept = sum(['holding', 'to_return', 'closed'], 'kept')

  const groups = GROUPS.filter((g) => filter === 'all' || g.id !== 'closed')

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost" onClick={() => navigate(-1)}>‹ Назад</button>
        <h1>Депозиты</h1>
      </div>

      <section className="hero">
        <small>На руках сейчас (чужие деньги)</small>
        <b>{money(held)}</b>
        <div className="hero-row">
          <span>Вернуть сейчас: {money(toReturn)}</span>
          <span>Ждём от гостей: {money(waiting)}</span>
        </div>
      </section>
      {kept > 0 && <p className="muted small-note">Удержано за всё время: {money(kept)} — учтено в доходе.</p>}

      <Chips value={filter} onChange={setFilter} options={[{ id: 'open', label: 'Открытые' }, { id: 'all', label: 'Все, с историей' }]} />

      {!rows.length && <Empty>Депозитов пока нет. Сумму депозита можно указать в брони.</Empty>}

      {groups.map((g) => {
        const list = rows.filter((r) => r.d.status === g.id)
        if (!list.length) return null
        return (
          <section key={g.id} className={'card' + (g.id === 'to_return' ? ' card-alert' : '')}>
            <div className="group-head">
              <h2>{g.title}</h2>
              <span className="muted">{list.length}</span>
            </div>
            <p className="muted small-note">{g.hint}</p>
            <div className="deposit-list">
              {list.map(({ b }) => {
                const p = propertyById.get(b.property_id)
                return (
                  <div key={b.id} className="deposit-row">
                    <Link to={`/booking/${b.id}`} className="deposit-who">
                      <b>{b.guest_name || 'Гость'}</b>
                      <small><Dot color={p?.color} />{p?.name} · {fmtDate(b.check_in)} — {b.check_out ? fmtDate(b.check_out) : 'бессрочно'}</small>
                    </Link>
                    <DepositBox booking={b} compact />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
