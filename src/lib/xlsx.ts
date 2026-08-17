/**
 * Lee la primera hoja de un .xlsx y la devuelve como filas de strings, igual
 * que parseCsv -- asi el resto del codigo de importacion no le importa de
 * donde vino el archivo. Import dinamico: la libreria pesa bastante y solo
 * hace falta cuando alguien efectivamente elige un .xlsx.
 */
export async function parseXlsx(archivo: File): Promise<string[][]> {
  const XLSX = await import('xlsx')
  const buffer = await archivo.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array' })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  if (!hoja) return []

  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: '' })
  return filas
    .map((fila) => fila.map((valor) => (valor === null || valor === undefined ? '' : String(valor).trim())))
    .filter((fila) => fila.some((valor) => valor !== ''))
}
