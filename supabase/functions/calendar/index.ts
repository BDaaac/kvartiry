// Supabase Edge Function: календарь-подписка (.ics) для iPhone.
// Адрес: https://<project>.supabase.co/functions/v1/calendar?token=<секрет>
// В настройках функции ОТКЛЮЧИТЕ «Verify JWT» — iPhone не умеет передавать токен входа.
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const money = (n: number) => `${fmt.format(n || 0)} ₸`

const ymd = (s: string) => s.replaceAll('-', '')
function addDays(s: string, n: number) {
  const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
function addMonths(s: string, n: number) {
  const d = new Date(s + 'T00:00:00Z'); const day = d.getUTCDate()
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10)
}
const nights = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

// RFC 5545: строки не длиннее 75 байт
const enc = new TextEncoder()
function fold(line: string) {
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = '' }
    cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}

// Будильники для событий «на весь день»: время отсчитывается от полуночи дня события.
// -PT6H — накануне в 18:00, PT9H — в сам день в 9:00, -P2DT14H — за 3 дня в 10:00.
type Alarm = [trigger: string, text: string]
const DAY_BEFORE = '-PT6H', MORNING = 'PT9H', THREE_DAYS = '-P2DT14H'

function alarms(list: Alarm[]) {
  return list.flatMap(([trigger, text]) => [
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, 'END:VALARM',
  ])
}

function allDay(uid: string, start: string, end: string, title: string, desc: string, remind: Alarm[] = []) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@kvartiry`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${ymd(start)}`,
    `DTEND;VALUE=DATE:${ymd(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(desc)}`,
    'TRANSP:TRANSPARENT',
    ...alarms(remind),
    'END:VEVENT',
  ]
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return new Response('no token', { status: 400 })

  const { data: tok } = await db.from('calendar_tokens').select('user_id').eq('token', token).maybeSingle()
  if (!tok) return new Response('not found', { status: 404 })

  const since = addDays(new Date().toISOString().slice(0, 10), -120)
  const [{ data: props }, { data: bookings }] = await Promise.all([
    db.from('properties').select('id,name,address').eq('user_id', tok.user_id),
    db.from('bookings').select('*').eq('user_id', tok.user_id).neq('status', 'cancelled')
      .or(`check_out.gte.${since},check_out.is.null`),
  ])
  const pname = new Map((props ?? []).map((p) => [p.id, p.name]))
  const today = new Date().toISOString().slice(0, 10)

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kvartiry//RU', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:rent.kz', 'X-WR-TIMEZONE:Asia/Almaty', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const b of bookings ?? []) {
    const p = pname.get(b.property_id) ?? 'Квартира'
    const guest = b.guest_name || 'Гость'
    const phone = b.guest_phone ? `\nТел: ${b.guest_phone}` : ''
    const pending = b.status === 'pending' ? ' (ждём предоплату)' : ''
    if (b.mode === 'daily') {
      const n = nights(b.check_in, b.check_out)
      lines.push(...allDay(`${b.id}-stay`, b.check_in, b.check_out,
        `🏠 ${p}: ${guest}, ${n} н.${pending}`, `Сумма: ${money(b.price_total)}${phone}${b.notes ? '\n' + b.notes : ''}`,
        [[DAY_BEFORE, `Завтра заезд: ${guest}, ${p}`], [MORNING, `Сегодня заезд: ${guest}, ${p}`]]))
      lines.push(...allDay(`${b.id}-out`, b.check_out, addDays(b.check_out, 1),
        `🧹 Выезд и уборка: ${p}`, `${guest}${phone}`, [[MORNING, `Сегодня выезд и уборка: ${p}`]]))
    } else {
      const end = b.check_out ?? addMonths(today, 12)
      lines.push(...allDay(`${b.id}-in`, b.check_in, addDays(b.check_in, 1),
        `🔑 Заезд: ${p}, ${guest} (помесячно)${pending}`, `${money(b.monthly_rate)} в месяц${phone}`,
        [[DAY_BEFORE, `Завтра заезд: ${guest}, ${p}`], [MORNING, `Сегодня заезд: ${guest}, ${p}`]]))
      for (let i = 1; i < 120; i++) {
        const d = addMonths(b.check_in, i)
        if (d >= end) break
        if (d < since) continue
        lines.push(...allDay(`${b.id}-pay-${i}`, d, addDays(d, 1),
          `💰 Оплата: ${p}, ${guest} — ${money(b.monthly_rate)}`, phone.trim(),
          [[THREE_DAYS, `Через 3 дня оплата аренды: ${guest}, ${money(b.monthly_rate)}`], [MORNING, `Сегодня день оплаты аренды: ${guest}, ${money(b.monthly_rate)}`]]))
      }
      if (b.check_out) {
        lines.push(...allDay(`${b.id}-out`, b.check_out, addDays(b.check_out, 1), `🧹 Выезд: ${p}, ${guest}`, phone.trim(),
          [[DAY_BEFORE, `Завтра выезд: ${guest}, ${p}`], [MORNING, `Сегодня выезд: ${guest}, ${p}`]]))
      }
    }
  }
  lines.push('END:VCALENDAR')

  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="kvartiry.ics"',
      'Cache-Control': 'no-cache',
    },
  })
})
