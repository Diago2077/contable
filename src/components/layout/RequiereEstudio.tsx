import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/**
 * Bloquea las rutas del estudio (contribuyentes/facturas/plan de cuentas,
 * datos de la empresa) para el super_admin: no tiene `empresa_id`, y para
 * contribuyentes la RLS (es_super_admin() pasa por encima del filtro por
 * empresa) le traeria los datos de TODOS los estudios mezclados sin
 * distinguir a cual pertenece cada uno. El super_admin administra estudios
 * desde /admindrpcs, no tiene uno propio para ver aca.
 */
export default function RequiereEstudio() {
  const { esSuperAdmin } = useAuth()
  if (esSuperAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
