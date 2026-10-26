import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../store'
import { supabase, isDemo, demoReset, calendarFeedUrl } from '../lib/db'
import { addDays, addMonths, monthStart, today, yearStart } from '../lib/dates'
import { exportExcel } from '../lib/export'
import { Field, PropertySelect } from '../components/ui'
import Icon from '../components/Icon'

const QUICK = [
  { label: 'Этот месяц', range: () => ({ from: monthStart(today()), to: today() }) },
  { label: 'Прошлый месяц', range: () => { const m = addMonths(monthStart(today()), -1); return { from: m, to: addDays(monthStart(today()), -1) } } },
  { label: 'Этот год', range: () => ({ from: yearStart(today()), to: today() }) },
  { label: 'Прошлый год', range: () => { const y = +today().slice(0, 4) - 1; return { from: `${y}-01-01`, to: `${y}-12-31` } } },
]

export default function MorePage() {
  const { data, activeProperties, propertyById, reload, notify } = useData()
  const [feed, setFeed] = useState(null)
  const [feedErr, setFeedErr] = useState(null)
  const t = today()
  const [range, setRange] = useState({ from: monthStart(t), to: t })
  const [pid, setPid] = useState(null)

  async function showFeed() {
    setFeedErr(null)
    try { setFeed(await calendarFeedUrl()) } catch (e) { setFeedErr(e.message) }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); notify('Ссылка скопирована') } catch { notify('Скопируйте ссылку вручную', 'err') }
  }

  function download() {
    const ids = pid ? [pid] : data.properties.map((p) => p.id)
    const name = pid ? ` ${propertyById.get(pid)?.name}` : ''
    exportExcel(data, range.from, addDays(range.to, 1), ids, `${range.from} — ${range.to}${name}`)
  }

  return (
    <div className="page">
      <h1>Ещё</h1>

      <Link to="/properties" className="card menu-item">
        <span className="icon-chip"><Icon name="home" /></span>
        <span className="grow"><b>Квартиры</b><small>{activeProperties.length} активн. · цены, сообщения гостям</small></span>
        <span className="chev">›</span>
      </Link>

      <Link to="/guests" className="card menu-item">
        <span className="icon-chip coral"><Icon name="users" /></span>
        <span className="grow"><b>Гости</b><small>история, постоянные гости, повтор брони</small></span>
        <span className="chev">›</span>
      </Link>

      <section className="card form">
        <h2 className="h-icon"><Icon name="download" /> Выгрузка в Excel</h2>
        <p className="muted">Брони, платежи, расходы и итоги за выбранный период.</p>
        <div className="chips">
          {QUICK.map((q) => (
            <button type="button" key={q.label} className="chip" onClick={() => setRange(q.range())}>{q.label}</button>
          ))}
        </div>
        <div className="grid2">
          <Field label="С"><input type="date" value={range.from} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="По"><input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} /></Field>
        </div>
        {data.properties.length > 1 && (
          <Field label="Квартира"><PropertySelect properties={data.properties} value={pid} onChange={setPid} allowAll /></Field>
        )}
        <button className="btn primary wide" onClick={download}>Скачать Excel</button>
      </section>

      <section className="card">
        <h2 className="h-icon"><Icon name="calendar" /> Календарь на iPhone</h2>
        <p className="muted">Все заезды, выезды и даты оплаты будут сами появляться в стандартном «Календаре» iPhone.</p>
        {isDemo ? (
          <p className="muted">Доступно после подключения Supabase.</p>
        ) : feed ? (
          <>
            <a className="btn primary wide" href={feed}>Подписаться в Календаре</a>
            <button className="btn wide" onClick={() => copy(feed)}>Скопировать ссылку</button>
            <ol className="steps">
              <li>Нажмите «Подписаться в Календаре» и подтвердите.</li>
              <li>Если не открылось: Настройки → Календарь → Учётные записи → Добавить → Другое → Подписной календарь, вставьте ссылку.</li>
              <li>Календарь обновляется сам (обычно раз в час).</li>
            </ol>
          </>
        ) : (
          <button className="btn primary wide" onClick={showFeed}>Получить ссылку</button>
        )}
        {feedErr && <p className="error-text">{feedErr}</p>}
      </section>

      {isDemo ? (
        <button className="btn wide" onClick={() => { if (confirm('Вернуть демо-данные к началу?')) { demoReset(); reload() } }}>Сбросить демо-данные</button>
      ) : (
        <button className="btn wide" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} /> Выйти</button>
      )}
    </div>
  )
}
