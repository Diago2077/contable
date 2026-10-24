import { Plus, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContribuyenteFormModal } from '@/components/contribuyentes/ContribuyenteFormModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Input, Select } from '@/components/ui/field'
import { useContribuyentes } from '@/hooks/useContribuyentes'
import { useLotes } from '@/hooks/useLotes'
import { formatRuc, normalizar } from '@/lib/format'

type FiltroEstado = 'todos' | 'activos' | 'inactivos'

export default function Contribuyentes() {
  const { data, loading, error, refetch } = useContribuyentes()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('activos')
  const [modalAbierto, setModalAbierto] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    return data.filter((c) => {
      if (filtroEstado === 'activos' && !c.activo) return false
      if (filtroEstado === 'inactivos' && c.activo) return false
      if (!q) return true
      return (
        normalizar(c.razon_social).includes(q) ||
        normalizar(c.nombre_fantasia ?? '').includes(q) ||
        normalizar(c.ruc).includes(q)
      )
    })
  }, [data, busqueda, filtroEstado])
  const { visibles, centinela } = useLotes(filtrados.length, `${busqueda}|${filtroEstado}`)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Contribuyentes</h1>
          <p className="text-sm text-muted-foreground">Los clientes del estudio.</p>
        </div>
        <Button onClick={() => setModalAbierto(true)}>
          <Plus /> Nuevo contribuyente
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por RUC o razon social…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select
          className="w-auto"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
        >
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </Select>
      </div>

      {loading ? (
        <Cargando />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : filtrados.length === 0 ? (
        <Vacio
          icono={Users}
          titulo={data.length === 0 ? 'Todavia no hay contribuyentes' : 'Sin resultados'}
          descripcion={
            data.length === 0
              ? 'Crea el primer contribuyente para empezar a cargar sus facturas.'
              : 'Probá con otra busqueda o cambiá el filtro.'
          }
          accion={
            data.length === 0 && (
              <Button onClick={() => setModalAbierto(true)}>
                <Plus /> Nuevo contribuyente
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Razon social</th>
                <th className="px-4 py-2.5 font-medium">RUC</th>
                <th className="px-4 py-2.5 font-medium">Regimen</th>
                <th className="px-4 py-2.5 font-medium">Ciudad</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, visibles).map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/contribuyentes/${c.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground">{c.razon_social}</p>
                    {c.nombre_fantasia && (
                      <p className="text-xs text-muted-foreground">{c.nombre_fantasia}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular text-muted-foreground">{formatRuc(c.ruc)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.regimen || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.ciudad || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tono={c.activo ? 'success' : 'neutral'}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {centinela && <div ref={centinela} className="h-8" />}
        </div>
      )}

      <ContribuyenteFormModal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false)
          refetch()
        }}
      />
    </div>
  )
}
