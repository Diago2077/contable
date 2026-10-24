import { Check, ChevronDown, ListFilter, Search } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { normalizar } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Input } from './field'

/**
 * Un solo boton de filtros que despliega un panel con todos. Va dentro del
 * buscador (`soloIcono`), con un numerito con la cantidad de filtros activos.
 * `acciones` es una fila fija debajo de los filtros (p. ej. exportar) y recibe
 * `cerrar` si hace falta plegar el panel antes de abrir otra cosa. Cierra al
 * tocar afuera y con Escape.
 *
 * Mismo componente que usa fastro app, para que las dos pantallas se sientan igual.
 */
export function PanelFiltros({
  activos,
  onLimpiar,
  acciones,
  children,
}: {
  /** Cantidad de filtros distintos del valor por defecto. */
  activos: number
  /** Sin esto no hay "Restablecer filtros". */
  onLimpiar?: () => void
  acciones?: ReactNode | ((cerrar: () => void) => ReactNode)
  children?: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Corrimiento horizontal para que el panel no se salga de la pantalla (celular). */
  const [dx, setDx] = useState(0)
  /** Alto maximo de la zona con scroll: lo que queda de pantalla debajo del panel. */
  const [altoMax, setAltoMax] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!abierto) return
    const acomodar = () => {
      const el = panelRef.current
      if (!el) return
      const margen = 8
      const { left, right } = el.getBoundingClientRect()
      const base = { left: left - dx, right: right - dx }
      let nuevo = 0
      // clientWidth y no innerWidth: en celular un panel desbordado ensancha la ventana
      const ancho = document.documentElement.clientWidth
      if (base.right > ancho - margen) nuevo = ancho - margen - base.right
      if (base.left + nuevo < margen) nuevo = margen - base.left
      if (nuevo !== dx) setDx(nuevo)
      // Lo fijo del panel (pie, acciones, bordes) se mide, no se estima
      const fijo = el.offsetHeight - (scrollRef.current?.offsetHeight ?? 0)
      const libre = document.documentElement.clientHeight - el.getBoundingClientRect().top - fijo - 16
      setAltoMax(Math.max(160, Math.round(libre)))
    }
    acomodar()
    window.addEventListener('resize', acomodar)
    return () => window.removeEventListener('resize', acomodar)
  }, [abierto, dx])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    window.addEventListener('keydown', tecla, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('keydown', tecla, true)
    }
  }, [abierto])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label="Filtros y opciones"
        title="Filtros y opciones"
        onClick={() => setAbierto((a) => !a)}
        className={cn(
          'relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
          (abierto || activos > 0) && 'text-foreground',
        )}
      >
        <ListFilter className="size-4" />
        {activos > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {activos}
          </span>
        )}
      </button>

      {abierto && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Filtros"
          style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
          className="absolute right-0 top-full z-30 mt-3 w-[min(22rem,calc(100vw-1rem))] rounded-lg border border-border bg-card shadow-lg"
        >
          {children && (
            <div
              ref={scrollRef}
              style={altoMax ? { maxHeight: `min(65vh, ${altoMax}px)` } : undefined}
              className="max-h-[65vh] space-y-2.5 overflow-y-auto p-4"
            >
              {children}
            </div>
          )}
          {acciones && (
            <div className={cn('px-4 py-3', children && 'border-t border-border')}>
              {typeof acciones === 'function' ? acciones(() => setAbierto(false)) : acciones}
            </div>
          )}
          <div
            className={cn(
              'flex items-center border-t border-border px-4 py-2.5',
              onLimpiar ? 'justify-between' : 'justify-end',
            )}
          >
            {onLimpiar && (
              <button type="button" onClick={onLimpiar} className="text-xs text-muted-foreground hover:text-foreground">
                Restablecer filtros
              </button>
            )}
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Campo plegable tipo "dropdown": cerrado muestra un resumen de lo elegido;
 * al tocarlo se despliega debajo, empujando el resto del panel.
 */
function Plegable({
  resumen,
  activo,
  children,
}: {
  resumen: string
  activo: boolean
  children: (cerrar: () => void) => ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-card px-3 text-left text-sm shadow-xs transition-colors hover:bg-accent/50',
          activo ? 'border-primary/60 text-foreground' : 'border-input text-muted-foreground',
          abierto && 'border-primary',
        )}
      >
        <span className="truncate">{resumen}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <div className="mt-1.5 overflow-hidden rounded-md border border-border bg-background">
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  )
}

const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Rango de fechas plegable (desde / hasta, ambos inclusivos y opcionales). */
export function RangoFechas({
  label,
  desde,
  hasta,
  onDesde,
  onHasta,
}: {
  label: string
  desde: string
  hasta: string
  onDesde: (v: string) => void
  onHasta: (v: string) => void
}) {
  const resumen =
    desde && hasta
      ? `${fechaCorta(desde)} – ${fechaCorta(hasta)}`
      : desde
        ? `Desde ${fechaCorta(desde)}`
        : hasta
          ? `Hasta ${fechaCorta(hasta)}`
          : `Cualquier ${label.toLowerCase()}`
  return (
    <Plegable resumen={resumen} activo={Boolean(desde || hasta)}>
      {() => (
        <div className="space-y-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-muted-foreground">
              Desde
              <Input type="date" className="mt-1 h-9" value={desde} max={hasta || undefined} onChange={(e) => onDesde(e.target.value)} />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Hasta
              <Input type="date" className="mt-1 h-9" value={hasta} min={desde || undefined} onChange={(e) => onHasta(e.target.value)} />
            </label>
          </div>
          {(desde || hasta) && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  onDesde('')
                  onHasta('')
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </Plegable>
  )
}

/**
 * Una sola opcion entre varias, plegable: elegir una cierra el campo. Con seis
 * o mas opciones suma un buscador (el plan de cuentas puede tener cientos).
 */
export function OpcionUnica<T extends string>({
  label,
  opciones,
  valor,
  porDefecto,
  onChange,
}: {
  label: string
  opciones: { value: T; label: string }[]
  valor: T
  /** Valor inicial: si el elegido es otro, el campo se marca como activo. */
  porDefecto: T
  onChange: (valor: T) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const elegida = opciones.find((o) => o.value === valor)
  const q = normalizar(busqueda)
  const visibles = q ? opciones.filter((o) => normalizar(o.label).includes(q)) : opciones

  return (
    <Plegable resumen={`${label}: ${elegida?.label ?? ''}`} activo={valor !== porDefecto}>
      {(cerrar) => (
        <div role="listbox" aria-label={label}>
          {opciones.length >= 6 && (
            <div className="relative border-b border-border p-1.5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                className="w-full rounded-md border border-input bg-card py-1 pl-7 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto py-1">
            {visibles.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Sin opciones.</p>
            ) : (
              visibles.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={valor === o.value}
                  onClick={() => {
                    onChange(o.value)
                    setBusqueda('')
                    cerrar()
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className={cn(valor === o.value && 'font-medium')}>{o.label}</span>
                  {valor === o.value && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Plegable>
  )
}
