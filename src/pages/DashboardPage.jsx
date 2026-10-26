import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useData } from '../store'
import { addDays, addMonths, fmtDate, fmtMonth, fmtMonthShort, monthStart, nextMonthStart, today, yearStart } from '../lib/dates'
import { analyze, monthlySeries, debts } from '../lib/calc'
import { money, moneyShort, pct, sourceLabel } from '../lib/format'
import { exportExcel } from '../lib/export'
import { Chips, Dot, PropertySelect } from '../components/ui'

const C_INCOME = '#2a78d6'
const C_EXPENSE = '#eb6834'
const C_INK = '#1f2933'

const PERIODS = [
  { id: 'month', label: 'Этот месяц' },
  { id: 'prev', label: 'Прошлый месяц' },
  { id: 'year', label: 'Этот год' },
  { id: 'lastyear', label: 'Прошлый год' },
  { id: 'custom', label: 'Свой период' },
]

function range(id, custom) {
  const t = today()
  switch (id) {
    case 'month': return [monthStart(t), nextMonthStart(t), fmtMonth(t)]
    case 'prev': { const m = addMonths(monthStart(t), -1); return [m, monthStart(t), fmtMonth(m)] }
    case 'year': return [yearStart(t), `${+t.slice(0, 4) + 1}-01-01`, `${t.slice(0, 4)} год`]
    case 'lastyear': { const y = +t.slice(0, 4) - 1; return [`${y}-01-01`, `${y + 1}-01-01`, `${y} год`] }
    default: return [custom.from, addDays(custom.to, 1), `${fmtDate(custom.from, true)} — ${fmtDate(custom.to, true)}`]
  }
}

export default function DashboardPage() {
  const { data, activeProperties, propertyById } = useData()
  const t = today()
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState({ from: monthStart(t), to: t })
  const [pid, setPid] = useState(null)

  const [from, to, title] = range(period, custom)
  const ids = useMemo(() => (pid ? [pid] : data.properties.map((p) => p.id)), [pid, data.properties])
  const a = useMemo(() => analyze(data, from, to, ids), [data, from, to, ids])
  const isLong = period === 'year' || period === 'lastyear'
  const seriesEnd = isLong ? addDays(to, -1) : t
  const series = useMemo(
    () => monthlySeries(data, seriesEnd, 12, ids).map((m) => ({ ...m, label: fmtMonthShort(m.month), occ: Math.round(m.occupancy * 100) })),
    [data, seriesEnd, ids],
  )
  const owed = useMemo(() => debts(data.bookings, data.payments, ids, t), [data, ids, t])
  const owedNow = owed.filter((d) => d.overdue)
  const owedLater = owed.filter((d) => !d.overdue)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Деньги</h1>
        <button className="btn" onClick={() => exportExcel(data, from, to, ids, title)}>⬇ Excel</button>
      </div>

      <Chips value={period} onChange={setPeriod} options={PERIODS} />
      <div className="toolbar">
        {period === 'custom' && (
          <>
            <input type="date" value={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} aria-label="С" />
            <input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} aria-label="По" />
          </>
        )}
        {data.properties.length > 1 && <PropertySelect properties={data.properties} value={pid} onChange={setPid} allowAll />}
      </div>

      <p className="period-title">{title}{pid ? ` · ${propertyById.get(pid)?.name}` : ''}</p>

      <div className="kpis">
        <Kpi label="Получено" value={money(a.income)} />
        <Kpi label="Расходы" value={money(a.expenses)} />
        <Kpi label="Прибыль" value={money(a.profit)} tone={a.profit < 0 ? 'neg' : 'pos'} />
        <Kpi label="Загрузка" value={pct(a.occupancy)} sub={`${a.nights} ноч. из ${a.days * (pid ? 1 : Math.max(1, data.properties.length))}`} />
        <Kpi label="Средняя цена за ночь" value={money(a.adr)} sub="посуточные брони" />
        <Kpi label="Долги гостей" value={money(owedNow.reduce((s, d) => s + d.left, 0))} tone={owedNow.length ? 'neg' : ''} sub={owedNow.length ? `${owedNow.length} брон.` : 'нет'} />
      </div>

      <section className="card">
        <h2>Доходы и расходы по месяцам</h2>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={series} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="#e8eaed" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#d1d5db' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={56} />
              <Tooltip formatter={(v, n) => [money(v), n]} labelFormatter={(_, p) => (p?.[0] ? fmtMonth(p[0].payload.month) : '')} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Получено" fill={C_INCOME} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="expenses" name="Расходы" fill={C_EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line dataKey="profit" name="Прибыль" stroke={C_INK} strokeWidth={2} dot={{ r: 3, fill: C_INK }} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h2>Загрузка по месяцам, %</h2>
        <div className="chart">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={series} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e8eaed" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#d1d5db' }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={56} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, 'Загрузка']} labelFormatter={(_, p) => (p?.[0] ? fmtMonth(p[0].payload.month) : '')} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="occ" name="Загрузка" fill={C_INCOME} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {!pid && a.rows.length > 1 && (
        <section className="card">
          <h2>По квартирам</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Квартира</th><th>Получено</th><th>Расходы</th><th>Прибыль</th><th>Загрузка</th><th>Цена/ночь</th></tr></thead>
              <tbody>
                {a.rows.map((r) => (
                  <tr key={r.property.id}>
                    <td><Dot color={r.property.color} />{r.property.name}</td>
                    <td>{money(r.income)}</td>
                    <td>{money(r.expenses)}</td>
                    <td className={r.profit < 0 ? 'neg' : ''}>{money(r.profit)}</td>
                    <td>{pct(r.occupancy)}</td>
                    <td>{r.adr ? money(r.adr) : '—'}</td>
                  </tr>
                ))}
                {a.commonExpenses > 0 && (
                  <tr className="muted"><td>Общие расходы</td><td>—</td><td>{money(a.commonExpenses)}</td><td>−{money(a.commonExpenses)}</td><td /><td /></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="two-col">
        {a.sources.length > 0 && (
          <section className="card">
            <h2>Откуда гости</h2>
            <ul className="bars-list">
              {a.sources.map((s) => (
                <li key={s.source}>
                  <span className="grow">{sourceLabel(s.source)} <small className="muted">· {s.bookings} брон., {s.nights} ноч.</small></span>
                  <b>{money(s.accrued)}</b>
                  <i style={{ width: `${(s.accrued / (a.sources[0].accrued || 1)) * 100}%` }} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {a.categories.length > 0 && (
          <section className="card">
            <h2>На что ушли деньги</h2>
            <ul className="bars-list exp">
              {a.categories.map((c) => (
                <li key={c.category}>
                  <span className="grow">{c.category}</span>
                  <b>{money(c.amount)}</b>
                  <i style={{ width: `${(c.amount / (a.categories[0].amount || 1)) * 100}%` }} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section className="card">
        <h2>Кто должен</h2>
        {!owed.length && <p className="muted">Все оплатили 👍</p>}
        {owedNow.length > 0 && <DebtList title="Уже заехали — нужно получить" items={owedNow} propertyById={propertyById} />}
        {owedLater.length > 0 && <DebtList title="Будущие брони — доплата при заезде" items={owedLater} propertyById={propertyById} />}
      </section>

      <p className="muted small-note">
        «Получено» — деньги, которые пришли за период (без залогов). Загрузка и цена за ночь считаются по ночам, попавшим в период.
        {!activeProperties.length && ' Добавьте квартиру, чтобы начать.'}
      </p>
    </div>
  )
}

function Kpi({ label, value, sub, tone = '' }) {
  return (
    <div className="kpi">
      <small>{label}</small>
      <b className={tone}>{value}</b>
      {sub && <span className="muted">{sub}</span>}
    </div>
  )
}

function DebtList({ title, items, propertyById }) {
  return (
    <div className="event-list">
      <h3>{title}</h3>
      {items.map((d) => {
        const p = propertyById.get(d.booking.property_id)
        return (
          <Link key={d.booking.id} to={`/booking/${d.booking.id}`} className="event">
            <Dot color={p?.color} />
            <span className="grow">
              <b>{d.booking.guest_name || 'Гость'}</b> · {p?.name}
              <small>заезд {fmtDate(d.booking.check_in)} · оплачено {money(d.paid)} из {money(d.due)}</small>
            </span>
            <b className="neg">{money(d.left)}</b>
          </Link>
        )
      })}
    </div>
  )
}
