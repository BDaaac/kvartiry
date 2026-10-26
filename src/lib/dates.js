// Все даты в приложении — строки 'YYYY-MM-DD'. Считаем в UTC, чтобы не ловить сдвиги часовых поясов.

export const toDate = (s) => new Date(s + 'T00:00:00Z')
export const toStr = (d) => d.toISOString().slice(0, 10)

export function today() {
  const d = new Date()
  return toStr(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())))
}

export function addDays(s, n) {
  const d = toDate(s)
  d.setUTCDate(d.getUTCDate() + n)
  return toStr(d)
}

export function addMonths(s, n) {
  const d = toDate(s)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return toStr(d)
}

export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000)

export const monthStart = (s) => s.slice(0, 8) + '01'
export const nextMonthStart = (s) => addMonths(monthStart(s), 1)
export const yearStart = (s) => s.slice(0, 4) + '-01-01'

export const minStr = (a, b) => (a < b ? a : b)
export const maxStr = (a, b) => (a > b ? a : b)

/** Сколько дней из [from, to) пересекается с [a, b) */
export function overlapDays(a, b, from, to) {
  const s = maxStr(a, from)
  const e = minStr(b, to)
  return s < e ? diffDays(s, e) : 0
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export function fmtDate(s, withYear = false) {
  if (!s) return '—'
  const d = toDate(s)
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  return withYear || d.getUTCFullYear() !== new Date().getFullYear() ? `${base} ${d.getUTCFullYear()}` : base
}

export const fmtMonth = (s) => `${MONTHS_NOM[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`
export const fmtMonthShort = (s) => `${MONTHS_SHORT[+s.slice(5, 7) - 1]} ${s.slice(2, 4)}`
export const weekday = (s) => toDate(s).getUTCDay()

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
export const nightsLabel = (n) => `${n} ${plural(n, 'ночь', 'ночи', 'ночей')}`
