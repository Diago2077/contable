import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Input } from './field'

/** Campo de busqueda. `accion` va a la derecha, dentro del campo (p. ej. el boton de filtros). */
export function Buscador({
  valor,
  onChange,
  placeholder,
  accion,
}: {
  valor: string
  onChange: (v: string) => void
  placeholder: string
  accion?: ReactNode
}) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className={accion ? 'pl-9 pr-11' : 'pl-9'}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      {accion && <div className="absolute right-1.5 top-1/2 z-30 -translate-y-1/2">{accion}</div>}
    </div>
  )
}
