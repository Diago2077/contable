import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { normalizar } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
}

const control =
  'w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Select con buscador, para listas largas (ej. plan de cuentas) donde un <select> nativo es incomodo. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Buscar…',
  vacioLabel = 'Sin categorizar',
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  vacioLabel?: string
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function onClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
        setBusqueda('')
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [abierto])

  const seleccionado = options.find((o) => o.value === value)
  const q = normalizar(busqueda)
  const filtradas = q ? options.filter((o) => normalizar(o.label).includes(q)) : options

  function elegir(v: string) {
    onChange(v)
    setAbierto(false)
    setBusqueda('')
  }

  return (
    <div ref={contenedorRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className={cn(control, 'flex h-9.5 items-center justify-between gap-2 text-left')}
      >
        <span className={cn('truncate', !seleccionado && 'text-muted-foreground')}>
          {seleccionado ? seleccionado.label : vacioLabel}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {abierto && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-md">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-4.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => elegir('')}
              className={cn(
                'block w-full px-3 py-1.5 text-left text-sm hover:bg-accent',
                !value && 'bg-accent/60 font-medium',
              )}
            >
              {vacioLabel}
            </button>
            {filtradas.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados.</p>
            ) : (
              filtradas.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => elegir(o.value)}
                  className={cn(
                    'block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-accent',
                    value === o.value && 'bg-accent/60 font-medium',
                  )}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
