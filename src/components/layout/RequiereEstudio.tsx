import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/**
 * Bloquea las rutas de contribuyentes/facturas/plan de cuentas para el
 * super_admin: no tiene `empresa_id`, y la RLS (es_super_admin() pasa por
 * encima del filtro por empresa) le trae los datos de TODOS los estudios
 * mezclados sin distinguir a cual pertenece cada uno. Esta pantalla es del
 * estudio; el super_admin administra estudios desde /admindrpcs.
 */
export default function RequiereEstudio() {
  const { esSuperAdmin } = useAuth()
  if (esSuperAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
