// Расчёты по броням и аналитика.
import { addDays, addMonths, diffDays, overlapDays, today, monthStart, nextMonthStart } from './dates'

export const isActive = (b) => b.status !== 'cancelled'

/** Конец проживания; у бессрочной помесячной — «бесконечность» */
export const endOf = (b) => b.check_out || '9999-12-31'

export const nightsOf = (b) => (b.check_out ? diffDays(b.check_in, b.check_out) : null)

/** Даты начала оплачиваемых месяцев помесячной аренды, начавшиеся до `upTo` включительно */
export function monthlyPeriods(b, upTo) {
  const out = []
  for (let i = 0; i < 600; i++) {
    const start = addMonths(b.check_in, i)
    if (start > upTo || (b.check_out && start >= b.check_out)) break
    out.push(start)
  }
  return out
}

/**
 * Сколько гость должен заплатить на дату `asOf`.
 * Посуточно — вся сумма брони. Помесячно — ставка × начавшиеся месяцы.
 */
export function dueAmount(b, asOf = today()) {
  if (!isActive(b)) return 0
  if (b.mode === 'daily') return +b.price_total || 0
  return monthlyPeriods(b, asOf).length * (+b.monthly_rate || 0)
}

/** Полная сумма договора (для помесячной с датой выезда) */
export function contractTotal(b) {
  if (b.mode === 'daily') return +b.price_total || 0
  if (!b.check_out) return null
  return monthlyPeriods(b, addDays(b.check_out, -1)).length * (+b.monthly_rate || 0)
}

/** Сумма оплат (без залога) */
export function paidAmount(bookingId, payments) {
  let s = 0
  for (const p of payments) {
    if (p.booking_id !== bookingId) continue
    if (p.kind === 'payment') s += +p.amount
    if (p.kind === 'refund') s -= +p.amount
  }
  return s
}

/** Залог, который сейчас на руках */
export function depositHeld(bookingId, payments) {
  let s = 0
  for (const p of payments) {
    if (p.booking_id !== bookingId) continue
    if (p.kind === 'deposit') s += +p.amount
    if (p.kind === 'deposit_return') s -= +p.amount
  }
  return s
}

export function balance(b, payments, asOf = today()) {
  const due = dueAmount(b, asOf)
  const paid = paidAmount(b.id, payments)
  return { due, paid, left: Math.max(0, due - paid), over: Math.max(0, paid - due) }
}

/** Доход «по ночам» брони за один день (для начисления по периодам) */
function dailyValue(b) {
  if (b.mode === 'daily') {
    const n = nightsOf(b)
    return n ? (+b.price_total || 0) / n : 0
  }
  return ((+b.monthly_rate || 0) * 12) / 365
}

/**
 * Аналитика за период [from, to).
 * propertyIds — список квартир, по которым считаем.
 */
export function analyze({ properties, bookings, payments, expenses }, from, to, propertyIds) {
  const propSet = new Set(propertyIds)
  const bookingById = new Map(bookings.map((b) => [b.id, b]))
  const days = Math.max(0, diffDays(from, to))

  const byProp = new Map(
    properties.filter((p) => propSet.has(p.id)).map((p) => [p.id, {
      property: p, income: 0, expenses: 0, nights: 0, accrued: 0, dailyNights: 0, dailyAccrued: 0, bookings: 0,
    }]),
  )
  const bySource = new Map()

  for (const b of bookings) {
    if (!isActive(b) || !propSet.has(b.property_id)) continue
    const n = overlapDays(b.check_in, endOf(b), from, to)
    if (!n) continue
    const row = byProp.get(b.property_id)
    const acc = n * dailyValue(b)
    row.nights += n
    row.accrued += acc
    row.bookings += 1
    if (b.mode === 'daily') { row.dailyNights += n; row.dailyAccrued += acc }
    const src = bySource.get(b.source) || { source: b.source, bookings: 0, nights: 0, accrued: 0 }
    src.bookings += 1; src.nights += n; src.accrued += acc
    bySource.set(b.source, src)
  }

  for (const p of payments) {
    if (p.paid_at < from || p.paid_at >= to) continue
    const b = bookingById.get(p.booking_id)
    if (!b || !propSet.has(b.property_id)) continue
    const row = byProp.get(b.property_id)
    if (p.kind === 'payment') row.income += +p.amount
    if (p.kind === 'refund') row.income -= +p.amount
  }

  let commonExpenses = 0
  const byCategory = new Map()
  for (const e of expenses) {
    if (e.spent_at < from || e.spent_at >= to) continue
    if (e.property_id && !propSet.has(e.property_id)) continue
    if (e.property_id && byProp.has(e.property_id)) byProp.get(e.property_id).expenses += +e.amount
    else commonExpenses += +e.amount
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + +e.amount)
  }

  const rows = [...byProp.values()].map((r) => ({
    ...r,
    profit: r.income - r.expenses,
    occupancy: days ? r.nights / days : 0,
    adr: r.dailyNights ? r.dailyAccrued / r.dailyNights : 0,
  }))
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0)
  const income = sum('income')
  const exp = sum('expenses') + commonExpenses
  const nights = sum('nights')
  const dailyNights = sum('dailyNights')

  return {
    from, to, days,
    income,
    expenses: exp,
    commonExpenses,
    profit: income - exp,
    nights,
    accrued: sum('accrued'),
    occupancy: days && rows.length ? nights / (days * rows.length) : 0,
    adr: dailyNights ? sum('dailyAccrued') / dailyNights : 0,
    rows,
    sources: [...bySource.values()].sort((a, b) => b.accrued - a.accrued),
    categories: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  }
}

/** Помесячная разбивка за последние `count` месяцев, заканчивая месяцем `endMonth` */
export function monthlySeries(data, endMonth, count, propertyIds) {
  const out = []
  let m = addMonths(monthStart(endMonth), -(count - 1))
  for (let i = 0; i < count; i++) {
    const a = analyze(data, m, nextMonthStart(m), propertyIds)
    out.push({ month: m, income: a.income, expenses: a.expenses, profit: a.profit, occupancy: a.occupancy, nights: a.nights })
    m = nextMonthStart(m)
  }
  return out
}

/** Брони, по которым гость ещё должен */
export function debts(bookings, payments, propertyIds, asOf = today()) {
  const propSet = new Set(propertyIds)
  return bookings
    .filter((b) => isActive(b) && propSet.has(b.property_id))
    .map((b) => ({ booking: b, ...balance(b, payments, asOf), overdue: b.check_in <= asOf }))
    .filter((d) => d.left > 0)
    .sort((a, b) => (a.booking.check_in < b.booking.check_in ? -1 : 1))
}

/** Пересекается ли бронь с другими в той же квартире */
export function findOverlap(bookings, draft) {
  return bookings.find((b) =>
    b.id !== draft.id && isActive(b) && b.property_id === draft.property_id &&
    b.check_in < endOf(draft) && draft.check_in < endOf(b),
  )
}

/** Брони, которые сейчас идут / начинаются / заканчиваются сегодня */
export function todayEvents(bookings, day = today()) {
  const act = bookings.filter(isActive)
  return {
    checkIns: act.filter((b) => b.check_in === day),
    checkOuts: act.filter((b) => b.check_out === day),
    staying: act.filter((b) => b.check_in < day && endOf(b) > day),
    upcoming: act.filter((b) => b.check_in > day && b.check_in <= addDays(day, 7)).sort((a, b) => (a.check_in < b.check_in ? -1 : 1)),
  }
}


