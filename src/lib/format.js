const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export const money = (n) => `${nf.format(Math.round(n || 0))} ₸`
export const num = (n) => nf.format(Math.round(n || 0))
export const pct = (x) => `${Math.round((x || 0) * 100)}%`

/** Короткая запись для графиков: 1,2 млн / 350 тыс */
export function moneyShort(n) {
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} млн`
  if (a >= 1e3) return `${Math.round(n / 1e3)} тыс`
  return String(Math.round(n))
}

/** Номер телефона → ссылка WhatsApp (Казахстан, +7) */
export function whatsappLink(phone, text = '') {
  let d = (phone || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1)
  if (d.length === 10) d = '7' + d
  if (!d) return null
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export const SOURCES = [
  { id: 'krisha', label: 'Krisha.kz' },
  { id: 'booking', label: 'Booking.com' },
  { id: 'airbnb', label: 'Airbnb' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'repeat', label: 'Постоянный гость' },
  { id: 'friends', label: 'Знакомые' },
  { id: 'other', label: 'Другое' },
]
export const sourceLabel = (id) => SOURCES.find((s) => s.id === id)?.label || id

export const METHODS = [
  { id: 'kaspi', label: 'Kaspi' },
  { id: 'cash', label: 'Наличные' },
  { id: 'transfer', label: 'Перевод' },
  { id: 'other', label: 'Другое' },
]
export const methodLabel = (id) => METHODS.find((s) => s.id === id)?.label || id

export const PAYMENT_KINDS = [
  { id: 'payment', label: 'Оплата' },
  { id: 'deposit', label: 'Депозит получен' },
  { id: 'deposit_return', label: 'Депозит возвращён' },
  { id: 'deposit_keep', label: 'Депозит удержан' },
  { id: 'refund', label: 'Возврат гостю' },
]
export const kindLabel = (id) => PAYMENT_KINDS.find((s) => s.id === id)?.label || id

export const EXPENSE_CATEGORIES = [
  'Аренда', 'Коммуналка', 'Уборка', 'Стирка', 'Ремонт', 'Мебель и техника',
  'Реклама', 'Комиссия площадок', 'Расходники', 'Интернет и ТВ', 'Налоги', 'Другое',
]

export const STATUSES = [
  { id: 'confirmed', label: 'Подтверждена' },
  { id: 'pending', label: 'Ждём предоплату' },
  { id: 'cancelled', label: 'Отменена' },
]
export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id

export const PROPERTY_COLORS = ['#a8662e', '#2f7fb8', '#5f8f4e', '#c25b3c', '#8a6bb0', '#c9952b', '#3f8f8a', '#b5577f']
