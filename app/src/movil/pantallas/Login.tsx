import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react'
import { recordarSesion, setRecordarSesion, supabase } from '../../lib/supabase'
import { useEmpresa } from '../../lib/empresa'
import { Aviso } from '../ui'

const BASE = import.meta.env.BASE_URL

export default function LoginMovil() {
  const emp = useEmpresa()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [recordar, setRecordar] = useState(recordarSesion)
  const [olvido, setOlvido] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setError(null); setCargando(true); setRecordarSesion(recordar)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setCargando(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
  }

  const input = 'block w-full rounded-2xl border border-slate-200 bg-white py-4 pr-12 pl-12 text-base shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15'
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-navy-950">
      <img src={`${BASE}img/banner-taller.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-[46vh] w-full object-cover object-[65%_50%] opacity-50" />
      <div className="pointer-events-none absolute inset-0 h-[46vh] bg-gradient-to-b from-navy-950/40 via-navy-950/60 to-navy-950" />
      <div className="relative flex flex-1 flex-col items-center justify-end px-6 pt-[calc(env(safe-area-inset-top)+32px)] pb-6 text-center text-white">
        {emp.logoUrl
          ? <div className="mb-3 h-24 w-24 overflow-hidden rounded-3xl bg-white p-1 shadow-[0_0_24px_rgba(61,220,132,.45)] ring-2 ring-brand-400/60"><img src={emp.logoUrl} alt="" className="h-full w-full object-contain" /></div>
          : <img src={`${BASE}movil/icon-192.png`} alt="" className="mb-3 h-24 w-24 rounded-3xl" />}
        <h1 className="text-2xl font-extrabold tracking-tight">Órdenes de trabajo</h1>
        <p className="text-sm text-emerald-100/75">Recepción, avance y fotos desde tu celular</p>
      </div>
      <form onSubmit={entrar} className="relative space-y-4 rounded-t-[32px] bg-slate-50 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+28px)]">
        <h2 className="text-xl font-bold text-slate-900">Iniciar sesión</h2>
        {error && <Aviso>{error}</Aviso>}
        <div className="relative">
          <Mail className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className={input} type="email" inputMode="email" autoComplete="email" aria-label="Correo" placeholder="Correo electrónico" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="relative">
          <Lock className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className={input} type={ver ? 'text' : 'password'} autoComplete="current-password" aria-label="Contraseña" placeholder="Contraseña" required value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" onClick={() => setVer(!ver)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xl p-2.5 text-slate-400" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}</button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2.5 text-slate-700"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={recordar} onChange={e => setRecordar(e.target.checked)} /> Recordar mi sesión</label>
          <button type="button" className="font-semibold text-brand-700" onClick={() => setOlvido(!olvido)}>¿Olvidaste tu contraseña?</button>
        </div>
        {olvido && <Aviso tipo="info">Pide a <b>Dirección</b> una contraseña nueva (Administración → Usuarios → Contraseña).</Aviso>}
        <button disabled={cargando} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-4 text-lg font-bold text-white shadow-lg shadow-brand-900/30 active:scale-[.98] disabled:opacity-70">
          {cargando ? <><Loader2 className="h-5 w-5 animate-spin" /> Entrando…</> : <><LogIn className="h-5 w-5" /> Entrar</>}
        </button>
        <p className="text-center text-xs text-slate-400">Usa el mismo usuario del sistema web.</p>
      </form>
    </div>
  )
}
