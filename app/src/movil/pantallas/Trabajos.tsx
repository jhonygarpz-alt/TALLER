import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Wrench } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { AREAS, ESTADO_ACTIVIDAD } from '../../lib/format'
import { Barra, Cargando, Vacio } from '../ui'

interface Fila {
  id: number; actividad: string; area: string; estado: string; orden_id: number; fecha_asignacion: string
  tecnicos: { nombre: string } | null
  ordenes: { folio: string; os_bitacora: string | null; vehiculos: { marca: string; modelo: string; placas: string | null } | null } | null
}

/** Trabajos del técnico (los suyos) y, para supervisión, los terminados que esperan validación */
export default function Trabajos() {
  const { perfil, puede } = useAuth()
  const supervisa = puede('actividades.validar') || puede('actividades.asignar')
  const [vista, setVista] = useState<'mios' | 'validar' | 'todos'>('mios')
  const [rows, setRows] = useState<Fila[] | null>(null)
  const [tecIds, setTecIds] = useState<number[] | null>(null)

  useEffect(() => {
    supabase.from('tecnicos').select('id').eq('perfil_id', perfil?.id ?? '').then(({ data }) => {
      const ids = (data ?? []).map(t => t.id); setTecIds(ids)
      if (!ids.length && supervisa) setVista('validar')
    })
  }, [perfil?.id, supervisa])

  useEffect(() => {
    if (tecIds === null) return
    setRows(null)
    let q = supabase.from('actividades').select('id,actividad,area,estado,orden_id,fecha_asignacion,tecnicos(nombre),ordenes(folio,os_bitacora,vehiculos(marca,modelo,placas))').order('fecha_asignacion', { ascending: false }).limit(100)
    if (vista === 'mios') q = q.in('tecnico_id', tecIds.length ? tecIds : [-1]).in('estado', ['asignada', 'en_proceso', 'terminada'])
    else if (vista === 'validar') q = q.eq('estado', 'terminada')
    else q = q.in('estado', ['asignada', 'en_proceso', 'terminada'])
    q.then(({ data }) => setRows((data ?? []) as unknown as Fila[]))
  }, [vista, tecIds])

  const tabs: [typeof vista, string][] = [['mios', 'Míos'], ...(supervisa ? [['validar', 'Por validar'], ['todos', 'Todos']] as [typeof vista, string][] : [])]
  return (
    <div>
      <Barra titulo="Trabajos" sub={vista === 'mios' ? 'Asignados a ti' : vista === 'validar' ? 'Terminados, esperan validación' : 'Pendientes del taller'} />
      {tabs.length > 1 && (
        <div className="px-4 pt-3"><div className="flex gap-1 rounded-2xl bg-slate-200/70 p-1">
          {tabs.map(([id, l]) => <button key={id} onClick={() => setVista(id)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${vista === id ? 'bg-white text-brand-800 shadow' : 'text-slate-500'}`}>{l}</button>)}
        </div></div>
      )}
      <div className="space-y-2.5 px-4 pt-3">
        {!rows ? <Cargando /> : rows.length === 0 ? (
          <Vacio icono={Wrench}>{vista === 'mios' ? (tecIds?.length ? 'No tienes trabajos pendientes' : 'Tu usuario no está ligado a un técnico. Pide a Dirección que lo ligue en Técnicos y tarifas.') : 'No hay trabajos en esta lista'}</Vacio>
        ) : rows.map(a => {
          const est = ESTADO_ACTIVIDAD[a.estado]
          return (
            <Link key={a.id} to={`/orden/${a.orden_id}?tab=trabajos`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 active:bg-slate-50">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Wrench className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{a.actividad}</div>
                <div className="truncate text-sm text-slate-500">{a.ordenes?.folio}{a.ordenes?.os_bitacora && ` · OS ${a.ordenes.os_bitacora}`} · {a.ordenes?.vehiculos?.marca} {a.ordenes?.vehiculos?.modelo} {a.ordenes?.vehiculos?.placas ?? ''}</div>
                <div className="mt-1 flex items-center gap-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${est?.badge}`}>{est?.label}</span><span className="text-slate-400">{AREAS[a.area]}{vista !== 'mios' && a.tecnicos && ` · ${a.tecnicos.nombre}`}</span></div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
