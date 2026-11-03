import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorMsg, Field } from '../components/ui'
import { Logo } from '../components/Layout'

export default function Login() {
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null); setCargando(true)
    if (modo === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Cuenta creada. Confirma tu correo y después inicia sesión. Dirección debe activar tu acceso y asignarte un rol.')
    }
    setCargando(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 p-4">
      <img src={`${import.meta.env.BASE_URL}img/banner-taller.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900/90 to-navy-800/40" />
      <div className="relative flex w-full max-w-4xl animate-aparecer items-end justify-center gap-2 lg:gap-6">
        <div className="pointer-events-none relative hidden shrink-0 select-none md:block" aria-hidden>
          <div className="absolute -top-2 left-1/2 z-10 w-56 -translate-x-[15%] -translate-y-full rounded-2xl border border-brand-300/70 bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_0_0_1px_rgba(61,220,132,.3),0_0_18px_rgba(29,180,100,.4)]">
            <b className="text-brand-700">¡Bienvenido al taller!</b><br />Entra con tu correo y contraseña para empezar.
            <span className="absolute -bottom-2 left-10 h-4 w-4 rotate-45 border-r border-b border-brand-300/70 bg-white" />
          </div>
          <div className="absolute inset-x-6 bottom-2 h-10 rounded-full bg-brand-400/30 blur-2xl" />
          <img src={`${import.meta.env.BASE_URL}img/avatar-mecanico.webp`} alt="" className="relative h-[440px] w-auto [mask-image:linear-gradient(to_bottom,black_82%,transparent)] drop-shadow-[0_0_22px_rgba(61,220,132,.35)] lg:h-[500px]" />
        </div>
      <div className="relative w-full max-w-sm self-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
          <h1 className="text-xl font-bold">{modo === 'login' ? 'Iniciar sesión' : 'Solicitar acceso'}</h1>
          <ErrorMsg error={error} />
          {info && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{info}</div>}
          {modo === 'registro' && <Field label="Nombre completo"><input className="input" required value={nombre} onChange={e => setNombre(e.target.value)} /></Field>}
          <Field label="Correo"><input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Contraseña"><input className="input" type="password" autoComplete={modo === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></Field>
          <button className="btn btn-primary w-full" disabled={cargando}>{cargando ? 'Procesando…' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
          <button type="button" className="w-full text-center text-sm font-medium text-brand-700 hover:underline" onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}>
            {modo === 'login' ? '¿Eres nuevo? Solicita acceso' : 'Ya tengo cuenta'}
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}
