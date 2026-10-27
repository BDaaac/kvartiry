import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../store'
import { addDays, addMonths, diffDays, fmtDate, fmtMonth, monthStart, nextMonthStart, today, toDate, weekday, WEEKDAYS, nightsLabel, maxStr, minStr } from '../lib/dates'
import { isActive, endOf, balance, nightsOf } from '../lib/calc'
import { Dot, Empty, Segmented } from '../components/ui'
import Icon from '../components/Icon'

const W = 52 // ширина дня в шахматке, px
const WEEK_HEAD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const VIEWS = [{ id: 'month', label: 'Месяц' }, { id: 'board', label: 'Шахматка' }]

function loadView() {
  try { return localStorage.getItem('rentiq-calendar-view') || 'month' } catch { return 'month' }
}

export default function CalendarPage() {
  const { data, activeProperties, propertyById } = useData()
  const navigate = useNavigate()
  const t = today()
  const [month, setMonth] = useState(monthStart(t))
  const [view, setViewState] = useState(loadView)
  const [pid, setPid] = useState(null)
  const [sel, setSel] = useState(t)

  const setView = (v) => {
    setViewState(v)
    try { localStorage.setItem('rentiq-calendar-view', v) } catch { /* ignore */ }
  }
  const shiftMonth = (n) => {
    const m = addMonths(month, n)
    setMonth(m)
    setSel(m === monthStart(t) ? t : m)
  }

  const props = pid ? activeProperties.filter((p) => p.id === pid) : activeProperties
  const propIds = new Set(props.map((p) => p.id))
  const bookings = data.bookings.filter((b) => isActive(b) && propIds.has(b.property_id))
  const newBooking = (d, propertyId = pid) => navigate(`/booking/new?date=${d}${propertyId ? `&property=${propertyId}` : ''}`)

  if (!activeProperties.length) {
    return (
      <div className="page">
        <h1>Календарь</h1>
        <Empty>
          <p>Сначала добавьте квартиру.</p>
          <Link className="btn primary" to="/properties"><Icon name="plus" size={18} /> Добавить квартиру</Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Календарь</h1>
        <Link className="btn primary" to="/booking/new"><Icon name="plus" size={18} /> Бронь</Link>
      </div>

      <Segmented value={view} onChange={setView} options={VIEWS} />

      {activeProperties.length > 1 && (
        <div className="chips">
          <button type="button" className={'chip' + (!pid ? ' on' : '')} onClick={() => setPid(null)}>Все квартиры</button>
          {activeProperties.map((p) => (
            <button type="button" key={p.id} className={'chip' + (pid === p.id ? ' on' : '')} onClick={() => setPid(p.id)}>
              <Dot color={p.color} />{p.name}
            </button>
          ))}
        </div>
      )}

      <div className="month-nav">
        <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><Icon name="left" /></button>
        <strong>{fmtMonth(month)}</strong>
        <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><Icon name="right" /></button>
        {month !== monthStart(t) && <button className="btn small" onClick={() => { setMonth(monthStart(t)); setSel(t) }}>Сегодня</button>}
      </div>

      {view === 'month' ? (
        <>
          <MonthGrid month={month} t={t} sel={sel} onSelect={setSel} bookings={bookings}
            payments={data.payments} propertyById={propertyById} onOpen={(b) => navigate(`/booking/${b.id}`)} />
          <DayPanel day={sel} t={t} bookings={bookings} propertyById={propertyById} onNew={() => newBooking(sel)} />
        </>
      ) : (
        <>
          <Board month={month} t={t} properties={props} bookings={bookings} payments={data.payments}
            onEmpty={(p, d) => newBooking(d, p.id)} onOpen={(b) => navigate(`/booking/${b.id}`)} />
          <p className="muted small-note">Нажмите на свободный день, чтобы создать бронь</p>
          <DayPanel day={t} t={t} bookings={bookings} propertyById={propertyById} onNew={() => newBooking(t)} />
        </>
      )}

      <div className="legend">
        <span><i className="lg confirmed" /> подтверждена</span>
        <span><i className="lg pending" /> ждём предоплату</span>
        <span><i className="lg debt" /> есть долг</span>
      </div>
    </div>
  )
}

// ---------- Месяц, как в «Календаре» iPhone ----------
function MonthGrid({ month, t, sel, onSelect, bookings, payments, propertyById, onOpen }) {
  const weeks = useMemo(() => {
    const first = addDays(month, -((weekday(month) + 6) % 7)) // понедельник
    const last = nextMonthStart(month)
    const out = []
    for (let ws = first; ws < last; ws = addDays(ws, 7)) out.push(ws)
    return out
  }, [month])

  return (
    <div className="mcal">
      <div className="mcal-head">
        {WEEK_HEAD.map((d, i) => <span key={d} className={i >= 5 ? 'weekend' : ''}>{d}</span>)}
      </div>
      {weeks.map((ws) => (
        <Week key={ws} ws={ws} month={month} t={t} sel={sel} onSelect={onSelect}
          bookings={bookings} payments={payments} propertyById={propertyById} onOpen={onOpen} />
      ))}
    </div>
  )
}

function Week({ ws, month, t, sel, onSelect, bookings, payments, propertyById, onOpen }) {
  const we = addDays(ws, 7)
  // отрезки броней внутри недели, разложенные по «дорожкам», чтобы не накладывались
  const segs = bookings
    .filter((b) => b.check_in < we && endOf(b) > ws)
    .map((b) => {
      const s = maxStr(b.check_in, ws)
      const e = minStr(endOf(b), we)
      return { b, col: diffDays(ws, s), span: Math.max(1, diffDays(s, e)), cutL: b.check_in < ws, cutR: endOf(b) > we }
    })
    .sort((a, c) => a.col - c.col || c.span - a.span)
  const lanes = []
  for (const sg of segs) {
    let lane = lanes.findIndex((end) => end <= sg.col)
    if (lane === -1) { lane = lanes.length; lanes.push(0) }
    lanes[lane] = sg.col + sg.span
    sg.lane = lane
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))

  return (
    <div className="mweek" style={{ minHeight: Math.max(92, 34 + lanes.length * 24 + 6) }}>
      {days.map((d, i) => (
        <button key={d} type="button" onClick={() => onSelect(d)}
          className={'mday' + (d === t ? ' today' : '') + (d === sel ? ' sel' : '') + (d < month || d >= nextMonthStart(month) ? ' other' : '') + (i >= 5 ? ' weekend' : '')}>
          <span className="mnum">{toDate(d).getUTCDate()}</span>
        </button>
      ))}
      {segs.map(({ b, col, span, lane, cutL, cutR }) => {
        const p = propertyById.get(b.property_id)
        const debt = b.check_in <= t && balance(b, payments, t).left > 0
        return (
          <button key={b.id} type="button" onClick={() => onOpen(b)} title={`${b.guest_name || 'Гость'} · ${p?.name || ''}`}
            className={`mbar ${b.status}${debt ? ' debt' : ''}${cutL ? ' cut-l' : ''}${cutR ? ' cut-r' : ''}`}
            style={{ left: `calc(${(col / 7) * 100}% + 2px)`, width: `calc(${(span / 7) * 100}% - 4px)`, top: 34 + lane * 24, '--c': p?.color }}>
            {b.guest_name || 'Гость'}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Что происходит в выбранный день ----------
function DayPanel({ day, t, bookings, propertyById, onNew }) {
  const checkIns = bookings.filter((b) => b.check_in === day)
  const checkOuts = bookings.filter((b) => b.check_out === day)
  const staying = bookings.filter((b) => b.check_in < day && endOf(b) > day)
  const empty = !checkIns.length && !checkOuts.length && !staying.length
  const wd = WEEKDAYS[weekday(day)]

  return (
    <section className="card">
      <div className="group-head">
        <h2>{day === t ? 'Сегодня, ' : ''}{fmtDate(day)}, {wd}</h2>
        <button className="btn small primary" onClick={onNew}><Icon name="plus" size={16} /> Бронь</button>
      </div>
      <EventList title="Заезд" items={checkIns} propertyById={propertyById} />
      <EventList title="Выезд и уборка" items={checkOuts} propertyById={propertyById} />
      <EventList title="Проживают" items={staying} propertyById={propertyById} />
      {empty && <p className="muted">Свободно — ни заездов, ни гостей.</p>}
    </section>
  )
}

function EventList({ title, items, propertyById }) {
  if (!items.length) return null
  return (
    <div className="event-list">
      <h3>{title}</h3>
      {items.map((b) => {
        const p = propertyById.get(b.property_id)
        const n = nightsOf(b)
        return (
          <Link key={b.id} to={`/booking/${b.id}`} className="event">
            <Dot color={p?.color} />
            <span className="grow">
              <b>{b.guest_name || 'Гость'}</b> · {p?.name}
              <small>{fmtDate(b.check_in)} — {b.check_out ? fmtDate(b.check_out) : 'бессрочно'}{n ? `, ${nightsLabel(n)}` : ''}</small>
            </span>
            <span className="chev"><Icon name="right" size={18} /></span>
          </Link>
        )
      })}
    </div>
  )
}

// ---------- Шахматка: квартиры × дни ----------
function Board({ month, t, properties, bookings, payments, onEmpty, onOpen }) {
  const scroller = useRef(null)
  const from = addDays(month, -3)
  const to = addDays(nextMonthStart(month), 3)
  const days = useMemo(() => Array.from({ length: diffDays(from, to) }, (_, i) => addDays(from, i)), [from, to])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const idx = t >= from && t < to ? diffDays(from, t) : 3
    el.scrollLeft = Math.max(0, idx * W - W)
  }, [from, to, t])

  return (
    <div className="board">
      <div className="board-names">
        <div className="board-corner" />
        {properties.map((p) => (
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
          {properties.map((p) => (
            <BoardRow key={p.id} property={p} days={days} from={from} to={to} t={t}
              bookings={bookings} payments={payments} onEmpty={(d) => onEmpty(p, d)} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BoardRow({ property, days, from, to, t, bookings, payments, onEmpty, onOpen }) {
  const items = bookings.filter((b) => b.property_id === property.id && b.check_in < to && endOf(b) > from)
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
