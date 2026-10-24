import { supabase } from './supabase'

const BUCKET = 'facturas'
const UNA_HORA = 60 * 60

function extensionDe(mime: string, nombreOriginal: string): string {
  const porMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  if (porMime[mime]) return porMime[mime]
  const ext = nombreOriginal.split('.').pop()
  return ext && ext.length <= 5 ? ext.toLowerCase() : 'bin'
}

/**
 * Sube el archivo ORIGINAL (no la version rasterizada que se le manda a la
 * IA) al bucket privado, bajo {empresa_id}/{contribuyente_id}/... que es lo
 * que la politica de Storage usa para el aislamiento por estudio.
 */
export async function subirArchivoFactura(
  empresaId: string,
  contribuyenteId: string,
  archivo: File,
  /** Distingue de un vistazo, en Storage, a que documento pertenece el archivo. */
  prefijo?: 'nota' | 'pago',
): Promise<{ path: string; nombre: string; mime: string } | { error: string }> {
  const ext = extensionDe(archivo.type, archivo.name)
  const nombreArchivo = `${prefijo ? `${prefijo}-` : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${empresaId}/${contribuyenteId}/${nombreArchivo}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, {
    contentType: archivo.type || undefined,
    upsert: false,
  })

  if (error) return { error: 'No se pudo subir el archivo.' }
  return { path, nombre: archivo.name, mime: archivo.type || 'application/octet-stream' }
}

export async function eliminarArchivoFactura(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

export async function eliminarArchivosFactura(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await supabase.storage.from(BUCKET).remove(paths)
}

/** URL firmada de corta duracion para previsualizar un archivo del bucket privado. */
export async function urlFirmada(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, UNA_HORA)
  return data?.signedUrl ?? null
}
