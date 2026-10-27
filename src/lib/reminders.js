// Напоминания: что важно сегодня и в ближайшие дни.
import { addDays, addMonths, diffDays, fmtDate } from './dates'
import { isActive, endOf, balance, depositInfo, paidAmount } from './calc'
import { money } from './format'

const when = (d, t) => {
  const n = diffDays(t, d)
  if (n === 0) return 'Сегодня'
  if (n === 1) return 'Завтра'
  if (n === 2) return 'Послезавтра'
  return `${fmtDate(d)}`
}

/**
 * Список напоминаний, отсортированный по срочности.
 * level: urgent (сегодня/просрочено) | soon (в ближайшие дни)
 */
export function getReminders({ bookings, payments }, propertyById, t) {
  const out = []
  const name = (b) => `${b.guest_name || 'Гость'} · ${propertyById.get(b.property_id)?.name || ''}`

  for (const b of bookings) {
    if (!isActive(b)) continue

    // заезд сегодня / завтра / послезавтра
    const toIn = diffDays(t, b.check_in)
    if (toIn >= 0 && toIn <= 2) {
      const left = balance(b, payments, t).left
      out.push({
        id: b.id + '-in', booking: b, date: b.check_in, level: toIn === 0 ? 'urgent' : 'soon', icon: 'key',
        title: `${when(b.check_in, t)} заезд`,
        text: name(b) + (left > 0 ? ` · доплата ${money(left)}` : ''),
      })
      if (b.status === 'pending') {
        out.push({ id: b.id + '-pre', booking: b, date: b.check_in, level: 'urgent', icon: 'receipt', title: 'Нет предоплаты', text: `${name(b)} · заезд ${fmtDate(b.check_in)}` })
      }
    }

    // выезд и уборка сегодня / завтра
    if (b.check_out) {
      const toOut = diffDays(t, b.check_out)
      if (toOut >= 0 && toOut <= 1) {
        out.push({ id: b.id + '-out', booking: b, date: b.check_out, level: toOut === 0 ? 'urgent' : 'soon', icon: 'home', title: `${when(b.check_out, t)} выезд и уборка`, text: name(b) })
      }
    }

    // помесячная аренда: день оплаты в ближайшие 3 дня или уже просрочен
    if (b.mode === 'monthly' && b.check_in <= addDays(t, 3) && endOf(b) > t) {
      for (let i = 0; i < 600; i++) {
        const due = addMonths(b.check_in, i)
        if (due > addDays(t, 3) || (b.check_out && due >= b.check_out)) break
        if (due < addDays(t, -40)) continue
        // оплачено ли это начисление: всего оплат ≥ (i+1) × ставка
        const paidEnough = paidAmount(b.id, payments) >= (i + 1) * (+b.monthly_rate || 0)
        if (paidEnough) continue
        const late = due < t
        out.push({
          id: `${b.id}-pay-${i}`, booking: b, date: due, level: late || due === t ? 'urgent' : 'soon', icon: 'calendar',
          title: late ? `Просрочена оплата аренды (${fmtDate(due)})` : `${when(due, t)} день оплаты аренды`,
          text: `${name(b)} · ${money(b.monthly_rate)}`,
        })
      }
    }

    // депозит пора вернуть
    if (depositInfo(b, payments, t).status === 'to_return') {
      out.push({ id: b.id + '-dep', booking: b, date: b.check_out, level: 'urgent', icon: 'key', title: 'Вернуть депозит', text: `${name(b)} · ${money(depositInfo(b, payments, t).held)}` })
    }
  }

  const rank = { urgent: 0, soon: 1 }
  return out.sort((a, c) => rank[a.level] - rank[c.level] || (a.date < c.date ? -1 : 1))
}
