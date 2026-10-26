import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../store'
import { money, PROPERTY_COLORS } from '../lib/format'
import { Field, MoneyInput, Sheet, Dot, Empty } from '../components/ui'
import { EXAMPLE_WELCOME, EXAMPLE_PAID, PLACEHOLDERS } from '../lib/welcome'

export default function PropertiesPage() {
  const { data } = useData()
  const navigate = useNavigate()
  const [edit, setEdit] = useState(null)
  const list = [...data.properties].sort((a, b) => a.archived - b.archived)

  const blank = () => ({
    name: '', address: '', color: PROPERTY_COLORS[data.properties.length % PROPERTY_COLORS.length],
    rate_daily: '', rate_monthly: '', notes: '', archived: false,
  })

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost" onClick={() => navigate(-1)}>‹ Назад</button>
        <h1>Квартиры</h1>
        <button className="btn primary" onClick={() => setEdit(blank())}>+ Добавить</button>
      </div>
      {!list.length && <Empty>Пока нет квартир. Добавьте первую.</Empty>}
      <div className="cards">
        {list.map((p) => (
          <button key={p.id} className={'card prop-card' + (p.archived ? ' archived' : '')} onClick={() => setEdit({ ...p })}>
            <div className="bc-top"><Dot color={p.color} /><b>{p.name}</b>{p.archived && <span className="badge">в архиве</span>}</div>
            {p.address && <div className="muted">{p.address}</div>}
            <div>
              {p.rate_daily ? `${money(p.rate_daily)} / сутки` : ''}
              {p.rate_daily && p.rate_monthly ? ' · ' : ''}
              {p.rate_monthly ? `${money(p.rate_monthly)} / месяц` : ''}
            </div>
          </button>
        ))}
      </div>
      {edit && <PropertyForm value={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function PropertyForm({ value, onClose }) {
  const { save, remove, notify, data } = useData()
  const [f, setF] = useState(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const bookingsCount = f.id ? data.bookings.filter((b) => b.property_id === f.id).length : 0

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await save('properties', {
        id: f.id, name: f.name.trim(), address: f.address || null, color: f.color,
        rate_daily: f.rate_daily === '' ? null : +f.rate_daily,
        rate_monthly: f.rate_monthly === '' ? null : +f.rate_monthly,
        notes: f.notes || null, welcome_message: f.welcome_message || null, paid_message: f.paid_message || null, archived: !!f.archived,
      })
      notify('Сохранено')
      onClose()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    const warn = bookingsCount ? `У квартиры ${bookingsCount} броней — они тоже удалятся. Лучше отправить в архив. ` : ''
    if (!confirm(`${warn}Удалить квартиру «${f.name}» навсегда?`)) return
    await remove('properties', f.id)
    notify('Квартира удалена')
    onClose()
  }

  return (
    <Sheet title={f.id ? 'Квартира' : 'Новая квартира'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Название"><input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Например, Абая 10" required /></Field>
        <Field label="Адрес"><input value={f.address || ''} onChange={(e) => set({ address: e.target.value })} /></Field>
        <div className="grid2">
          <Field label="Цена за сутки"><MoneyInput value={f.rate_daily ?? ''} onChange={(v) => set({ rate_daily: v })} /></Field>
          <Field label="Цена за месяц"><MoneyInput value={f.rate_monthly ?? ''} onChange={(v) => set({ rate_monthly: v })} /></Field>
        </div>
        <Field label="Цвет в календаре">
          <div className="colors">
            {PROPERTY_COLORS.map((c) => (
              <button type="button" key={c} className={'color' + (f.color === c ? ' on' : '')} style={{ background: c }} onClick={() => set({ color: c })} aria-label={c} />
            ))}
          </div>
        </Field>
        <Field label="Заметки" hint="Код домофона, Wi-Fi, где ключи — видно только вам">
          <textarea rows={3} value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <Field label="1. Сообщение после бронирования (WhatsApp)" hint="Адрес, Wi-Fi, правила — без кода доступа">
          <textarea rows={8} value={f.welcome_message || ''} onChange={(e) => set({ welcome_message: e.target.value })}
            placeholder="Адрес, как заселиться, Wi-Fi, правила…" />
        </Field>
        {!f.welcome_message && (
          <button type="button" className="btn small" onClick={() => set({ welcome_message: EXAMPLE_WELCOME })}>Вставить пример</button>
        )}
        <Field label="2. Сообщение после оплаты (WhatsApp)" hint="Код доступа подставится из брони на место {код}">
          <textarea rows={6} value={f.paid_message || ''} onChange={(e) => set({ paid_message: e.target.value })}
            placeholder="Как войти, код доступа {код}…" />
        </Field>
        {!f.paid_message && (
          <button type="button" className="btn small" onClick={() => set({ paid_message: EXAMPLE_PAID })}>Вставить пример</button>
        )}
        <p className="muted small-note">В тексте можно писать: {PLACEHOLDERS.map((p) => `${p.key} — ${p.hint}`).join(', ')}</p>
        {f.id && (
          <label className="check">
            <input type="checkbox" checked={!!f.archived} onChange={(e) => set({ archived: e.target.checked })} /> В архиве (не показывать в календаре)
          </label>
        )}
        {err && <p className="error-text">{err}</p>}
        <button className="btn primary wide" disabled={busy}>Сохранить</button>
        {f.id && <button type="button" className="btn danger wide" onClick={del}>Удалить квартиру</button>}
      </form>
    </Sheet>
  )
}
