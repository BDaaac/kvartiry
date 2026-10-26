import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../store'
import { addDays, addMonths, diffDays, fmtDate, fmtMonth, monthStart, nextMonthStart, today, toDate, weekday, WEEKDAYS, nightsLabel } from '../lib/dates'
import { isActive, endOf, balance, todayEvents, nightsOf } from '../lib/calc'
import { Dot, Empty } from '../components/ui'

const W = 44 // ширина дня, px

export default function CalendarPage() {
  const { data, activeProperties, propertyById } = useData()
  const navigate = useNavigate()
  const t = today()
  const [month, setMonth] = useState(monthStart(t))
  const scroller = useRef(null)

  // показываем месяц целиком + 3 дня соседних по краям
  const from = addDays(month, -3)
  const to = addDays(nextMonthStart(month), 3)
  const days = useMemo(() => Array.from({ length: diffDays(from, to) }, (_, i) => addDays(from, i)), [from, to])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const idx = t >= from && t < to ? diffDays(from, t) : 3
    el.scrollLeft = Math.max(0, idx * W - 2 * W)
  }, [from, to, t])

  const ev = todayEvents(data.bookings, t)

  if (!activeProperties.length) {
    return (
      <div className="page">
        <h1>Календарь</h1>
        <Empty>
          <p>Сначала добавьте квартиру.</p>
          <Link className="btn primary" to="/properties">+ Добавить квартиру</Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Календарь</h1>
        <Link className="btn primary" to="/booking/new">+ Бронь</Link>
      </div>

      <div className="month-nav">
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Предыдущий месяц">‹</button>
        <strong>{fmtMonth(month)}</strong>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Следующий месяц">›</button>
        {month !== monthStart(t) && <button className="btn small" onClick={() => setMonth(monthStart(t))}>Сегодня</button>}
      </div>

      <div className="board">
        <div className="board-names">
          <div className="board-corner" />
          {activeProperties.map((p) => (
            <div className="board-name" key={p.id} title={p.name}><Dot color={p.color} />{p.name}</div>
          ))}
        </div>
        <div className="board-scroll" ref={scroller}>
          <div style={{ width: days.length * W }}>
            <div className="board-days">
              {days.map((d) => {
                const wd = weekday(d)
                return (
                  <div key={d} style={{ width: W }}
                    className={'day-head' + (wd === 0 || wd === 6 ? ' weekend' : '') + (d === t ? ' today' : '') + (d < month || d >= nextMonthStart(month) ? ' other' : '')}>
                    <b>{toDate(d).getUTCDate()}</b><small>{WEEKDAYS[wd]}</small>
                  </div>
                )
              })}
            </div>
            {activeProperties.map((p) => (
              <Row key={p.id} property={p} days={days} from={from} to={to} t={t}
                bookings={data.bookings} payments={data.payments}
                onEmpty={(d) => navigate(`/booking/new?property=${p.id}&date=${d}`)}
                onOpen={(b) => navigate(`/booking/${b.id}`)} />
            ))}
          </div>
        </div>
      </div>
      <div className="legend">
        <span><i className="lg confirmed" /> подтверждена</span>
        <span><i className="lg pending" /> ждём предоплату</span>
        <span><i className="lg debt" /> есть долг</span>
        <span className="muted">Нажмите на свободный день, чтобы создать бронь</span>
      </div>

      <section className="card">
        <h2>Сегодня, {fmtDate(t)}</h2>
        <EventList title="🔑 Заезд" items={ev.checkIns} propertyById={propertyById} />
        <EventList title="🧹 Выезд и уборка" items={ev.checkOuts} propertyById={propertyById} />
        <EventList title="🏠 Проживают" items={ev.staying} propertyById={propertyById} />
        {!ev.checkIns.length && !ev.checkOuts.length && !ev.staying.length && <p className="muted">Сегодня никого нет.</p>}
      </section>

      {ev.upcoming.length > 0 && (
        <section className="card">
          <h2>Ближайшие 7 дней</h2>
          <EventList items={ev.upcoming} propertyById={propertyById} showDate />
        </section>
      )}
    </div>
  )
}

function Row({ property, days, from, to, t, bookings, payments, onEmpty, onOpen }) {
  const items = bookings.filter((b) => b.property_id === property.id && isActive(b) && b.check_in < to && endOf(b) > from)
  return (
    <div className="board-row">
      {days.map((d) => (
        <button key={d} className={'cell' + (d === t ? ' today' : '') + (weekday(d) % 6 === 0 ? ' weekend' : '')}
          style={{ width: W }} onClick={() => onEmpty(d)} aria-label={`Создать бронь ${fmtDate(d)}`} />
      ))}
      {items.map((b) => {
        // заезд и выезд — в середине дня, чтобы было видно «стык» гостей
        const start = b.check_in < from ? 0 : diffDays(from, b.check_in) * W + W / 2
        const end = endOf(b) >= to ? days.length * W : diffDays(from, b.check_out) * W + W / 2
        const debt = balance(b, payments, t).left > 0 && b.check_in <= t
        const n = nightsOf(b)
        return (
          <button key={b.id} className={`bar ${b.status}${debt ? ' debt' : ''}`}
            style={{ left: start + 1, width: Math.max(end - start - 2, 10), '--c': property.color }}
            onClick={() => onOpen(b)} title={b.guest_name || ''}>
            {b.guest_name || 'Гость'}{n ? ` · ${n}н` : b.mode === 'monthly' ? ' · мес' : ''}
          </button>
        )
      })}
    </div>
  )
}

function EventList({ title, items, propertyById, showDate }) {
  if (!items.length) return null
  return (
    <div className="event-list">
      {title && <h3>{title}</h3>}
      {items.map((b) => {
        const p = propertyById.get(b.property_id)
        const n = nightsOf(b)
        return (
          <Link key={b.id} to={`/booking/${b.id}`} className="event">
            <Dot color={p?.color} />
            <span className="grow">
              <b>{b.guest_name || 'Гость'}</b> · {p?.name}
              <small>{showDate ? `заезд ${fmtDate(b.check_in)}` : `${fmtDate(b.check_in)} — ${b.check_out ? fmtDate(b.check_out) : 'бессрочно'}`}{n ? `, ${nightsLabel(n)}` : ''}</small>
            </span>
            <span className="chev">›</span>
          </Link>
        )
      })}
    </div>
  )
}
