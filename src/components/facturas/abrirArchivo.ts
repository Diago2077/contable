import { toast } from 'sonner'
import { urlFirmada } from '@/lib/storage'

/**
 * Abre en otra pestana un archivo del bucket privado, con una URL firmada.
 *
 * La pestana se abre ANTES de pedir la URL: los navegadores solo dejan abrir
 * una ventana nueva como respuesta directa a un click, no despues de esperar
 * a la red, y si no la bloquean como popup.
 */
export async function abrirArchivo(path: string): Promise<void> {
  const ventana = window.open('', '_blank')
  const url = await urlFirmada(path)

  if (!url) {
    ventana?.close()
    toast.error('No se pudo abrir el archivo.')
    return
  }
  if (!ventana) {
    toast.error('El navegador bloqueo la ventana nueva. Permitila para ver el archivo.')
    return
  }
  ventana.opener = null
  ventana.location.href = url
}
