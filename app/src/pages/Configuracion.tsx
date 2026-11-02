import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { History, KeyRound, Plus, Settings2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ROLES, errorTexto, fechaHora } from '../lib/format'
import { Badge, Card, Empty, ErrorMsg, PageHeader, SinPermiso, Tabs, useTab } from '../components/ui'

interface Perfil { id: string; email: string; nombre: string; rol: string; activo: boolean; created_at: string }

function Usuarios() {
  const { perfil: yo, recargar } = useAuth()
  const [rows, setRows] = useState<Perfil[]>([])
  const [error, setError] = useState<string | null>(null)
  const cargar = useCallback(() => supabase.from('perfiles').select('*').order('activo').order('nombre').then(({ data }) => setRows((data ?? []) as Perfil[])), [])
  useEffect(() => { cargar() }, [cargar])
  async function actualizar(p: Perfil, campos: Partial<Perfil>) {
    if (p.id === yo?.id && (campos.activo === false || (campos.rol && campos.rol !== 'direccion')) && !confirm('Estás modificando tu propio acceso. ¿Continuar?')) return
    const { error } = await supabase.from('perfiles').update(campos).eq('id', p.id)
    setError(error ? errorTexto(error) : null); cargar(); if (p.id === yo?.id) recargar()
  }
  return (
    <Card title="Usuarios">
      <ErrorMsg error={error} />
      <p className="mb-3 text-sm text-slate-500">Los usuarios se registran desde la pantalla de acceso (“Solicitar acceso”). Aquí Dirección los activa y asigna su rol.</p>
      <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Registro</th></tr></thead>
        <tbody>{rows.map(p => (
          <tr key={p.id}>
            <td className="font-medium">{p.nombre}</td><td className="text-xs">{p.email}</td>
            <td><select className="input w-auto py-1.5" value={p.rol} onChange={e => actualizar(p, { rol: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            <td><button className={`btn btn-sm ${p.activo ? 'btn-success' : 'btn-secondary'}`} onClick={() => actualizar(p, { activo: !p.activo })}>{p.activo ? 'Activo' : 'Inactivo · activar'}</button></td>
            <td className="text-xs">{fechaHora(p.created_at)}</td>
          </tr>))}
        </tbody>
      </table></div>
    </Card>
  )
}

function Permisos() {
  const [permisos, setPermisos] = useState<{ clave: string; modulo: string; descripcion: string }[]>([])
  const [asig, setAsig] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const roles = Object.keys(ROLES).filter(r => r !== 'direccion')
  const cargar = useCallback(async () => {
    const [p, rp] = await Promise.all([supabase.from('permisos').select('*').order('modulo'), supabase.from('rol_permisos').select('*')])
    setPermisos(p.data ?? []); setAsig(new Set((rp.data ?? []).map(x => `${x.rol}|${x.permiso}`)))
  }, [])
  useEffect(() => { cargar() }, [cargar])
  async function toggle(rol: string, permiso: string) {
    const k = `${rol}|${permiso}`
    const { error } = asig.has(k)
      ? await supabase.from('rol_permisos').delete().eq('rol', rol).eq('permiso', permiso)
      : await supabase.from('rol_permisos').insert({ rol, permiso })
    setError(error ? errorTexto(error) : null); cargar()
  }
  let mod = ''
  return (
    <Card title="Permisos por rol">
      <ErrorMsg error={error} />
      <p className="mb-3 text-sm text-slate-500">Dirección tiene todos los permisos. Los cambios aplican de inmediato (el usuario debe recargar la página) y quedan en auditoría. La seguridad se valida en la base de datos, no solo en pantalla.</p>
      <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
        <thead><tr><th>Permiso</th>{roles.map(r => <th key={r} className="text-center">{ROLES[r]}</th>)}</tr></thead>
        <tbody>{permisos.map(p => {
          const cab = p.modulo !== mod; mod = p.modulo
          return [
            cab && <tr key={'m' + p.modulo}><td colSpan={roles.length + 1} className="bg-slate-100 text-xs font-bold text-slate-600 uppercase">{p.modulo}</td></tr>,
            <tr key={p.clave}><td><div className="font-medium">{p.descripcion}</div><div className="font-mono text-[11px] text-slate-400">{p.clave}</div></td>
              {roles.map(r => <td key={r} className="text-center"><input type="checkbox" className="h-5 w-5" checked={asig.has(`${r}|${p.clave}`)} onChange={() => toggle(r, p.clave)} /></td>)}</tr>,
          ]
        })}</tbody>
      </table></div>
    </Card>
  )
}

function Parametros() {
  const { puede } = useAuth()
  const [cfg, setCfg] = useState<{ clave: string; valor: number; descripcion: string }[]>([])
  const [tipos, setTipos] = useState<{ id: number; nombre: string; dias_objetivo: number; activo: boolean; aseguradora_id: number | null; aseguradoras?: { nombre: string } | null }[]>([])
  const [aseg, setAseg] = useState<{ id: number; nombre: string; activo: boolean }[]>([])
  const [ft, setFt] = useState({ nombre: '', dias_objetivo: '', aseguradora_id: '' })
  const [error, setError] = useState<string | null>(null)
  const editar = puede('config.gestionar')
  const cargar = useCallback(() => {
    supabase.from('configuracion').select('*').order('clave').then(({ data }) => setCfg(data ?? []))
    supabase.from('tipos_reparacion').select('*, aseguradoras(nombre)').order('aseguradora_id').order('dias_objetivo').then(({ data }) => setTipos(data ?? []))
    supabase.from('aseguradoras').select('*').order('nombre').then(({ data }) => setAseg(data ?? []))
  }, [])
  useEffect(() => { cargar() }, [cargar])
  async function run(p: PromiseLike<{ error: unknown }>, ok?: () => void) { const { error } = await p; setError(error ? errorTexto(error) : null); if (!error) { ok?.(); cargar() } }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="lg:col-span-2"><ErrorMsg error={error} /></div>
      <Card title="Parámetros y objetivos">
        <ul className="divide-y text-sm">{cfg.map(c => (
          <li key={c.clave} className="flex items-center justify-between gap-3 py-2">
            <span>{c.descripcion}</span>
            <input className="input w-24 text-right" type="number" step="0.1" defaultValue={c.valor} disabled={!editar}
              onBlur={e => Number(e.target.value) !== Number(c.valor) && run(supabase.from('configuracion').update({ valor: Number(e.target.value) }).eq('clave', c.clave))} />
          </li>))}
        </ul>
      </Card>
      <Card title="Plazos por tipo de reparación">
        <p className="mb-2 text-xs text-slate-500">Valores iniciales de ejemplo: ajústalos al convenio vigente con cada aseguradora. Definen la fecha compromiso al recibir un vehículo.</p>
        <ul className="divide-y text-sm">{tipos.map(t => (
          <li key={t.id} className={`flex items-center justify-between gap-2 py-2 ${t.activo ? '' : 'opacity-50'}`}>
            <span><b>{t.nombre}</b> <span className="text-xs text-slate-500">· {t.aseguradoras?.nombre ?? 'Particular'}</span></span>
            <span className="flex items-center gap-2">
              <input className="input w-20 text-right" type="number" min={1} defaultValue={t.dias_objetivo} disabled={!editar} onBlur={e => Number(e.target.value) !== t.dias_objetivo && run(supabase.from('tipos_reparacion').update({ dias_objetivo: Number(e.target.value) }).eq('id', t.id))} /> días
              {editar && <button className="text-xs text-slate-500 hover:underline" onClick={() => run(supabase.from('tipos_reparacion').update({ activo: !t.activo }).eq('id', t.id))}>{t.activo ? 'Desactivar' : 'Activar'}</button>}
            </span>
          </li>))}
        </ul>
        {editar && (
          <form className="mt-3 grid grid-cols-[1fr_9rem_5rem_auto] gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); run(supabase.from('tipos_reparacion').insert({ nombre: ft.nombre, dias_objetivo: Number(ft.dias_objetivo), aseguradora_id: ft.aseguradora_id ? Number(ft.aseguradora_id) : null }), () => setFt({ nombre: '', dias_objetivo: '', aseguradora_id: '' })) }}>
            <input className="input" required placeholder="Tipo de reparación" value={ft.nombre} onChange={e => setFt({ ...ft, nombre: e.target.value })} />
            <select className="input" value={ft.aseguradora_id} onChange={e => setFt({ ...ft, aseguradora_id: e.target.value })}><option value="">Particular</option>{aseg.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
            <input className="input" required type="number" min={1} placeholder="Días" value={ft.dias_objetivo} onChange={e => setFt({ ...ft, dias_objetivo: e.target.value })} />
            <button className="btn btn-primary"><Plus className="h-4 w-4" /></button>
          </form>
        )}
      </Card>
      <Card title="Aseguradoras">
        <ul className="divide-y text-sm">{aseg.map(a => (
          <li key={a.id} className="flex items-center justify-between py-2"><b>{a.nombre}</b>
            <Badge cls={a.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>{a.activo ? 'Habilitada' : 'Deshabilitada'}</Badge></li>))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">El sistema está preparado para varias aseguradoras. Por ahora solo MAPFRE está habilitada; agregar otras queda pendiente de validar las restricciones contractuales vigentes.</p>
      </Card>
    </div>
  )
}

interface Aud { id: number; fecha: string; tabla: string; registro_id: string | null; accion: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null; usuario_id: string | null }
function Auditoria() {
  const [rows, setRows] = useState<Aud[]>([])
  const [usuarios, setUsuarios] = useState<Record<string, string>>({})
  const [tabla, setTabla] = useState('')
  useEffect(() => {
    let q = supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(200)
    if (tabla) q = q.eq('tabla', tabla)
    q.then(({ data }) => setRows((data ?? []) as Aud[]))
    supabase.from('perfiles').select('id,nombre').then(({ data }) => setUsuarios(Object.fromEntries((data ?? []).map(p => [p.id, p.nombre]))))
  }, [tabla])
  const cambios = (a: Aud) => {
    if (a.accion !== 'update' || !a.antes || !a.despues) return null
    return Object.keys(a.despues).filter(k => k !== 'ultima_actualizacion' && JSON.stringify(a.antes![k]) !== JSON.stringify(a.despues![k]))
      .map(k => <div key={k}><span className="font-mono text-slate-500">{k}</span>: <span className="text-red-600 line-through">{JSON.stringify(a.antes![k])}</span> → <span className="text-green-700">{JSON.stringify(a.despues![k])}</span></div>)
  }
  return (
    <Card title="Bitácora de auditoría (últimos 200 registros)">
      <select className="input mb-3 w-auto" value={tabla} onChange={e => setTabla(e.target.value)}>
        <option value="">Todas las tablas</option>
        {['ordenes', 'presupuestos', 'presupuesto_partidas', 'actividades', 'destajos', 'materiales', 'solicitudes_material', 'solicitudes_material', 'compras', 'compra_partidas', 'orden_costos', 'facturas', 'cobros', 'tarifas_destajo', 'perfiles', 'rol_permisos', 'configuracion'].filter((v, i, a) => a.indexOf(v) === i).map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {rows.length === 0 ? <Empty>Sin registros</Empty> : (
        <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Tabla</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>{rows.map(a => (
            <tr key={a.id} className="align-top">
              <td className="text-xs whitespace-nowrap">{fechaHora(a.fecha)}</td><td className="text-xs">{a.usuario_id ? usuarios[a.usuario_id] ?? a.usuario_id.slice(0, 8) : 'Sistema'}</td>
              <td className="font-mono text-xs">{a.tabla} #{a.registro_id}</td><td><Badge cls={a.accion === 'delete' ? 'bg-red-100 text-red-700' : a.accion === 'insert' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>{a.accion}</Badge></td>
              <td className="max-w-xl text-xs">{cambios(a) ?? <span className="text-slate-400">{a.accion === 'transferencia' ? JSON.stringify(a.despues) : 'Registro completo guardado'}</span>}</td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </Card>
  )
}

export default function Configuracion() {
  const { puede } = useAuth()
  const tab = useTab(puede('usuarios.gestionar') ? 'usuarios' : 'parametros')
  if (!puede('usuarios.gestionar') && !puede('config.gestionar') && !puede('auditoria.ver')) return <SinPermiso que="la configuración" />
  return (
    <div>
      <PageHeader title="Configuración" subtitle="Usuarios, permisos, plazos y auditoría" />
      <Tabs tabs={[
        { id: 'usuarios', label: 'Usuarios', icon: Users, hidden: !puede('usuarios.gestionar') },
        { id: 'permisos', label: 'Permisos por rol', icon: KeyRound, hidden: !puede('usuarios.gestionar') },
        { id: 'parametros', label: 'Plazos y parámetros', icon: Settings2, hidden: !puede('config.gestionar') },
        { id: 'auditoria', label: 'Auditoría', icon: History, hidden: !puede('auditoria.ver') },
      ]} />
      {tab === 'usuarios' && puede('usuarios.gestionar') && <Usuarios />}
      {tab === 'permisos' && puede('usuarios.gestionar') && <Permisos />}
      {tab === 'parametros' && puede('config.gestionar') && <Parametros />}
      {tab === 'auditoria' && puede('auditoria.ver') && <Auditoria />}
    </div>
  )
}
