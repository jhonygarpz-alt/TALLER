import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useAuth } from './lib/auth'
import { AlertasProvider } from './lib/alertas'
import Layout from './components/Layout'
import Login from './pages/Login'
const Inicio = lazy(() => import('./pages/Inicio'))
const Vehiculos = lazy(() => import('./pages/vehiculos/Vehiculos'))
const Recepcion = lazy(() => import('./pages/vehiculos/Recepcion'))
const Expediente = lazy(() => import('./pages/expediente/Expediente'))
const Taller = lazy(() => import('./pages/taller/Taller'))
const Compras = lazy(() => import('./pages/compras/Compras'))
const CompraDetalle = lazy(() => import('./pages/compras/CompraDetalle'))
const Resultados = lazy(() => import('./pages/resultados/Resultados'))
const Configuracion = lazy(() => import('./pages/Configuracion'))

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
          <Route path="vehiculos" element={<Vehiculos />} />
          <Route path="vehiculos/recepcion" element={<Recepcion />} />
          <Route path="vehiculos/orden/:id" element={<Expediente />} />
          <Route path="taller" element={<Taller />} />
          <Route path="compras" element={<Compras />} />
          <Route path="compras/compra/:id" element={<CompraDetalle />} />
          <Route path="resultados" element={<Resultados />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="*" element={<div className="text-slate-500">Página no encontrada</div>} />
        </Route>
      </Routes>
      </Suspense>
    </AlertasProvider>
  )
}
