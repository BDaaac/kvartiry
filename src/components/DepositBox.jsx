import { useState } from 'react'
import { useData } from '../store'
import { depositInfo } from '../lib/calc'
import { fmtDate, today } from '../lib/dates'
import { money, METHODS } from '../lib/format'
import { Field, MoneyInput, Chips } from './ui'

export const DEPOSIT_STATUS = {
  waiting: { label: 'ждём депозит', cls: 'warn' },
  holding: { label: 'держим', cls: 'live' },
  to_return: { label: 'пора вернуть', cls: 'danger' },
  closed: { label: 'закрыт', cls: '' },
}

/** Кто кому должен по депозиту — одной фразой */
export function depositLine(b, d) {
  if (d.status === 'waiting') return { who: 'Гость → вам', text: `гость должен внести депозит ${money(d.expected - d.received)}` }
  if (d.status === 'holding') return { who: 'Вы → гостю', text: `вернуть ${money(d.held)} после выезда${b.check_out ? ` ${fmtDate(b.check_out)}` : ''}` }
  if (d.status === 'to_return') return { who: 'Вы → гостю', text: `гость выехал${b.check_out ? ` ${fmtDate(b.check_out)}` : ''} — верните ${money(d.held)}` }
  if (d.status === 'closed') return { who: 'Закрыт', text: [d.returned && `возвращено ${money(d.returned)}`, d.kept && `удержано ${money(d.kept)}`].filter(Boolean).join(', ') }
  return null
}

/** Блок депозита с действиями: внёс / вернуть / удержать */
export default function DepositBox({ booking, compact = false }) {
  const { data, save, notify } = useData()
  const d = depositInfo(booking, data.payments)
  const [mode, setMode] = useState(null) // 'receive' | 'keep'
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [method, setMethod] = useState('kaspi')
  const [busy, setBusy] = useState(false)

  if (d.status === 'none') return null
  const line = depositLine(booking, d)
  const st = DEPOSIT_STATUS[d.status]

  async function record(kind, sum, extra = {}) {
    setBusy(true)
    try {
      await save('payments', { booking_id: booking.id, kind, amount: sum, paid_at: today(), method, note: extra.note || null })
      notify(kind === 'deposit' ? 'Депозит получен' : kind === 'deposit_return' ? 'Депозит возвращён' : 'Удержание записано')
      setMode(null); setAmount(''); setNote('')
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const giveBack = () => {
    if (confirm(`Записать, что вы вернули гостю ${money(d.held)}?`)) record('deposit_return', d.held)
  }

  return (
    <div className={'deposit' + (d.status === 'to_return' ? ' alert' : '') + (compact ? ' compact' : '')}>
      {!compact && (
        <div className="deposit-head">
          <b>Депозит</b>
          <span className={`badge ${st.cls}`}>{st.label}</span>
        </div>
      )}
      <div className="deposit-line">
        <span className="who">{line.who}</span>
        <span>{line.text}</span>
      </div>
      {!compact && (
        <div className="deposit-nums">
          <span>Ожидали <b>{money(d.expected)}</b></span>
          <span>Получили <b>{money(d.received)}</b></span>
          {d.returned > 0 && <span>Вернули <b>{money(d.returned)}</b></span>}
          {d.kept > 0 && <span>Удержали <b>{money(d.kept)}</b></span>}
          <span>На руках <b>{money(d.held)}</b></span>
        </div>
      )}

      {!mode && (
        <div className="btn-row">
          {d.status === 'waiting' && (
            <button className="btn primary small" disabled={busy} onClick={() => { setAmount(d.expected - d.received); setMode('receive') }}>Гость внёс депозит</button>
          )}
          {d.held > 0 && (
            <>
              <button className={'btn small' + (d.status === 'to_return' ? ' primary' : '')} disabled={busy} onClick={giveBack}>Вернуть {money(d.held)}</button>
              <button className="btn small" disabled={busy} onClick={() => { setAmount(''); setMode('keep') }}>Удержать часть</button>
            </>
          )}
        </div>
      )}

      {mode === 'receive' && (
        <div className="form inset">
          <Field label="Сколько внёс"><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label="Способ"><Chips value={method} onChange={setMethod} options={METHODS} /></Field>
          <div className="btn-row">
            <button className="btn primary" disabled={busy || !(+amount > 0)} onClick={() => record('deposit', +amount)}>Сохранить</button>
            <button className="btn ghost" onClick={() => setMode(null)}>Отмена</button>
          </div>
        </div>
      )}

      {mode === 'keep' && (
        <div className="form inset">
          <Field label="Сколько удержать" hint={`Из ${money(d.held)} на руках. Остаток потом вернёте гостю.`}>
            <MoneyInput value={amount} onChange={(v) => setAmount(v === '' ? '' : Math.min(v, d.held))} />
          </Field>
          <Field label="За что"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например, разбита ваза" /></Field>
          <div className="btn-row">
            <button className="btn primary" disabled={busy || !(+amount > 0)} onClick={() => record('deposit_keep', +amount, { note })}>Удержать</button>
            <button className="btn ghost" onClick={() => setMode(null)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
