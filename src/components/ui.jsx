import { useEffect } from 'react'
import { num } from '../lib/format'

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  )
}

/** Поле суммы: показывает «150 000», хранит число */
export function MoneyInput({ value, onChange, placeholder = '0', ...rest }) {
  return (
    <div className="money-input">
      <input
        inputMode="numeric"
        value={value === '' || value == null ? '' : num(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '')
          onChange(d === '' ? '' : +d)
        }}
        {...rest}
      />
      <span>₸</span>
    </div>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button type="button" key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips({ value, onChange, options }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o.id} className={'chip' + (value === o.id ? ' on' : '')} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PropertySelect({ properties, value, onChange, allowAll = false, allowCommon = false }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowAll && <option value="">Все квартиры</option>}
      {allowCommon && <option value="">Общий расход</option>}
      {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  )
}

export function Dot({ color }) {
  return <span className="dot" style={{ background: color }} />
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}
