import { useCallback, useEffect, useState } from 'react'
import type { FacturaConRelaciones, FacturaUpdate, TipoOperacion } from '@/lib/database.types'
import { eliminarArchivoFactura } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

export interface FiltrosFacturas {
  tipoOperacion: TipoOperacion | ''
  planCuentaId: string
  desde: string
  hasta: string
  busqueda: string
}

export const FILTROS_VACIOS: FiltrosFacturas = {
  tipoOperacion: '',
  planCuentaId: '',
  desde: '',
  hasta: '',
  busqueda: '',
}

const POR_PAGINA = 20

interface Estado {
  data: FacturaConRelaciones[]
  total: number
  loading: boolean
  error: string | null
}

/** Filtros y paginacion resueltos server-side: nada de traer todo y filtrar en cliente. */
export function useFacturas(contribuyenteId: string | undefined, filtros: FiltrosFacturas, pagina: number) {
  const [estado, setEstado] = useState<Estado>({ data: [], total: 0, loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!contribuyenteId) return
    setEstado((s) => ({ ...s, loading: true, error: null }))

    let q = supabase
      .from('facturas')
      .select('*, plan_cuentas(id, cuenta, denominacion)', { count: 'exact' })
      .eq('contribuyente_id', contribuyenteId)

    if (filtros.tipoOperacion) q = q.eq('tipo_operacion', filtros.tipoOperacion)
    if (filtros.planCuentaId) q = q.eq('plan_cuenta_id', filtros.planCuentaId)
    if (filtros.desde) q = q.gte('fecha_factura', filtros.desde)
    if (filtros.hasta) q = q.lte('fecha_factura', filtros.hasta)
    if (filtros.busqueda.trim()) {
      const term = filtros.busqueda.trim().replace(/[%,]/g, '')
      q = q.or(
        `numero_factura.ilike.%${term}%,proveedor_nombre.ilike.%${term}%,cliente_nombre.ilike.%${term}%,proveedor_ruc.ilike.%${term}%,cliente_ruc.ilike.%${term}%`,
      )
    }

    const desde = (pagina - 1) * POR_PAGINA
    const { data, error, count } = await q
      .order('fecha_factura', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(desde, desde + POR_PAGINA - 1)

    setEstado({
      data: (data as FacturaConRelaciones[]) ?? [],
      total: count ?? 0,
      loading: false,
      error: error ? 'No se pudieron cargar las facturas.' : null,
    })
  }, [contribuyenteId, filtros, pagina])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function actualizar(id: string, payload: FacturaUpdate) {
    const { error } = await supabase.from('facturas').update(payload).eq('id', id)
    if (error) {
      const duplicada = error.code === '23505'
      return { error: duplicada ? 'Ya existe una factura con ese numero para este proveedor.' : 'No se pudo guardar.' }
    }
    return { error: null }
  }

  /** Borra la fila (los detalles caen por cascade) y despues el archivo de Storage. */
  async function eliminar(factura: FacturaConRelaciones) {
    const { error } = await supabase.from('facturas').delete().eq('id', factura.id)
    if (error) return { error: 'No se pudo eliminar la factura.' }
    if (factura.archivo_path) await eliminarArchivoFactura(factura.archivo_path)
    return { error: null }
  }

  return { ...estado, paginas: Math.max(1, Math.ceil(estado.total / POR_PAGINA)), porPagina: POR_PAGINA, refetch, actualizar, eliminar }
}
