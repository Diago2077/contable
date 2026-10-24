import { useAuth } from './useAuth'
import type { ExtraccionIA, FacturaFormState } from '@/lib/extraccion'
import type { NotaCreditoExtraccion } from '@/lib/notaCredito'
import { formStateADetalles, formStateAFacturaInsert } from '@/lib/extraccion'
import { apiFetch, supabase } from '@/lib/supabase'
import { eliminarArchivoFactura, subirArchivoFactura } from '@/lib/storage'

/** Operaciones de escritura para la carga de facturas: extraer con IA y guardar. */
export function useFacturaAlta() {
  const { user, empresa } = useAuth()

  async function extraerDocumento<T>(
    contribuyenteId: string,
    base64: string,
    mime: string,
    tipoDocumento: 'factura' | 'nota_credito',
  ) {
    try {
      const respuesta = await apiFetch<{ ok: boolean; datos: T }>('/api/extraer', {
        contribuyente_id: contribuyenteId,
        imagen_base64: base64,
        mime_type: mime,
        tipo_documento: tipoDocumento,
      })
      return { datos: respuesta.datos, error: null }
    } catch (e) {
      return { datos: null, error: e instanceof Error ? e.message : 'No se pudo leer el documento.' }
    }
  }

  const extraer = (contribuyenteId: string, base64: string, mime: string) =>
    extraerDocumento<ExtraccionIA>(contribuyenteId, base64, mime, 'factura')

  const extraerNota = (contribuyenteId: string, base64: string, mime: string) =>
    extraerDocumento<NotaCreditoExtraccion>(contribuyenteId, base64, mime, 'nota_credito')

  /**
   * Sube el archivo original y crea la factura + detalles en una transaccion.
   * Si el insert falla (por ejemplo, factura duplicada), borra el archivo
   * recien subido para no dejarlo huerfano en Storage.
   */
  async function guardar(contribuyenteId: string, archivo: File, form: FacturaFormState, extraccionRaw: unknown) {
    if (!empresa || !user) return { error: 'Sesion invalida.' }

    const subida = await subirArchivoFactura(empresa.id, contribuyenteId, archivo)
    if ('error' in subida) return { error: subida.error }

    const payload = formStateAFacturaInsert({
      empresaId: empresa.id,
      contribuyenteId,
      createdBy: user.id,
      archivoPath: subida.path,
      archivoNombre: subida.nombre,
      archivoMime: subida.mime,
      extraccionRaw,
      form,
    })

    const { data: id, error } = await supabase.rpc('crear_factura_con_detalles', {
      factura: payload,
      detalles: formStateADetalles(form),
    })

    if (error) {
      await eliminarArchivoFactura(subida.path)
      const duplicada = error.code === '23505'
      const cdcInvalido = error.code === '23514' && /cdc/i.test(error.message)
      return {
        error: duplicada
          ? 'Esta factura ya fue cargada para este contribuyente.'
          : cdcInvalido
            ? 'El CDC tiene que tener 44 digitos: revisalo o dejalo vacio.'
            : 'No se pudo guardar la factura.',
      }
    }

    return { id: id as string, error: null }
  }

  return { extraer, extraerNota, guardar }
}
