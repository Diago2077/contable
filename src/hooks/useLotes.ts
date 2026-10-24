import { useEffect, useRef, useState } from 'react'

const LOTE = 50

/**
 * Dibujado progresivo para listas largas: muestra `LOTE` filas y suma otro lote
 * cuando el usuario llega al final (el `centinela` entra en pantalla). Renderizar
 * miles de filas de golpe es lo que traba el navegador. Al cambiar `reinicio`
 * (busqueda, filtros, otra lista) vuelve al primer lote.
 *
 * Uso: `const { visibles, centinela } = useLotes(filas.length, busqueda)`,
 * `filas.slice(0, visibles)` y `{centinela && <div ref={centinela} className="h-8" />}`
 * debajo de la tabla.
 */
export function useLotes(total: number, reinicio?: unknown) {
  const [visibles, setVisibles] = useState(LOTE)
  const marca = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibles(LOTE)
  }, [reinicio])

  const quedan = visibles < total

  useEffect(() => {
    const el = marca.current
    if (!el || !quedan) return
    const obs = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting) setVisibles((v) => v + LOTE)
      },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [quedan, visibles])

  return { visibles, centinela: quedan ? marca : null }
}
