import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Rasteriza la primera pagina de un PDF a un data URL JPEG, para mandarla a
 * la IA de vision (que no lee PDFs). El archivo ORIGINAL se sube a Storage
 * tal cual, asi que un PDF de varias paginas no pierde informacion: solo se
 * analiza la primera con la IA.
 *
 * Se devuelve tambien la cantidad de paginas para poder avisarle al usuario
 * cuando subio un PDF de varias y solo se leyo una.
 */
export async function pdfAPrimeraPagina(
  archivo: File,
  ladoMaximo: number,
  calidad: number,
): Promise<{ dataUrl: string; paginas: number }> {
  const buffer = await archivo.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pagina = await pdf.getPage(1)

  // La escala se elige para que el lado mas largo quede en ladoMaximo:
  // renderizar mas grande no mejora lo que la IA llega a leer (reescala
  // igual) y solo suma peso al request.
  const base = pagina.getViewport({ scale: 1 })
  const escala = ladoMaximo / Math.max(base.width, base.height)
  const viewport = pagina.getViewport({ scale: escala })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('No se pudo preparar el canvas para el PDF.')

  // Un PDF rasterizado no tiene fondo: sin esto el JPEG lo rellena de negro.
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, canvas.width, canvas.height)

  await pagina.render({ canvasContext: contexto, viewport, canvas }).promise
  return { dataUrl: canvas.toDataURL('image/jpeg', calidad), paginas: pdf.numPages }
}
