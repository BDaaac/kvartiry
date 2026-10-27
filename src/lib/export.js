// Выгрузка в Excel (.xlsx)
// xlsx грузится только при нажатии «Excel», чтобы приложение открывалось быстрее
let XLSX
import { analyze, monthlySeries, balance, nightsOf, endOf } from './calc'
import { addDays, fmtMonth, monthStart } from './dates'
import { sourceLabel, statusLabel, methodLabel, kindLabel } from './format'

function sheet(rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows)
  if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }))
  return ws
}

export async function exportExcel(data, from, to, propertyIds, title) {
  XLSX = await import('xlsx')
  const props = new Map(data.properties.map((p) => [p.id, p]))
  const ids = new Set(propertyIds)
  const pname = (id) => (id ? props.get(id)?.name || '—' : 'Общий')
  const bookingById = new Map(data.bookings.map((b) => [b.id, b]))

  const a = analyze(data, from, to, propertyIds)
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, sheet([
    { Показатель: 'Период', Значение: `${from} — ${addDays(to, -1)}` },
    { Показатель: 'Получено денег, ₸', Значение: a.income },
    { Показатель: 'Расходы, ₸', Значение: a.expenses },
    { Показатель: 'Прибыль, ₸', Значение: a.profit },
    { Показатель: 'Ночей сдано', Значение: a.nights },
    { Показатель: 'Загрузка, %', Значение: Math.round(a.occupancy * 100) },
    { Показатель: 'Средняя цена за ночь, ₸', Значение: Math.round(a.adr) },
  ], [28, 24]), 'Итоги')

  XLSX.utils.book_append_sheet(wb, sheet(a.rows.map((r) => ({
    Квартира: r.property.name,
    'Получено, ₸': r.income,
    'Расходы, ₸': r.expenses,
    'Прибыль, ₸': r.profit,
    Ночей: r.nights,
    'Загрузка, %': Math.round(r.occupancy * 100),
    'Ср. цена за ночь, ₸': Math.round(r.adr),
  })), [26, 14, 14, 14, 8, 12, 18]), 'По квартирам')

  const series = monthlySeries(data, addDays(to, -1), Math.max(1, monthsBetween(from, to)), propertyIds)
  XLSX.utils.book_append_sheet(wb, sheet(series.map((m) => ({
    Месяц: fmtMonth(m.month),
    'Получено, ₸': m.income,
    'Расходы, ₸': m.expenses,
    'Прибыль, ₸': m.profit,
    Ночей: m.nights,
    'Загрузка, %': Math.round(m.occupancy * 100),
  })), [16, 14, 14, 14, 8, 12]), 'По месяцам')

  const bookings = data.bookings
    .filter((b) => ids.has(b.property_id) && b.check_in < to && endOf(b) > from)
    .map((b) => {
      const bal = balance(b, data.payments)
      return {
        Квартира: pname(b.property_id),
        Тип: b.mode === 'daily' ? 'Посуточно' : 'Помесячно',
        Заезд: b.check_in,
        Выезд: b.check_out || 'бессрочно',
        Ночей: nightsOf(b) ?? '',
        Гость: b.guest_name || '',
        Телефон: b.guest_phone || '',
        Источник: sourceLabel(b.source),
        Статус: statusLabel(b.status),
        'Сумма / ставка, ₸': b.mode === 'daily' ? +b.price_total || 0 : +b.monthly_rate || 0,
        'Оплачено, ₸': bal.paid,
        'Долг, ₸': bal.left,
        Заметки: b.notes || '',
      }
    })
  XLSX.utils.book_append_sheet(wb, sheet(bookings, [22, 11, 11, 11, 6, 16, 14, 14, 15, 16, 12, 10, 24]), 'Брони')

  const payments = data.payments
    .filter((p) => p.paid_at >= from && p.paid_at < to && ids.has(bookingById.get(p.booking_id)?.property_id))
    .map((p) => {
      const b = bookingById.get(p.booking_id)
      return {
        Дата: p.paid_at, Квартира: pname(b.property_id), Гость: b.guest_name || '',
        Тип: kindLabel(p.kind), Способ: methodLabel(p.method), 'Сумма, ₸': +p.amount, Комментарий: p.note || '',
      }
    })
  XLSX.utils.book_append_sheet(wb, sheet(payments, [11, 22, 16, 16, 11, 12, 24]), 'Платежи')

  const expenses = data.expenses
    .filter((e) => e.spent_at >= from && e.spent_at < to && (!e.property_id || ids.has(e.property_id)))
    .map((e) => ({ Дата: e.spent_at, Квартира: pname(e.property_id), Категория: e.category, 'Сумма, ₸': +e.amount, Комментарий: e.note || '' }))
  XLSX.utils.book_append_sheet(wb, sheet(expenses, [11, 22, 16, 12, 30]), 'Расходы')

  XLSX.writeFile(wb, `rent.kz ${title || `${from}_${addDays(to, -1)}`}.xlsx`)
}

function monthsBetween(from, to) {
  const a = monthStart(from), b = monthStart(addDays(to, -1))
  return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)) + 1
}
