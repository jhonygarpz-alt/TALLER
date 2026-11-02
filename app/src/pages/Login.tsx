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
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre } } })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Cuenta creada. Confirma tu correo y después inicia sesión. Dirección debe activar tu acceso y asignarte un rol.')
    }
    setCargando(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-800 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
          <h1 className="text-xl font-bold">{modo === 'login' ? 'Iniciar sesión' : 'Solicitar acceso'}</h1>
          <ErrorMsg error={error} />
          {info && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{info}</div>}
          {modo === 'registro' && <Field label="Nombre completo"><input className="input" required value={nombre} onChange={e => setNombre(e.target.value)} /></Field>}
          <Field label="Correo"><input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Contraseña"><input className="input" type="password" autoComplete={modo === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></Field>
          <button className="btn btn-primary w-full" disabled={cargando}>{cargando ? 'Procesando…' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
          <button type="button" className="w-full text-center text-sm font-medium text-blue-600 hover:underline" onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}>
            {modo === 'login' ? '¿Eres nuevo? Solicita acceso' : 'Ya tengo cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
