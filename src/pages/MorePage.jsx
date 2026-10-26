import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../store'
import { supabase, isDemo, demoReset, calendarFeedUrl } from '../lib/db'
import { today, yearStart } from '../lib/dates'
import { exportExcel } from '../lib/export'

export default function MorePage() {
  const { data, activeProperties, reload, notify } = useData()
  const [feed, setFeed] = useState(null)
  const [feedErr, setFeedErr] = useState(null)

  async function showFeed() {
    setFeedErr(null)
    try { setFeed(await calendarFeedUrl()) } catch (e) { setFeedErr(e.message) }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); notify('Ссылка скопирована') } catch { notify('Скопируйте ссылку вручную', 'err') }
  }

  const t = today()
  const nextYear = `${+t.slice(0, 4) + 1}-01-01`

  return (
    <div className="page">
      <h1>Ещё</h1>

      <Link to="/properties" className="card menu-item">
        <span className="grow"><b>🏠 Квартиры</b><small>{activeProperties.length} активн. · добавить, изменить цены</small></span>
        <span className="chev">›</span>
      </Link>

      <section className="card">
        <h2>📅 Календарь на iPhone</h2>
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

      <section className="card">
        <h2>⬇ Выгрузка в Excel</h2>
        <p className="muted">Брони, платежи, расходы и итоги. Любой период можно выбрать во вкладке «Деньги».</p>
        <div className="btn-row">
          <button className="btn" onClick={() => exportExcel(data, yearStart(t), nextYear, data.properties.map((p) => p.id), `${t.slice(0, 4)} год`)}>За {t.slice(0, 4)} год</button>
          <button className="btn" onClick={() => exportExcel(data, '2000-01-01', nextYear, data.properties.map((p) => p.id), 'всё время')}>За всё время</button>
        </div>
      </section>

      {isDemo ? (
        <button className="btn wide" onClick={() => { if (confirm('Вернуть демо-данные к началу?')) { demoReset(); reload() } }}>Сбросить демо-данные</button>
      ) : (
        <button className="btn wide" onClick={() => supabase.auth.signOut()}>Выйти</button>
      )}
    </div>
  )
}
