import { useCallback, useEffect, useState } from 'react'
import type { EstadoPago, FacturaConRelaciones, FacturaUpdate, TipoOperacion } from '@/lib/database.types'
import { eliminarArchivosFactura } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

export interface FiltrosFacturas {
  tipoOperacion: TipoOperacion | ''
  planCuentaId: string
  estadoPago: EstadoPago | ''
  desde: string
  hasta: string
  busqueda: string
}

export const FILTROS_VACIOS: FiltrosFacturas = {
  tipoOperacion: '',
  planCuentaId: '',
  estadoPago: '',
  desde: '',
  hasta: '',
  busqueda: '',
}

const POR_PAGINA = 20

/** Tamano de cada tanda al traer todo para exportar: PostgREST corta en 1000 filas por pedido. */
const TANDA_EXPORTACION = 200

interface Estado {
  data: FacturaConRelaciones[]
  total: number
  loading: boolean
  error: string | null
}

/** Lo que hace falta de un query builder para filtrar, sin atarse al tipo exacto del select. */
interface ConFiltros<Q> {
  eq(columna: string, valor: string): Q
  gte(columna: string, valor: string): Q
  lte(columna: string, valor: string): Q
  or(filtros: string): Q
}

/** Los mismos filtros para el listado paginado y para la exportacion completa. */
function aplicarFiltros<Q extends ConFiltros<Q>>(q: Q, filtros: FiltrosFacturas): Q {
  let r = q
  if (filtros.tipoOperacion) r = r.eq('tipo_operacion', filtros.tipoOperacion)
  if (filtros.planCuentaId) r = r.eq('plan_cuenta_id', filtros.planCuentaId)
  if (filtros.estadoPago) r = r.eq('estado_pago', filtros.estadoPago)
  if (filtros.desde) r = r.gte('fecha_factura', filtros.desde)
  if (filtros.hasta) r = r.lte('fecha_factura', filtros.hasta)
  if (filtros.busqueda.trim()) {
    // En la sintaxis de filtros de PostgREST la coma separa condiciones y
    // los parentesis agrupan, asi que un termino que los traiga (por
    // ejemplo "FASTRO (SUC)") corrompe el or() entero. El % es comodin.
    const term = filtros.busqueda.trim().replace(/[%,()]/g, '')
    // El CDC se imprime en grupos de cuatro separados por espacios y en la
    // base esta sin ellos: si lo que se pego son solo digitos y espacios, se
    // juntan para que la busqueda lo encuentre.
    const termCdc = /^[\d\s]+$/.test(term) ? term.replace(/\s+/g, '') : term
    r = r.or(
      `numero_factura.ilike.%${term}%,proveedor_nombre.ilike.%${term}%,cliente_nombre.ilike.%${term}%,proveedor_ruc.ilike.%${term}%,cliente_ruc.ilike.%${term}%,cdc.ilike.%${termCdc}%`,
    )
  }
  return r
}

/** Filtros y paginacion resueltos server-side: nada de traer todo y filtrar en cliente. */
export function useFacturas(contribuyenteId: string | undefined, filtros: FiltrosFacturas, pagina: number) {
  const [estado, setEstado] = useState<Estado>({ data: [], total: 0, loading: true, error: null })

  /**
   * `silencioso` relee sin poner el spinner: se usa cuando algo cambia mientras
   * el detalle de una factura esta abierto, para que la tabla de atras se
   * actualice sin parpadear.
   */
  const refetch = useCallback(
    async (opciones?: { silencioso?: boolean }) => {
    if (!contribuyenteId) return
    if (!opciones?.silencioso) setEstado((s) => ({ ...s, loading: true, error: null }))

    const q = aplicarFiltros(
      supabase
        .from('facturas')
        .select('*, plan_cuentas(id, cuenta, denominacion)', { count: 'exact' })
        .eq('contribuyente_id', contribuyenteId),
      filtros,
    )

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
    },
    [contribuyenteId, filtros, pagina],
  )

  useEffect(() => {
    refetch()
  }, [refetch])

  async function actualizar(id: string, payload: FacturaUpdate) {
    const { error } = await supabase.from('facturas').update(payload).eq('id', id)
    if (error) {
      const cdcInvalido = error.code === '23514' && /cdc/i.test(error.message)
      if (cdcInvalido) return { error: 'El CDC tiene que tener 44 digitos.' }
      const duplicada = error.code === '23505'
      return { error: duplicada ? 'Ya existe una factura con ese numero o ese CDC.' : 'No se pudo guardar.' }
    }
    return { error: null }
  }

  /**
   * Borra la fila (los detalles, notas de credito y pagos caen por cascade) y
   * despues los archivos de Storage. Los de las notas y los pagos hay que
   * juntarlos ANTES: una vez borrada la factura ya no hay forma de saber
   * cuales eran, y quedarian huerfanos ocupando espacio para siempre.
   */
  async function eliminar(factura: FacturaConRelaciones) {
    const [{ data: notas }, { data: pagos }] = await Promise.all([
      supabase.from('notas_credito').select('archivo_path').eq('factura_id', factura.id),
      supabase.from('pagos_factura').select('archivo_path').eq('factura_id', factura.id),
    ])
    const archivos = [
      factura.archivo_path,
      ...((notas as Array<{ archivo_path: string | null }> | null) ?? []).map((n) => n.archivo_path),
      ...((pagos as Array<{ archivo_path: string | null }> | null) ?? []).map((p) => p.archivo_path),
    ].filter((p): p is string => Boolean(p))

    const { error } = await supabase.from('facturas').delete().eq('id', factura.id)
    if (error) return { error: 'No se pudo eliminar la factura.' }
    await eliminarArchivosFactura(archivos)
    return { error: null }
  }

  /**
   * Trae TODAS las facturas que cumplen los filtros (no solo la pagina que se
   * ve), con sus lineas, notas de credito y pagos, para armar el Excel.
   * Ordenadas de la mas vieja a la mas nueva: asi se lee un libro.
   */
  async function traerParaExportar(): Promise<{ data: FacturaConRelaciones[]; error: string | null }> {
    if (!contribuyenteId) return { data: [], error: 'Falta el contribuyente.' }

    const todas: FacturaConRelaciones[] = []
    for (let desde = 0; ; desde += TANDA_EXPORTACION) {
      const q = aplicarFiltros(
        supabase
          .from('facturas')
          .select('*, plan_cuentas(id, cuenta, denominacion), factura_detalles(*), notas_credito(*), pagos_factura(*)')
          .eq('contribuyente_id', contribuyenteId),
        filtros,
      )
      // El id desempata: sin un orden total, dos facturas con la misma fecha
      // y creadas en el mismo instante podrian saltearse o repetirse entre tandas.
      const { data, error } = await q
        .order('fecha_factura', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(desde, desde + TANDA_EXPORTACION - 1)

      if (error) return { data: [], error: 'No se pudieron traer las facturas para exportar.' }
      const tanda = (data as FacturaConRelaciones[]) ?? []
      todas.push(...tanda)
      if (tanda.length < TANDA_EXPORTACION) break
    }
    return { data: todas, error: null }
  }

  return {
    ...estado,
    paginas: Math.max(1, Math.ceil(estado.total / POR_PAGINA)),
    porPagina: POR_PAGINA,
    refetch,
    actualizar,
    eliminar,
    traerParaExportar,
  }
}
