import { useState } from 'react'
import { useData } from '../store'
import { fmtDate, fmtMonth, today } from '../lib/dates'
import { money, EXPENSE_CATEGORIES } from '../lib/format'
import { Field, MoneyInput, Sheet, Chips, Dot, Empty, PropertySelect } from '../components/ui'

const CATS = EXPENSE_CATEGORIES.map((c) => ({ id: c, label: c }))

export default function ExpensesPage() {
  const { data, activeProperties, propertyById } = useData()
  const [edit, setEdit] = useState(null)
  const [pid, setPid] = useState(null)

  const list = data.expenses
    .filter((e) => !pid || e.property_id === pid)
    .sort((a, b) => (a.spent_at < b.spent_at ? 1 : -1))
  const groups = []
  for (const e of list) {
    const m = e.spent_at.slice(0, 7)
    if (!groups.length || groups.at(-1).month !== m) groups.push({ month: m, items: [], total: 0 })
    groups.at(-1).items.push(e)
    groups.at(-1).total += +e.amount
  }

  const blank = () => ({ amount: '', category: 'Коммуналка', property_id: activeProperties.length === 1 ? activeProperties[0].id : null, spent_at: today(), note: '' })

  return (
    <div className="page">
      <div className="page-head">
        <h1>Расходы</h1>
        <button className="btn primary" onClick={() => setEdit(blank())}>+ Расход</button>
      </div>
      {data.properties.length > 1 && (
        <div className="toolbar"><PropertySelect properties={data.properties} value={pid} onChange={setPid} allowAll /></div>
      )}
      {!groups.length && <Empty>Расходов пока нет</Empty>}
      {groups.map((g) => (
        <section className="card" key={g.month}>
          <div className="group-head"><h2>{fmtMonth(g.month + '-01')}</h2><b>{money(g.total)}</b></div>
          <ul className="list">
            {g.items.map((e) => {
              const p = propertyById.get(e.property_id)
              return (
                <li key={e.id} className="clickable" onClick={() => setEdit({ ...e })}>
                  <span className="grow">
                    <b>{e.category}</b>
                    <small>{fmtDate(e.spent_at)} · {p ? <><Dot color={p.color} />{p.name}</> : 'Общий'}{e.note ? ` · ${e.note}` : ''}</small>
                  </span>
                  <b>{money(e.amount)}</b>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {edit && <ExpenseForm value={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function ExpenseForm({ value, onClose }) {
  const { save, remove, notify, activeProperties } = useData()
  const [f, setF] = useState(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))

  async function submit(e) {
    e.preventDefault()
    if (!(+f.amount > 0)) return setErr('Введите сумму')
    setBusy(true); setErr(null)
    try {
      await save('expenses', { id: f.id, amount: +f.amount, category: f.category, property_id: f.property_id || null, spent_at: f.spent_at, note: f.note || null })
      notify('Сохранено')
      onClose()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={f.id ? 'Расход' : 'Новый расход'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid2">
          <Field label="Сумма"><MoneyInput value={f.amount} onChange={(v) => set({ amount: v })} /></Field>
          <Field label="Дата"><input type="date" value={f.spent_at} onChange={(e) => e.target.value && set({ spent_at: e.target.value })} /></Field>
        </div>
        <Field label="Категория"><Chips value={f.category} onChange={(v) => set({ category: v })} options={CATS} /></Field>
        <Field label="Квартира"><PropertySelect properties={activeProperties} value={f.property_id} onChange={(v) => set({ property_id: v })} allowCommon /></Field>
        <Field label="Комментарий"><input value={f.note || ''} onChange={(e) => set({ note: e.target.value })} /></Field>
        {err && <p className="error-text">{err}</p>}
        <button className="btn primary wide" disabled={busy}>Сохранить</button>
        {f.id && (
          <button type="button" className="btn danger wide"
            onClick={async () => { if (confirm('Удалить расход?')) { await remove('expenses', f.id); notify('Удалено'); onClose() } }}>
            Удалить
          </button>
        )}
      </form>
    </Sheet>
  )
}
