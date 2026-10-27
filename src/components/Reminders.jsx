import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../store'
import { getReminders } from '../lib/reminders'
import { today } from '../lib/dates'
import Icon from './Icon'

/** Блок «Напоминания» — что сделать сегодня и в ближайшие дни */
export default function Reminders() {
  const { data, propertyById } = useData()
  const [all, setAll] = useState(false)
  const list = getReminders(data, propertyById, today())
  if (!list.length) return null
  const shown = all ? list : list.slice(0, 4)

  return (
    <section className="card reminders">
      <div className="group-head">
        <h2 className="h-icon"><Icon name="bell" /> Напоминания</h2>
        <span className="badge danger">{list.length}</span>
      </div>
      {shown.map((r) => (
        <Link key={r.id} to={`/booking/${r.booking.id}`} className={`reminder ${r.level}`}>
          <span className="reminder-icon"><Icon name={r.icon} size={18} /></span>
          <span className="grow"><b>{r.title}</b><small>{r.text}</small></span>
          <span className="chev"><Icon name="right" size={18} /></span>
        </Link>
      ))}
      {list.length > 4 && (
        <button type="button" className="btn ghost" onClick={() => setAll(!all)}>{all ? 'Свернуть' : `Ещё ${list.length - 4}`}</button>
      )}
    </section>
  )
}

/** Сколько срочных напоминаний — для значка на вкладке */
export function useUrgentCount() {
  const { data, propertyById } = useData()
  return getReminders(data, propertyById, today()).filter((r) => r.level === 'urgent').length
}
