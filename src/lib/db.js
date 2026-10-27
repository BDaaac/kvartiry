// Слой данных: Supabase, а если ключи не заданы — демо-режим с данными в браузере.
import { createClient } from '@supabase/supabase-js'
import { addDays, today, addMonths } from './dates'
import { EXAMPLE_WELCOME, EXAMPLE_PAID } from './welcome'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
export const isDemo = !supabase
export const supabaseUrl = url
// Имя Edge Function с календарём (так она названа в Supabase при создании)
const CALENDAR_FUNCTION = 'bright-task'

export const TABLES = ['properties', 'bookings', 'payments', 'expenses']

function humanError(error) {
  if (!error) return null
  if (error.code === '23P01') return 'Эти даты уже заняты другой бронью в этой квартире'
  if (error.code === '23514') return 'Проверьте даты: выезд должен быть позже заезда'
  if (error.code === 'PGRST204') return 'База устарела: запустите в Supabase SQL-файлы из папки supabase/migrations'
  return error.message || 'Ошибка сохранения'
}

async function sb(promise) {
  const { data, error } = await promise
  if (error) throw new Error(humanError(error))
  return data
}

// ---------- Демо-режим ----------
const DEMO_KEY = 'kvartiry-demo-v1'
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2))

function demoSeed() {
  const t = today()
  const p1 = uid(), p2 = uid()
  const b = (property_id, ci, n, price, name, extra = {}) => ({
    id: uid(), property_id, mode: 'daily', check_in: addDays(t, ci), check_out: addDays(t, ci + n),
    guest_name: name, guest_phone: '8707' + String(1234567 + name.length * 1111 + name.charCodeAt(0)).slice(-7), guests_count: 2, price_total: price,
    monthly_rate: null, deposit: 0, source: 'krisha', status: 'confirmed', notes: '', ...extra,
  })
  const bookings = [
    b(p1, -40, 3, 45000, 'Айгерим'), b(p1, -33, 5, 75000, 'Ерлан', { source: 'repeat' }),
    b(p1, -20, 2, 32000, 'Марина'), b(p1, -12, 4, 60000, 'Данияр'),
    b(p1, -3, 5, 75000, 'Алия'), b(p1, 4, 3, 48000, 'Тимур', { status: 'pending' }),
    b(p2, -55, 7, 98000, 'Сергей'), b(p2, -25, 3, 42000, 'Асель', { source: 'whatsapp' }),
    b(p2, -9, 2, 30000, 'Нурлан'), b(p2, 2, 6, 90000, 'Гульнара'),
  ]
  const payments = []
  for (const x of bookings) {
    if (x.check_in <= t) payments.push({ id: uid(), booking_id: x.id, amount: x.price_total, paid_at: x.check_in, method: 'kaspi', kind: 'payment' })
    else payments.push({ id: uid(), booking_id: x.id, amount: 10000, paid_at: addDays(t, -2), method: 'kaspi', kind: 'payment' })
  }
  // депозиты: Данияр выехал — пора вернуть, Алия живёт — держим, Тимур ещё не внёс
  for (const i of [3, 4, 5]) bookings[i].deposit = 10000
  payments.push({ id: uid(), booking_id: bookings[3].id, amount: 10000, paid_at: bookings[3].check_in, method: 'cash', kind: 'deposit' })
  payments.push({ id: uid(), booking_id: bookings[4].id, amount: 10000, paid_at: bookings[4].check_in, method: 'kaspi', kind: 'deposit' })
  // последнюю текущую бронь оставим с долгом
  payments.find((p) => p.booking_id === bookings[4].id).amount = 40000
  const expenses = [
    { id: uid(), property_id: p1, category: 'Коммуналка', amount: 28000, spent_at: addDays(t, -20), note: '' },
    { id: uid(), property_id: p2, category: 'Коммуналка', amount: 24000, spent_at: addDays(t, -20), note: '' },
    { id: uid(), property_id: p1, category: 'Уборка', amount: 15000, spent_at: addDays(t, -10), note: '' },
    { id: uid(), property_id: null, category: 'Реклама', amount: 9000, spent_at: addDays(t, -30), note: 'Поднятие объявлений' },
    { id: uid(), property_id: p2, category: 'Ремонт', amount: 35000, spent_at: addMonths(t, -1), note: 'Смеситель' },
  ]
  return {
    properties: [
      { id: p1, name: 'Квартира на Абая', address: 'пр. Абая, 10', color: '#a8662e', rate_daily: 15000, rate_monthly: 250000, notes: 'Wi-Fi: home123', welcome_message: EXAMPLE_WELCOME, paid_message: EXAMPLE_PAID, archived: false },
      { id: p2, name: 'Квартира на Сатпаева', address: 'ул. Сатпаева, 5', color: '#2f7fb8', rate_daily: 14000, rate_monthly: 230000, notes: '', archived: false },
    ],
    bookings, payments, expenses,
  }
}

function demoLoad() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* нет доступа к хранилищу */ }
  const seed = demoSeed()
  demoSave(seed)
  return seed
}
function demoSave(data) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}
export function demoReset() {
  try { localStorage.removeItem(DEMO_KEY) } catch { /* ignore */ }
}

// ---------- Общий API ----------
const ORDER = { properties: 'created_at', bookings: 'check_in', payments: 'paid_at', expenses: 'spent_at' }

export async function loadAll() {
  if (isDemo) return demoLoad()
  const entries = await Promise.all(TABLES.map(async (t) => [t, await sb(supabase.from(t).select('*').order(ORDER[t]))]))
  return Object.fromEntries(entries)
}

export async function insertRow(table, row) {
  if (isDemo) {
    const d = demoLoad()
    const r = { id: uid(), created_at: new Date().toISOString(), ...row }
    d[table].push(r); demoSave(d)
    return r
  }
  return sb(supabase.from(table).insert(row).select().single())
}

export async function updateRow(table, id, patch) {
  if (isDemo) {
    const d = demoLoad()
    const i = d[table].findIndex((r) => r.id === id)
    d[table][i] = { ...d[table][i], ...patch }; demoSave(d)
    return d[table][i]
  }
  return sb(supabase.from(table).update(patch).eq('id', id).select().single())
}

export async function deleteRow(table, id) {
  if (isDemo) {
    const d = demoLoad()
    d[table] = d[table].filter((r) => r.id !== id)
    if (table === 'bookings') d.payments = d.payments.filter((p) => p.booking_id !== id)
    if (table === 'properties') {
      const gone = new Set(d.bookings.filter((b) => b.property_id === id).map((b) => b.id))
      d.bookings = d.bookings.filter((b) => !gone.has(b.id))
      d.payments = d.payments.filter((p) => !gone.has(p.booking_id))
    }
    demoSave(d)
    return
  }
  await sb(supabase.from(table).delete().eq('id', id))
}

/** Ссылка-подписка на календарь для iPhone */
export async function calendarFeedUrl() {
  if (isDemo) return null
  let rows = await sb(supabase.from('calendar_tokens').select('token'))
  if (!rows.length) rows = [await sb(supabase.from('calendar_tokens').insert({}).select('token').single())]
  return `${url.replace(/^https:/, 'webcal:')}/functions/v1/${CALENDAR_FUNCTION}?token=${rows[0].token}`
}
