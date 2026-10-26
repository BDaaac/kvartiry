import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../store'
import { addDays, addMonths, diffDays, fmtDate, today, nightsLabel, plural } from '../lib/dates'
import { balance, depositHeld, findOverlap, monthlyPeriods, contractTotal, nightsOf, isActive } from '../lib/calc'
import { normPhone } from '../lib/guests'
import { money, whatsappLink, SOURCES, METHODS, PAYMENT_KINDS, STATUSES, kindLabel, methodLabel } from '../lib/format'
import { Field, MoneyInput, Segmented, Chips, PropertySelect } from '../components/ui'
import { fillMessage } from '../lib/welcome'
import Icon from '../components/Icon'

// key по id: при переходе «новая → сохранённая» форма создаётся заново
export default function BookingRoute() {
  const { id } = useParams()
  const [params] = useSearchParams()
  useEffect(() => { window.scrollTo(0, 0) }, [id])
  return <BookingPage key={id + params.toString()} />
}

function BookingPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data, activeProperties, propertyById, save, remove, notify } = useData()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const existing = isNew ? null : data.bookings.find((b) => b.id === id)

  const initial = useMemo(() => {
    if (existing) return { ...existing }
    const ci = params.get('date') || today()
    // «Повторить бронь»: копируем гостя, квартиру и цену с прошлой брони, даты — новые
    const prev = params.get('from') && data.bookings.find((b) => b.id === params.get('from'))
    if (prev) {
      const n = nightsOf(prev)
      const pid = activeProperties.some((p) => p.id === prev.property_id) ? prev.property_id : activeProperties[0]?.id
      return {
        property_id: pid, mode: prev.mode, check_in: ci,
        check_out: prev.mode === 'daily' ? addDays(ci, n || 1) : addMonths(ci, 1),
        guest_name: prev.guest_name || '', guest_phone: prev.guest_phone || '', guests_count: prev.guests_count ?? '',
        price_total: prev.price_total ?? '', monthly_rate: prev.monthly_rate ?? '', deposit: prev.deposit || 0,
        source: 'repeat', status: 'confirmed', notes: '',
      }
    }
    const pid = params.get('property') || activeProperties[0]?.id
    const p = propertyById.get(pid)
    return {
      property_id: pid, mode: 'daily', check_in: ci, check_out: addDays(ci, 1),
      guest_name: '', guest_phone: '', guests_count: '', price_total: p?.rate_daily || '',
      monthly_rate: p?.rate_monthly || '', deposit: 0, source: 'krisha', status: 'confirmed', notes: '',
    }
  }, [existing, params, activeProperties, propertyById, data.bookings])

  const [f, setF] = useState(initial)
  const [prepay, setPrepay] = useState({ amount: '', method: 'kaspi' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [focus, setFocus] = useState(params.get('welcome') === '1' ? 'booked' : null)

  if (!isNew && !existing) {
    return <div className="page"><p>Бронь не найдена.</p><button className="btn" onClick={() => navigate(-1)}>Назад</button></div>
  }

  const set = (patch) => setF((x) => ({ ...x, ...patch }))

  // прошлые брони этого же номера — подсказка «постоянный гость» и автоподстановка имени
  const phoneKey = normPhone(f.guest_phone)
  const regular = phoneKey.length >= 11
    ? data.bookings.filter((b) => b.id !== f.id && isActive(b) && normPhone(b.guest_phone) === phoneKey).sort((a, b) => (a.check_in < b.check_in ? 1 : -1))
    : []
  const setPhone = (phone) => {
    const k = normPhone(phone)
    const prev = !f.guest_name && k.length >= 11 && data.bookings.find((b) => normPhone(b.guest_phone) === k && b.guest_name)
    set({ guest_phone: phone, ...(prev ? { guest_name: prev.guest_name } : {}) })
  }
  const nights = f.check_out ? diffDays(f.check_in, f.check_out) : 0
  const property = propertyById.get(f.property_id)

  // Цена за ночь ↔ итого: меняем одно — пересчитываем другое
  const rate = nights > 0 && f.price_total !== '' ? Math.round(f.price_total / nights) : ''
  const setNights = (n) => {
    const out = addDays(f.check_in, Math.max(1, n))
    const r = rate || property?.rate_daily || 0
    set({ check_out: out, price_total: r ? r * Math.max(1, n) : f.price_total })
  }
  const setCheckIn = (ci) => {
    const n = f.mode === 'daily' && nights > 0 ? nights : null
    set({ check_in: ci, ...(n ? { check_out: addDays(ci, n) } : {}) })
  }
  const setCheckOut = (co) => {
    const n = co ? diffDays(f.check_in, co) : 0
    set({ check_out: co || null, ...(f.mode === 'daily' && rate && n > 0 ? { price_total: rate * n } : {}) })
  }
  const setMode = (mode) => {
    if (mode === f.mode) return
    if (mode === 'monthly') set({ mode, check_out: addMonths(f.check_in, 1), monthly_rate: f.monthly_rate || property?.rate_monthly || '' })
    else set({ mode, check_out: f.check_out || addDays(f.check_in, 1), price_total: f.price_total || property?.rate_daily || '' })
  }
  const setProperty = (pid) => {
    const p = propertyById.get(pid)
    set({
      property_id: pid,
      ...(isNew && f.mode === 'daily' && p?.rate_daily ? { price_total: p.rate_daily * Math.max(1, nights) } : {}),
      ...(isNew && f.mode === 'monthly' && p?.rate_monthly ? { monthly_rate: p.rate_monthly } : {}),
    })
  }

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    if (!f.property_id) return setErr('Выберите квартиру')
    if (f.mode === 'daily' && !(nights > 0)) return setErr('Дата выезда должна быть позже заезда')
    if (f.mode === 'monthly' && f.check_out && f.check_out <= f.check_in) return setErr('Дата выезда должна быть позже заезда')
    const clash = f.status !== 'cancelled' && findOverlap(data.bookings, f)
    if (clash) return setErr(`Даты пересекаются с бронью: ${clash.guest_name || 'гость'}, ${fmtDate(clash.check_in)} — ${clash.check_out ? fmtDate(clash.check_out) : 'бессрочно'}`)

    const row = {
      id: f.id, property_id: f.property_id, mode: f.mode, check_in: f.check_in,
      check_out: f.check_out || null,
      guest_name: f.guest_name?.trim() || null, guest_phone: f.guest_phone?.trim() || null,
      guests_count: f.guests_count === '' ? null : +f.guests_count,
      price_total: f.mode === 'daily' ? +f.price_total || 0 : null,
      monthly_rate: f.mode === 'monthly' ? +f.monthly_rate || 0 : null,
      deposit: +f.deposit || 0, source: f.source, status: f.status, notes: f.notes || null,
      access_code: f.access_code || null,
    }
    setBusy(true)
    try {
      const saved = await save('bookings', row)
      if (isNew && +prepay.amount > 0) {
        await save('payments', { booking_id: saved.id, amount: +prepay.amount, paid_at: today(), method: prepay.method, kind: 'payment', note: 'Предоплата' })
      }
      notify(isNew ? 'Бронь создана' : 'Сохранено')
      if (isNew) navigate(`/booking/${saved.id}${row.guest_phone ? '?welcome=1' : ''}`, { replace: true })
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  // код доступа сохраняется сразу, без кнопки «Сохранить» у формы
  async function saveCode(code) {
    set({ access_code: code })
    try { await save('bookings', { id: existing.id, access_code: code || null }) } catch (e2) { notify(e2.message, 'err') }
  }

  async function del() {
    if (!confirm('Удалить бронь вместе с её платежами? Это нельзя отменить.')) return
    await remove('bookings', existing.id)
    notify('Бронь удалена')
    navigate(-1)
  }

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost" onClick={() => navigate(-1)}>‹ Назад</button>
        <h1>{isNew ? 'Новая бронь' : f.guest_name || 'Бронь'}</h1>
      </div>

      {existing && <Messages booking={existing} property={property} focus={focus} code={f.access_code} onCode={saveCode} />}

      <form className="card form" onSubmit={submit}>
        <Segmented value={f.mode} onChange={setMode} options={[{ id: 'daily', label: 'Посуточно' }, { id: 'monthly', label: 'Помесячно' }]} />

        <Field label="Квартира">
          <PropertySelect properties={activeProperties.concat(property && property.archived ? [property] : [])} value={f.property_id} onChange={setProperty} />
        </Field>

        <div className="grid2">
          <Field label="Заезд"><input type="date" value={f.check_in} onChange={(e) => e.target.value && setCheckIn(e.target.value)} required /></Field>
          <Field label={f.mode === 'monthly' ? 'Выезд (можно пусто)' : 'Выезд'}>
            <input type="date" value={f.check_out || ''} min={addDays(f.check_in, 1)} onChange={(e) => setCheckOut(e.target.value)} required={f.mode === 'daily'} />
          </Field>
        </div>

        {f.mode === 'daily' ? (
          <>
            <div className="nights">
              <button type="button" className="icon-btn" onClick={() => setNights(nights - 1)} disabled={nights <= 1}>−</button>
              <b>{nights > 0 ? nightsLabel(nights) : '—'}</b>
              <button type="button" className="icon-btn" onClick={() => setNights(nights + 1)}>+</button>
            </div>
            <div className="grid2">
              <Field label="Цена за ночь">
                <MoneyInput value={rate} onChange={(v) => set({ price_total: v === '' ? '' : v * Math.max(1, nights) })} />
              </Field>
              <Field label="Итого за проживание">
                <MoneyInput value={f.price_total} onChange={(v) => set({ price_total: v })} />
              </Field>
            </div>
          </>
        ) : (
          <Field label="Сумма в месяц" hint="Оплата считается по месяцам от даты заезда">
            <MoneyInput value={f.monthly_rate} onChange={(v) => set({ monthly_rate: v })} />
          </Field>
        )}

        <div className="grid2">
          <Field label="Имя гостя"><input value={f.guest_name || ''} onChange={(e) => set({ guest_name: e.target.value })} placeholder="Например, Айгерим" /></Field>
          <Field label="Телефон"><input type="tel" inputMode="tel" value={f.guest_phone || ''} onChange={(e) => setPhone(e.target.value)} placeholder="8 707 123 45 67" /></Field>
        </div>
        {regular.length > 0 && (
          <p className="regular-hint">🔁 Постоянный гость: уже {regular.length} {plural(regular.length, 'раз', 'раза', 'раз')}, последний — {fmtDate(regular[0].check_in, true)}</p>
        )}
        <div className="grid2">
          <Field label="Сколько человек"><input inputMode="numeric" value={f.guests_count ?? ''} onChange={(e) => set({ guests_count: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Залог"><MoneyInput value={f.deposit} onChange={(v) => set({ deposit: v })} /></Field>
        </div>

        <Field label="Откуда гость"><Chips value={f.source} onChange={(v) => set({ source: v })} options={SOURCES} /></Field>
        <Field label="Статус"><Chips value={f.status} onChange={(v) => set({ status: v })} options={STATUSES} /></Field>

        {isNew && (
          <div className="grid2">
            <Field label="Предоплата (если уже есть)"><MoneyInput value={prepay.amount} onChange={(v) => setPrepay({ ...prepay, amount: v })} /></Field>
            <Field label="Способ">
              <select value={prepay.method} onChange={(e) => setPrepay({ ...prepay, method: e.target.value })}>
                {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          </div>
        )}

        <Field label="Заметки"><textarea rows={2} value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>

        {err && <p className="error-text">{err}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Сохранение…' : isNew ? 'Создать бронь' : 'Сохранить'}</button>
      </form>

      {existing && <Payments booking={existing} property={property} onPaid={() => { setFocus('paid'); window.scrollTo(0, 0) }} />}

      {existing && (
        <>
          <button className="btn wide" onClick={() => navigate(`/booking/new?from=${existing.id}`)}><Icon name="repeat" size={18} /> Повторить бронь для этого гостя</button>
          <button className="btn danger wide" onClick={del}>Удалить бронь</button>
        </>
      )}
    </div>
  )
}

// Сообщения гостю: WhatsApp открывается с готовым текстом, остаётся нажать «Отправить».
// 1 — после бронирования (адрес, правила), 2 — после оплаты (код доступа).
function Messages({ booking, property, focus, code, onCode }) {
  const navigate = useNavigate()
  if (!booking.guest_phone) {
    return <p className="muted small-note">Укажите телефон гостя, чтобы отправлять сообщения в WhatsApp.</p>
  }
  if (!property?.welcome_message && !property?.paid_message) {
    return (
      <section className={'card welcome' + (focus ? ' highlight' : '')}>
        <h2 className="h-icon"><Icon name="message" /> Сообщения гостю</h2>
        <p className="muted">Для «{property?.name}» ещё нет текстов сообщений. Добавьте их в карточке квартиры — и здесь появятся кнопки отправки.</p>
        <button className="btn" onClick={() => navigate('/properties')}>Открыть квартиры</button>
      </section>
    )
  }
  return (
    <>
      {property.welcome_message && (
        <MessageCard booking={booking} template={property.welcome_message} highlight={focus === 'booked'}
          title={focus === 'booked' ? 'Бронь создана — отправьте гостю информацию' : '1. Сообщение о бронировании'} />
      )}
      {property.paid_message && (
        <MessageCard booking={booking} template={property.paid_message} highlight={focus === 'paid'} withCode code={code} onCode={onCode}
          title={focus === 'paid' ? 'Оплата получена — отправьте код доступа' : '2. После оплаты: код доступа'} />
      )}
    </>
  )
}

function MessageCard({ booking, template, title, highlight, withCode, code, onCode }) {
  const { data } = useData()
  const [show, setShow] = useState(false)
  const [draft, setDraft] = useState(code || '')
  const needsCode = withCode && template.includes('{код}')
  const left = balance(booking, data.payments).left
  const text = fillMessage(template, { ...booking, access_code: withCode ? draft.trim() : booking.access_code }, left)
  const wa = whatsappLink(booking.guest_phone, text)
  const blocked = needsCode && !draft.trim()

  return (
    <section className={'card welcome' + (highlight ? ' highlight' : '')}>
      <h2 className="h-icon"><Icon name="message" /> {title}</h2>
      {withCode && (
        <Field label="Код доступа в квартиру" hint="Свой для каждого гостя — подставится в сообщение">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Например, 1234567#" autoComplete="off" />
        </Field>
      )}
      {blocked ? (
        <button className="btn wide big" disabled>Сначала впишите код доступа</button>
      ) : (
        <a className="btn whatsapp wide big" href={wa} target="_blank" rel="noreferrer"
          onClick={() => { if (withCode && draft.trim() !== (code || '')) onCode(draft.trim()) }}>
          Отправить в WhatsApp
        </a>
      )}
      <button type="button" className="btn ghost" onClick={() => setShow(!show)}>{show ? 'Скрыть текст' : 'Посмотреть текст'}</button>
      {show && <pre className="welcome-text">{text}</pre>}
    </section>
  )
}

function Payments({ booking, property, onPaid }) {
  const { data, save, remove, notify } = useData()
  const t = today()
  const bal = balance(booking, data.payments, t)
  const held = depositHeld(booking.id, data.payments)
  const list = data.payments.filter((p) => p.booking_id === booking.id).sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))
  const [p, setP] = useState({ amount: '', paid_at: t, method: 'kaspi', kind: 'payment', note: '' })
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const periods = booking.mode === 'monthly' ? monthlyPeriods(booking, t) : []
  const nextDue = booking.mode === 'monthly'
    ? [addMonths(booking.check_in, periods.length)].find((d) => !booking.check_out || d < booking.check_out)
    : null
  const total = contractTotal(booking)

  async function add(e) {
    e.preventDefault()
    if (!(+p.amount > 0)) return
    setBusy(true)
    try {
      await save('payments', { booking_id: booking.id, ...p, amount: +p.amount, note: p.note || null })
      notify('Платёж добавлен')
      if (p.kind === 'payment' && bal.left > 0 && bal.left - +p.amount <= 0) onPaid()
      setP({ amount: '', paid_at: t, method: 'kaspi', kind: 'payment', note: '' })
      setOpen(false)
    } finally { setBusy(false) }
  }

  const msg = `Здравствуйте${booking.guest_name ? ', ' + booking.guest_name : ''}! Ваша бронь: ${property?.name || ''}${property?.address ? ', ' + property.address : ''}. Заезд ${fmtDate(booking.check_in)} с 14:00${booking.check_out ? `, выезд ${fmtDate(booking.check_out)} до 12:00` : ''}.${bal.left > 0 ? ` К оплате: ${money(bal.left)}.` : ''}`
  const wa = whatsappLink(booking.guest_phone, msg)

  return (
    <section className="card">
      <h2>Оплата</h2>
      <div className="stats">
        {booking.mode === 'daily' ? (
          <div><small>Итого</small><b>{money(bal.due)}</b></div>
        ) : (
          <>
            <div><small>Начислено ({periods.length} мес.)</small><b>{money(bal.due)}</b></div>
            {total != null && <div><small>Весь договор</small><b>{money(total)}</b></div>}
          </>
        )}
        <div><small>Оплачено</small><b className="pos">{money(bal.paid)}</b></div>
        <div><small>Осталось</small><b className={bal.left ? 'neg' : ''}>{money(bal.left)}</b></div>
        {(booking.deposit > 0 || held > 0) && <div><small>Залог на руках</small><b>{money(held)}{booking.deposit > 0 && held < booking.deposit ? ` из ${money(booking.deposit)}` : ''}</b></div>}
        {nextDue && <div><small>Следующая оплата</small><b>{fmtDate(nextDue)}</b></div>}
      </div>

      <div className="btn-row">
        {!open && (
          <button className="btn primary" onClick={() => { setP({ ...p, amount: bal.left || '' }); setOpen(true) }}>+ Платёж</button>
        )}
        {wa && <a className="btn whatsapp" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
        {booking.guest_phone && <a className="btn" href={`tel:${booking.guest_phone.replace(/[^\d+]/g, '')}`}>Позвонить</a>}
      </div>

      {open && (
        <form className="form inset" onSubmit={add}>
          <div className="grid2">
            <Field label="Сумма"><MoneyInput value={p.amount} onChange={(v) => setP({ ...p, amount: v })} autoFocus /></Field>
            <Field label="Дата"><input type="date" value={p.paid_at} onChange={(e) => setP({ ...p, paid_at: e.target.value })} /></Field>
          </div>
          <Field label="Что это"><Chips value={p.kind} onChange={(v) => setP({ ...p, kind: v })} options={PAYMENT_KINDS} /></Field>
          <Field label="Способ"><Chips value={p.method} onChange={(v) => setP({ ...p, method: v })} options={METHODS} /></Field>
          <div className="btn-row">
            <button className="btn primary" disabled={busy}>Добавить</button>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Отмена</button>
          </div>
        </form>
      )}

      {list.length > 0 && (
        <ul className="list">
          {list.map((x) => (
            <li key={x.id}>
              <span className="grow">
                <b className={x.kind === 'refund' || x.kind === 'deposit_return' ? 'neg' : ''}>{x.kind === 'refund' || x.kind === 'deposit_return' ? '−' : ''}{money(x.amount)}</b>
                <small>{fmtDate(x.paid_at)} · {kindLabel(x.kind)} · {methodLabel(x.method)}{x.note ? ` · ${x.note}` : ''}</small>
              </span>
              <button className="icon-btn" aria-label="Удалить платёж"
                onClick={async () => { if (confirm('Удалить этот платёж?')) { await remove('payments', x.id); notify('Платёж удалён') } }}>🗑</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
