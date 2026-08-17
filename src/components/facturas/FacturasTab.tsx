import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Receipt, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { EditarFacturaModal } from '@/components/facturas/EditarFacturaModal'
import { FacturaDetalleModal } from '@/components/facturas/FacturaDetalleModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Input, Select } from '@/components/ui/field'
import { ConfirmModal } from '@/components/ui/modal'
import { FILTROS_VACIOS, useFacturas, type FiltrosFacturas } from '@/hooks/useFacturas'
import { usePlanCuentas } from '@/hooks/usePlanCuentas'
import type { FacturaConRelaciones } from '@/lib/database.types'
import { formatFecha, formatMontoConMoneda } from '@/lib/format'

export function FacturasTab({ contribuyenteId }: { contribuyenteId: string }) {
  const { data: planCuentas } = usePlanCuentas(contribuyenteId)

  const [filtros, setFiltros] = useState<FiltrosFacturas>(FILTROS_VACIOS)
  const [busquedaInput, setBusquedaInput] = useState('')
  const [pagina, setPagina] = useState(1)

  // Debounce de la busqueda: no pegarle a la base en cada tecla
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => ({ ...f, busqueda: busquedaInput }))
      setPagina(1)
    }, 350)
    return () => clearTimeout(t)
  }, [busquedaInput])

  const { data, total, paginas, loading, error, refetch, actualizar, eliminar } = useFacturas(
    contribuyenteId,
    filtros,
    pagina,
  )

  const [modalDetalle, setModalDetalle] = useState<FacturaConRelaciones | null>(null)
  const [modalEditar, setModalEditar] = useState<FacturaConRelaciones | null>(null)
  const [modalEliminar, setModalEliminar] = useState<FacturaConRelaciones | null>(null)
  const [eliminando, setEliminando] = useState(false)

  function actualizarFiltro<K extends keyof FiltrosFacturas>(key: K, valor: FiltrosFacturas[K]) {
    setFiltros((f) => ({ ...f, [key]: valor }))
    setPagina(1)
  }

  const hayFiltrosActivos =
    filtros.tipoOperacion || filtros.planCuentaId || filtros.desde || filtros.hasta || filtros.busqueda

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? 'factura' : 'facturas'}
        </p>
        <Link to={`/contribuyentes/${contribuyenteId}/facturas/cargar`}>
          <Button size="sm">
            <Plus /> Cargar facturas
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por N°, proveedor, cliente o RUC…"
            value={busquedaInput}
            onChange={(e) => setBusquedaInput(e.target.value)}
          />
        </div>
        <Select
          className="w-auto"
          value={filtros.tipoOperacion}
          onChange={(e) => actualizarFiltro('tipoOperacion', e.target.value as FiltrosFacturas['tipoOperacion'])}
        >
          <option value="">Compras y ventas</option>
          <option value="compra">Compras</option>
          <option value="venta">Ventas</option>
        </Select>
        <Select
          className="w-auto"
          value={filtros.planCuentaId}
          onChange={(e) => actualizarFiltro('planCuentaId', e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {planCuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.cuenta} — {c.denominacion}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          className="w-auto"
          value={filtros.desde}
          onChange={(e) => actualizarFiltro('desde', e.target.value)}
        />
        <Input
          type="date"
          className="w-auto"
          value={filtros.hasta}
          onChange={(e) => actualizarFiltro('hasta', e.target.value)}
        />
        {hayFiltrosActivos && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFiltros(FILTROS_VACIOS)
              setBusquedaInput('')
              setPagina(1)
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <Cargando />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio
          icono={Receipt}
          titulo={hayFiltrosActivos ? 'Sin resultados' : 'Todavia no hay facturas'}
          descripcion={
            hayFiltrosActivos
              ? 'Probá con otros filtros.'
              : 'Cargá la primera factura de este contribuyente.'
          }
          accion={
            !hayFiltrosActivos && (
              <Link to={`/contribuyentes/${contribuyenteId}/facturas/cargar`}>
                <Button>
                  <Plus /> Cargar facturas
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">N°</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Proveedor / Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((f) => {
                  const totalCalc = f.exentas + f.gravado_5 + f.gravado_10
                  const noCierra = Math.abs(totalCalc - f.total) > 1
                  return (
                    <tr
                      key={f.id}
                      onClick={() => setModalDetalle(f)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">{formatFecha(f.fecha_factura)}</td>
                      <td className="px-4 py-2.5 tabular text-foreground">{f.numero_factura || '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge tono={f.tipo_operacion === 'compra' ? 'primary' : 'success'}>
                          {f.tipo_operacion === 'compra' ? 'Compra' : 'Venta'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {(f.tipo_operacion === 'compra' ? f.proveedor_nombre : f.cliente_nombre) || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {f.plan_cuentas ? `${f.plan_cuentas.cuenta} — ${f.plan_cuentas.denominacion}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="tabular font-medium text-foreground">
                          {formatMontoConMoneda(f.total, f.moneda)}
                        </span>
                        {noCierra && (
                          <AlertTriangle
                            className="ml-1.5 inline size-3.5 text-warning"
                            aria-label="El total no coincide con exentas + gravadas"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {paginas > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className="text-xs text-muted-foreground">
                Pagina {pagina} de {paginas}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={pagina >= paginas}
                onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </>
      )}

      <FacturaDetalleModal
        factura={modalDetalle}
        onCerrar={() => setModalDetalle(null)}
        onEditar={() => {
          setModalEditar(modalDetalle)
          setModalDetalle(null)
        }}
        onEliminar={() => {
          setModalEliminar(modalDetalle)
          setModalDetalle(null)
        }}
      />

      <EditarFacturaModal
        factura={modalEditar}
        planCuentas={planCuentas}
        onCerrar={() => setModalEditar(null)}
        onGuardado={() => {
          setModalEditar(null)
          refetch()
        }}
        actualizar={actualizar}
      />

      <ConfirmModal
        abierto={modalEliminar !== null}
        titulo="Eliminar factura"
        mensaje={
          <>
            Se va a eliminar la factura <strong>{modalEliminar?.numero_factura || 'sin numero'}</strong>
            {modalEliminar?.proveedor_nombre && <> de {modalEliminar.proveedor_nombre}</>}, junto con su archivo.
            Esta accion no se puede deshacer.
          </>
        }
        procesando={eliminando}
        onCancelar={() => setModalEliminar(null)}
        onConfirmar={async () => {
          if (!modalEliminar) return
          setEliminando(true)
          const { error: err } = await eliminar(modalEliminar)
          setEliminando(false)
          if (err) toast.error(err)
          else {
            toast.success('Factura eliminada')
            refetch()
          }
          setModalEliminar(null)
        }}
      />
    </div>
  )
}
