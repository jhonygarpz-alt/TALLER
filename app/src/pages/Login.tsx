import { useState, type FormEvent } from 'react'
import { BarChart3, Car, Eye, EyeOff, Info, Loader2, Lock, LogIn, Mail, Package, Settings2, User, UserPlus } from 'lucide-react'
import { recordarSesion, setRecordarSesion, supabase } from '../lib/supabase'
import { useEmpresa } from '../lib/empresa'
import { ErrorMsg } from '../components/ui'

const BASE = import.meta.env.BASE_URL

/** Campo con ícono a la izquierda (y acción opcional a la derecha) */
function Campo({ icon: Icon, children, accion }: { icon: typeof User; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="group relative">
      <Icon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-600" />
      {children}
      {accion && <div className="absolute top-1/2 right-2 -translate-y-1/2">{accion}</div>}
    </div>
  )
}
const inputCls = 'w-full rounded-2xl border border-slate-200 bg-white py-3.5 pr-12 pl-12 text-[15px] text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none'

const CAPACIDADES = [
  { icon: Car, label: 'Órdenes de trabajo' },
  { icon: Settings2, label: 'Procesos del taller' },
  { icon: Package, label: 'Inventario' },
  { icon: BarChart3, label: 'Reportes y KPIs' },
]

export default function Login() {
  const emp = useEmpresa()
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [recordar, setRecordar] = useState(recordarSesion)
  const [olvido, setOlvido] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null); setCargando(true)
    if (modo === 'login') {
      setRecordarSesion(recordar)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre }, emailRedirectTo: window.location.origin + BASE } })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Cuenta creada. Confirma tu correo y después inicia sesión. Dirección debe activar tu acceso y asignarte un rol.')
    }
    setCargando(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 px-4 py-8">
      {/* Fondo: taller con auto, degradados y líneas diagonales */}
      <img src={`${BASE}img/banner-taller.webp`} alt="" aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 h-full w-full object-cover object-[70%_50%] opacity-70 lg:w-[72%]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-900/20" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/90 via-transparent to-navy-950/40" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-1/4 left-[8%] h-[150%] w-[3px] rotate-[28deg] bg-gradient-to-b from-transparent via-brand-400/70 to-transparent shadow-[0_0_18px_rgba(61,220,132,.7)]" />
        <div className="absolute -top-1/4 left-[14%] h-[150%] w-[90px] rotate-[28deg] bg-gradient-to-b from-transparent via-brand-500/15 to-transparent blur-xl" />
        <div className="absolute -top-1/3 right-[6%] h-[160%] w-[2px] rotate-[28deg] bg-gradient-to-b from-transparent via-brand-300/50 to-transparent shadow-[0_0_14px_rgba(61,220,132,.6)]" />
        <div className="absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full bg-brand-500/20 blur-3xl" />
      </div>

      {/* Avatar Taller Legaria */}
      <div className="pointer-events-none absolute bottom-0 left-[1%] hidden w-[30%] max-w-[560px] min-w-[300px] select-none lg:block xl:left-[3%]" aria-hidden>
        <div className="absolute inset-x-[15%] bottom-0 h-1/3 rounded-full bg-brand-400/25 blur-3xl" />
        <img src={`${BASE}img/avatar-legaria.webp`} alt="" className="relative mx-auto max-h-[94vh] w-full object-contain object-bottom drop-shadow-[0_10px_30px_rgba(0,0,0,.45)]" />
      </div>

      {/* Tarjeta */}
      <div className="relative w-full max-w-[600px] animate-aparecer lg:ml-[22%] xl:ml-[18%]">
        <div className="rounded-[32px] border border-white/60 bg-white px-6 py-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,.6),0_0_0_1px_rgba(61,220,132,.25),0_0_40px_rgba(29,180,100,.25)] backdrop-blur sm:px-12 sm:py-10">
          {/* Marca */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            {emp.logoUrl
              ? <img src={emp.logoUrl} alt="Taller Legaria" className="h-20 w-20 shrink-0 object-contain mix-blend-multiply sm:h-24 sm:w-24" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white"><Car className="h-9 w-9" /></div>}
            <div className="leading-none">
              <div className="text-2xl font-extrabold tracking-tight text-slate-900 italic sm:text-3xl">Taller</div>
              <div className="bg-gradient-to-r from-brand-800 to-brand-600 bg-clip-text text-4xl font-black tracking-tight text-transparent italic sm:text-5xl">LEGARIA</div>
              <div className="mt-1.5 text-xs font-semibold text-slate-700 sm:text-sm">Centro de Reparación Automotriz</div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-3xl">{modo === 'login' ? 'Iniciar sesión' : 'Solicitar acceso'}</h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">{modo === 'login' ? 'Accede al sistema de gestión del taller' : 'Dirección activará tu acceso y te asignará un rol'}</p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <ErrorMsg error={error} />
            {info && <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{info}</div>}
            {modo === 'registro' && (
              <Campo icon={User}><input className={inputCls} aria-label="Nombre completo" placeholder="Nombre completo" required value={nombre} onChange={e => setNombre(e.target.value)} /></Campo>
            )}
            <Campo icon={modo === 'login' ? User : Mail}>
              <input className={inputCls} type="email" aria-label="Correo" placeholder="Correo electrónico" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </Campo>
            <Campo icon={Lock} accion={
              <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">{ver ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}</button>
            }>
              <input className={inputCls} type={ver ? 'text' : 'password'} aria-label="Contraseña" placeholder="Contraseña" autoComplete={modo === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
            </Campo>

            {modo === 'login' && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2.5 text-slate-700 select-none">
                  <input type="checkbox" checked={recordar} onChange={e => setRecordar(e.target.checked)} className="h-5 w-5 rounded-md accent-brand-600" />
                  Recordar mi sesión
                </label>
                <button type="button" onClick={() => setOlvido(!olvido)} className="font-semibold text-brand-700 transition hover:text-brand-600 hover:underline">¿Olvidaste tu contraseña?</button>
              </div>
            )}
            {modo === 'login' && olvido && (
              <div className="flex gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Pide a <b>Dirección</b> que te asigne una contraseña nueva en <b>Administración → Usuarios → Contraseña</b>. Después podrás entrar con ella.</span>
              </div>
            )}

            <button disabled={cargando}
              className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-3.5 text-lg font-bold text-white shadow-[0_10px_24px_-8px_rgba(18,154,82,.7)] transition hover:-translate-y-0.5 hover:from-brand-800 hover:to-brand-600 hover:shadow-[0_14px_30px_-8px_rgba(18,154,82,.85)] active:translate-y-0 disabled:translate-y-0 disabled:opacity-70">
              {cargando ? <><Loader2 className="h-5 w-5 animate-spin" /> {modo === 'login' ? 'Entrando…' : 'Creando…'}</>
                : modo === 'login' ? <><LogIn className="h-5 w-5 transition group-hover:translate-x-0.5" /> Entrar</> : <><UserPlus className="h-5 w-5" /> Crear cuenta</>}
            </button>
            <button type="button" className="w-full text-center text-sm font-medium text-slate-500 transition hover:text-brand-700" onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(null); setInfo(null) }}>
              {modo === 'login' ? <>¿Eres nuevo? <span className="font-semibold text-brand-700">Solicita acceso</span></> : <>Ya tengo cuenta · <span className="font-semibold text-brand-700">Iniciar sesión</span></>}
            </button>
          </form>

          {/* Capacidades del sistema (solo informativas) */}
          <div className="mt-6 grid grid-cols-4 border-t border-slate-200 pt-5" data-sin-ayuda>
            {CAPACIDADES.map(({ icon: Icon, label }, i) => (
              <div key={label} className={`flex flex-col items-center gap-1.5 px-1 text-center ${i ? 'border-l border-slate-200' : ''}`}>
                <Icon className="h-6 w-6 text-brand-700 sm:h-7 sm:w-7" strokeWidth={1.8} />
                <span className="text-[11px] leading-tight font-medium text-slate-700 sm:text-[13px]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
