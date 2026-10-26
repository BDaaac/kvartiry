// История гостей: собирается из броней, один гость = один номер телефона (или имя, если номера нет).
import { isActive, nightsOf, paidAmount } from './calc'

/** 8 707 123-45-67, +7 707…, 707… → 77071234567 */
export function normPhone(phone) {
  let d = (phone || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1)
  if (d.length === 10) d = '7' + d
  return d
}

export function guestKey(b) {
  const p = normPhone(b.guest_phone)
  if (p) return 'p' + p
  const n = (b.guest_name || '').trim().toLowerCase()
  return n ? 'n' + n : null
}

export function buildGuests(bookings, payments) {
  const map = new Map()
  for (const b of bookings) {
    const key = guestKey(b)
    if (!key) continue
    let g = map.get(key)
    if (!g) { g = { key, name: '', phone: '', bookings: [], stays: 0, nights: 0, paid: 0, last: '' }; map.set(key, g) }
    g.bookings.push(b)
    // имя и телефон берём из самой свежей брони
    if (b.check_in >= g.last) {
      g.last = b.check_in
      g.name = b.guest_name || g.name
      g.phone = b.guest_phone || g.phone
    }
    if (isActive(b)) {
      g.stays += 1
      g.nights += nightsOf(b) || 0
      g.paid += paidAmount(b.id, payments)
    }
  }
  for (const g of map.values()) g.bookings.sort((a, b) => (a.check_in < b.check_in ? 1 : -1))
  return [...map.values()].sort((a, b) => b.stays - a.stays || (a.last < b.last ? 1 : -1))
}
