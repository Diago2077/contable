import type { PostgrestError } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import type { Factura, NotaCredito, NotaCreditoUpdate } from '@/lib/database.types'
import { notaFormAInsert, type NotaCreditoFormState } from '@/lib/notaCredito'
import { eliminarArchivoFactura, subirArchivoFactura } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: NotaCredito[]
  loading: boolean
  error: string | null
}

function mensajeDeError(error: PostgrestError): string {
  if (error.code === '23505') return 'Esta nota de credito ya fue cargada para la factura.'
  if (error.code === '23514') return 'Revisa el CDC (tiene que tener 44 digitos) y que los montos no sean negativos.'
  if (error.code === '23503') return 'La factura ya no existe.'
  return 'No se pudo guardar la nota de credito.'
}

/** Notas de credito de una factura. */
export function useNotasCredito(facturaId: string | undefined) {
  const { user } = useAuth()
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!facturaId) {
      setEstado({ data: [], loading: false, error: null })
      return
    }
    setEstado((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('notas_credito')
      .select('*')
      .eq('factura_id', facturaId)
      .order('fecha_nota', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    setEstado({
      data: (data as NotaCredito[]) ?? [],
      loading: false,
      error: error ? 'No se pudieron cargar las notas de credito.' : null,
    })
  }, [facturaId])

  useEffect(() => {
    refetch()
  }, [refetch])

  /**
   * Sube el archivo (si hay) y crea la nota. Si el insert falla, borra el
   * archivo recien subido para no dejarlo huerfano en Storage.
   */
  async function guardar(
    factura: Pick<Factura, 'id' | 'empresa_id' | 'contribuyente_id'>,
    archivo: File | null,
    form: NotaCreditoFormState,
    extraccionRaw: unknown,
  ) {
    if (!user) return { error: 'Sesion invalida.' }

    let adjunto: { path: string; nombre: string; mime: string } | null = null
    if (archivo) {
      const subida = await subirArchivoFactura(factura.empresa_id, factura.contribuyente_id, archivo, 'nota')
      if ('error' in subida) return { error: subida.error }
      adjunto = subida
    }

    const payload = notaFormAInsert({
      empresaId: factura.empresa_id,
      contribuyenteId: factura.contribuyente_id,
      facturaId: factura.id,
      createdBy: user.id,
      archivoPath: adjunto?.path ?? null,
      archivoNombre: adjunto?.nombre ?? null,
      archivoMime: adjunto?.mime ?? null,
      extraccionRaw,
      form,
    })

    const { error } = await supabase.from('notas_credito').insert(payload)
    if (error) {
      if (adjunto) await eliminarArchivoFactura(adjunto.path)
      return { error: mensajeDeError(error) }
    }
    return { error: null }
  }

  async function actualizar(id: string, payload: NotaCreditoUpdate) {
    const { error } = await supabase.from('notas_credito').update(payload).eq('id', id)
    return { error: error ? mensajeDeError(error) : null }
  }

  async function eliminar(nota: NotaCredito) {
    const { error } = await supabase.from('notas_credito').delete().eq('id', nota.id)
    if (error) return { error: 'No se pudo eliminar la nota de credito.' }
    if (nota.archivo_path) await eliminarArchivoFactura(nota.archivo_path)
    return { error: null }
  }

  return { ...estado, refetch, guardar, actualizar, eliminar }
}
