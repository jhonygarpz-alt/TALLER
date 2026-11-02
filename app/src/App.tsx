import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useAuth } from './lib/auth'
import { AlertasProvider } from './lib/alertas'
import Layout from './components/Layout'
import Login from './pages/Login'
const Inicio = lazy(() => import('./pages/Inicio'))
const Clientes = lazy(() => import('./pages/modulos/Clientes'))
const ClienteDetalle = lazy(() => import('./pages/modulos/ClienteDetalle'))
const Ordenes = lazy(() => import('./pages/modulos/Ordenes'))
const Recepcion = lazy(() => import('./pages/vehiculos/Recepcion'))
const Expediente = lazy(() => import('./pages/expediente/Expediente'))
const Procesos = lazy(() => import('./pages/modulos/Procesos'))
const Inventario = lazy(() => import('./pages/modulos/Inventario'))
const Compras = lazy(() => import('./pages/modulos/Compras'))
const CompraDetalle = lazy(() => import('./pages/compras/CompraDetalle'))
const ManoObra = lazy(() => import('./pages/modulos/ManoObra'))
const Calendario = lazy(() => import('./pages/modulos/Calendario'))
const Costos = lazy(() => import('./pages/modulos/Costos'))
const Facturacion = lazy(() => import('./pages/modulos/Facturacion'))
const Reportes = lazy(() => import('./pages/modulos/Reportes'))
const Administracion = lazy(() => import('./pages/Configuracion'))

/** Enlaces anteriores (antes del rediseño) siguen funcionando */
function Redireccion({ a }: { a: (p: Record<string, string | undefined>) => string }) {
  const params = useParams()
  return <Navigate to={a(params)} replace />
}

export default function App() {
  const { session, perfil, recargar } = useAuth()
  if (!session) return <Login />
  if (!perfil?.activo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="card max-w-md text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-3 text-xl font-bold">Acceso pendiente de activación</h1>
          <p className="mt-2 text-sm text-slate-600">Tu cuenta <b>{session.user.email}</b> fue registrada. Dirección debe activarla y asignarte un rol desde Configuración → Usuarios.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn btn-secondary" onClick={() => recargar()}>Volver a verificar</button>
            <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <AlertasProvider>
      <Suspense fallback={<div className="p-10 text-center text-slate-400">Cargando…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/:id" element={<ClienteDetalle />} />
          <Route path="ordenes" element={<Ordenes />} />
          <Route path="ordenes/nueva" element={<Recepcion />} />
          <Route path="ordenes/:id" element={<Expediente />} />
          <Route path="procesos" element={<Procesos />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="compras" element={<Compras />} />
          <Route path="compras/:id" element={<CompraDetalle />} />
          <Route path="mano-obra" element={<ManoObra />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="costos" element={<Costos />} />
          <Route path="facturacion" element={<Facturacion />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="administracion" element={<Administracion />} />
          <Route path="vehiculos/orden/:id" element={<Redireccion a={p => `/ordenes/${p.id}`} />} />
          <Route path="vehiculos/recepcion" element={<Navigate to="/ordenes/nueva" replace />} />
          <Route path="vehiculos" element={<Navigate to="/ordenes" replace />} />
          <Route path="taller" element={<Navigate to="/procesos" replace />} />
          <Route path="compras/compra/:id" element={<Redireccion a={p => `/compras/${p.id}`} />} />
          <Route path="resultados" element={<Navigate to="/costos" replace />} />
          <Route path="configuracion" element={<Navigate to="/administracion" replace />} />
          <Route path="*" element={<div className="text-slate-500">Página no encontrada</div>} />
        </Route>
      </Routes>
      </Suspense>
    </AlertasProvider>
  )
}
