import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Button } from './button'

/**
 * Modales abiertos, del mas viejo al de arriba. Hace falta porque se pueden
 * apilar (el detalle de una factura abre el formulario de un pago) y el
 * Escape tiene que cerrar solo el de arriba, no todos a la vez.
 */
const pila: symbol[] = []

export function Modal({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
  footer,
  ancho = 'max-w-lg',
}: {
  abierto: boolean
  titulo: string
  descripcion?: string
  onCerrar: () => void
  children: ReactNode
  footer?: ReactNode
  ancho?: string
}) {
  // El efecto de abajo no depende de onCerrar a proposito: casi todos los
  // padres le pasan una funcion nueva en cada render, y volver a registrar el
  // modal en la pila lo mandaria al final, por encima de uno que se abrio despues.
  const cerrarRef = useRef(onCerrar)
  useEffect(() => {
    cerrarRef.current = onCerrar
  })

  // Escape cierra (solo el de arriba), y el body no scrollea detras del modal
  useEffect(() => {
    if (!abierto) return
    const id = Symbol('modal')
    pila.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pila[pila.length - 1] === id) cerrarRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      pila.splice(pila.indexOf(id), 1)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto])

  if (!abierto) return null

  // Va a document.body y no donde se declaro: el overlay tiene backdrop-blur, y
  // un ancestro con backdrop-filter pasa a ser el bloque contenedor de sus hijos
  // `fixed`. Un modal abierto desde adentro de otro quedaba anclado al contenido
  // que scrollea y se perdia fuera de pantalla.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn('w-full rounded-lg border border-border bg-card shadow-xl', ancho)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
            {descripcion && (
              <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar">
            <X />
          </Button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Confirmacion para acciones destructivas. */
export function ConfirmModal({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Eliminar',
  procesando = false,
  onConfirmar,
  onCancelar,
}: {
  abierto: boolean
  titulo: string
  mensaje: ReactNode
  textoConfirmar?: string
  procesando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCancelar}
      ancho="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirmar} disabled={procesando}>
            {procesando ? 'Eliminando…' : textoConfirmar}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted-foreground">{mensaje}</div>
    </Modal>
  )
}
