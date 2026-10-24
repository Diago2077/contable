import type { PostgrestError } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import type { Factura, PagoFactura, PagoFacturaUpdate } from '@/lib/database.types'
import { pagoFormAInsert, pagoFormAUpdate, type PagoFormState } from '@/lib/pagoFactura'
import { eliminarArchivoFactura, subirArchivoFactura } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: PagoFactura[]
  loading: boolean
  error: string | null
}

function mensajeDeError(error: PostgrestError): string {
  if (error.code === '23514') return 'Revisa el monto: tiene que ser mayor a cero.'
  if (error.code === '23503') return 'La factura ya no existe.'
  return 'No se pudo guardar.'
}

/** Pagos (o cobros, en una venta) de una factura. */
export function usePagos(facturaId: string | undefined) {
  const { user } = useAuth()
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!facturaId) {
      setEstado({ data: [], loading: false, error: null })
      return
    }
    setEstado((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('pagos_factura')
      .select('*')
      .eq('factura_id', facturaId)
      .order('fecha_pago', { ascending: false })
      .order('created_at', { ascending: false })

    setEstado({
      data: (data as PagoFactura[]) ?? [],
      loading: false,
      error: error ? 'No se pudieron cargar los pagos.' : null,
    })
  }, [facturaId])

  useEffect(() => {
    refetch()
  }, [refetch])

  /**
   * Sube el comprobante (opcional: un pago en efectivo puede no tener) y crea
   * el pago. Si el insert falla, borra el archivo recien subido.
   */
  async function guardar(
    factura: Pick<Factura, 'id' | 'empresa_id' | 'contribuyente_id'>,
    archivo: File | null,
    form: PagoFormState,
  ) {
    if (!user) return { error: 'Sesion invalida.' }

    let adjunto: { path: string; nombre: string; mime: string } | null = null
    if (archivo) {
      const subida = await subirArchivoFactura(factura.empresa_id, factura.contribuyente_id, archivo, 'pago')
      if ('error' in subida) return { error: subida.error }
      adjunto = subida
    }

    const payload = pagoFormAInsert({
      empresaId: factura.empresa_id,
      contribuyenteId: factura.contribuyente_id,
      facturaId: factura.id,
      createdBy: user.id,
      archivoPath: adjunto?.path ?? null,
      archivoNombre: adjunto?.nombre ?? null,
      archivoMime: adjunto?.mime ?? null,
      form,
    })

    const { error } = await supabase.from('pagos_factura').insert(payload)
    if (error) {
      if (adjunto) await eliminarArchivoFactura(adjunto.path)
      return { error: mensajeDeError(error) }
    }
    return { error: null }
  }

  /**
   * Edita los datos del pago. Si se sube un comprobante nuevo reemplaza al
   * anterior, que se borra de Storage una vez que el cambio quedo guardado.
   */
  async function actualizar(pago: PagoFactura, form: PagoFormState, archivoNuevo: File | null) {
    let adjunto: { path: string; nombre: string; mime: string } | null = null
    if (archivoNuevo) {
      const subida = await subirArchivoFactura(pago.empresa_id, pago.contribuyente_id, archivoNuevo, 'pago')
      if ('error' in subida) return { error: subida.error }
      adjunto = subida
    }

    const payload: PagoFacturaUpdate = {
      ...pagoFormAUpdate(form),
      ...(adjunto ? { archivo_path: adjunto.path, archivo_nombre: adjunto.nombre, archivo_mime: adjunto.mime } : {}),
    }
    const { error } = await supabase.from('pagos_factura').update(payload).eq('id', pago.id)
    if (error) {
      if (adjunto) await eliminarArchivoFactura(adjunto.path)
      return { error: mensajeDeError(error) }
    }
    if (adjunto && pago.archivo_path) await eliminarArchivoFactura(pago.archivo_path)
    return { error: null }
  }

  async function eliminar(pago: PagoFactura) {
    const { error } = await supabase.from('pagos_factura').delete().eq('id', pago.id)
    if (error) return { error: 'No se pudo eliminar el pago.' }
    if (pago.archivo_path) await eliminarArchivoFactura(pago.archivo_path)
    return { error: null }
  }

  return { ...estado, refetch, guardar, actualizar, eliminar }
}
