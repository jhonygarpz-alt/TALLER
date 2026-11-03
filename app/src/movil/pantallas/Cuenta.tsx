import { CheckCircle2, Download, ExternalLink, LogOut, Share, SquarePlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { ROLES } from '../../lib/format'
import { Barra, botonPrimario, botonSecundario, useInstalar } from '../ui'

export default function Cuenta() {
  const { perfil } = useAuth()
  const { puedeInstalar, instalada, ios, instalar } = useInstalar()
  const iniciales = (perfil?.nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('')
  return (
    <div>
      <Barra titulo="Mi cuenta" />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-extrabold text-white">{iniciales}</span>
          <div className="min-w-0"><div className="truncate text-lg font-bold">{perfil?.nombre}</div><div className="truncate text-sm text-slate-500">{perfil?.email}</div>
            <span className="mt-1 inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">{ROLES[perfil?.rol ?? ''] ?? perfil?.rol}</span></div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <div className="mb-3 font-bold">Instalar en el celular</div>
          {instalada ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> La app ya está instalada en este equipo</div>
          ) : puedeInstalar ? (
            <button className={botonPrimario} onClick={instalar}><Download className="h-5 w-5" /> Instalar app</button>
          ) : ios ? (
            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><span className="font-bold">1.</span> Abre esta página en <b>Safari</b>.</li>
              <li className="flex items-center gap-2"><span className="font-bold">2.</span> Toca <Share className="inline h-4 w-4" /> <b>Compartir</b>.</li>
              <li className="flex items-center gap-2"><span className="font-bold">3.</span> Elige <SquarePlus className="inline h-4 w-4" /> <b>Agregar a inicio</b>.</li>
            </ol>
          ) : (
            <p className="text-sm text-slate-600">En Chrome toca el menú <b>⋮</b> y elige <b>Instalar app</b> (o <b>Agregar a pantalla principal</b>).</p>
          )}
        </div>

        <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer" className={botonSecundario}><ExternalLink className="h-5 w-5" /> Abrir el sistema web completo</a>
        <button className={`${botonSecundario} text-red-600`} onClick={() => confirm('¿Cerrar sesión en este equipo?') && supabase.auth.signOut()}><LogOut className="h-5 w-5" /> Cerrar sesión</button>
        <p className="pt-2 text-center text-xs text-slate-400">Todo lo que registras aquí se guarda al instante en el sistema web.</p>
      </div>
    </div>
  )
}
