import { useState } from 'react'
import { supabase } from '../lib/db'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError('Неверная почта или пароль')
    setBusy(false)
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <img src="./icon-192.png" alt="" className="login-logo" />
        <h1 className="login-title">rent<b>.kz</b></h1>
        <p className="muted login-sub">Брони, календарь и деньги по вашим квартирам</p>
        <label className="field">
          <span>Почта</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button>
      </form>
    </div>
  )
}
