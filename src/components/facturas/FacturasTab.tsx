import { AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Plus, Receipt } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { EditarFacturaModal } from '@/components/facturas/EditarFacturaModal'
import { FacturaDetalleModal } from '@/components/facturas/FacturaDetalleModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Buscador } from '@/components/ui/buscador'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { ConfirmModal } from '@/components/ui/modal'
import { OpcionUnica, PanelFiltros, RangoFechas } from '@/components/ui/panel-filtros'
import { FILTROS_VACIOS, useFacturas, type FiltrosFacturas } from '@/hooks/useFacturas'
import { usePlanCuentas } from '@/hooks/usePlanCuentas'
import { etiquetaEstadoPago, TONO_ESTADO_PAGO } from '@/lib/cobros'
import type { FacturaConRelaciones } from '@/lib/database.types'
import { descargarExcel } from '@/lib/exportarFacturas'
import { formatFecha, formatMontoConMoneda } from '@/lib/format'

export function FacturasTab({ contribuyenteId, razonSocial }: { contribuyenteId: string; razonSocial: string }) {
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

  const { data, total, paginas, loading, error, refetch, actualizar, eliminar, traerParaExportar } = useFacturas(
    contribuyenteId,
    filtros,
    pagina,
  )

  const [modalDetalle, setModalDetalle] = useState<FacturaConRelaciones | null>(null)
  const [modalEditar, setModalEditar] = useState<FacturaConRelaciones | null>(null)
  const [modalEliminar, setModalEliminar] = useState<FacturaConRelaciones | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [exportando, setExportando] = useState(false)

  function actualizarFiltro<K extends keyof FiltrosFacturas>(key: K, valor: FiltrosFacturas[K]) {
    setFiltros((f) => ({ ...f, [key]: valor }))
    setPagina(1)
  }

  const hayFiltrosActivos =
    filtros.tipoOperacion ||
    filtros.planCuentaId ||
    filtros.estadoPago ||
    filtros.desde ||
    filtros.hasta ||
    filtros.busqueda

  // La busqueda por texto no cuenta: es el campo de al lado, no un filtro del panel
  const filtrosActivos =
    [filtros.tipoOperacion, filtros.planCuentaId, filtros.estadoPago].filter(Boolean).length +
    (filtros.desde || filtros.hasta ? 1 : 0)

  /** Exporta TODAS las facturas que cumplen los filtros, no solo la pagina que se ve. */
  async function onExportar() {
    setExportando(true)
    const { data: todas, error: err } = await traerParaExportar()
    if (err) {
      toast.error(err)
    } else if (todas.length === 0) {
      toast.info('No hay facturas para exportar con estos filtros.')
    } else {
      try {
        await descargarExcel(todas, razonSocial)
        toast.success(`${todas.length} ${todas.length === 1 ? 'factura exportada' : 'facturas exportadas'}`)
      } catch {
        toast.error('No se pudo generar el archivo de Excel.')
      }
    }
    setExportando(false)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? 'factura' : 'facturas'}
        </p>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-80 sm:flex-none">
            <Buscador
              valor={busquedaInput}
              onChange={setBusquedaInput}
              placeholder="Buscar por N°, proveedor, cliente, RUC o CDC…"
              accion={
                <PanelFiltros
                  activos={filtrosActivos}
                  onLimpiar={() => {
                    // Restablece los filtros del panel; lo escrito en el buscador se queda
                    setFiltros((f) => ({ ...FILTROS_VACIOS, busqueda: f.busqueda }))
                    setPagina(1)
                  }}
                  acciones={
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Exportar lo que se ve</p>
                      <Button variant="outline" size="sm" onClick={onExportar} disabled={exportando || total === 0}>
                        {exportando ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                        {exportando ? 'Exportando…' : 'Excel'}
                      </Button>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Trae todas las facturas que cumplen los filtros, no solo las de esta pagina.
                      </p>
                    </div>
                  }
                >
                  <OpcionUnica
                    label="Tipo"
                    porDefecto=""
                    valor={filtros.tipoOperacion}
                    onChange={(v) => actualizarFiltro('tipoOperacion', v)}
                    opciones={[
                      { value: '', label: 'Compras y ventas' },
                      { value: 'compra', label: 'Compras' },
                      { value: 'venta', label: 'Ventas' },
                    ]}
                  />
                  <OpcionUnica
                    label="Estado"
                    porDefecto=""
                    valor={filtros.estadoPago}
                    onChange={(v) => actualizarFiltro('estadoPago', v)}
                    opciones={[
                      { value: '', label: 'Todos' },
                      { value: 'pendiente', label: 'Pendientes' },
                      { value: 'parcial', label: 'Parciales' },
                      { value: 'pagada', label: 'Pagadas / cobradas' },
                      { value: 'acreditada', label: 'Acreditadas' },
                    ]}
                  />
                  <OpcionUnica
                    label="Categoria"
                    porDefecto=""
                    valor={filtros.planCuentaId}
                    onChange={(v) => actualizarFiltro('planCuentaId', v)}
                    opciones={[
                      { value: '', label: 'Todas' },
                      ...planCuentas.map((c) => ({ value: c.id, label: `${c.cuenta} — ${c.denominacion}` })),
                    ]}
                  />
                  <RangoFechas
                    label="Fecha de factura"
                    desde={filtros.desde}
                    hasta={filtros.hasta}
                    onDesde={(v) => actualizarFiltro('desde', v)}
                    onHasta={(v) => actualizarFiltro('hasta', v)}
                  />
                </PanelFiltros>
              }
            />
          </div>
          <Link to={`/contribuyentes/${contribuyenteId}/facturas/cargar`}>
            <Button>
              <Plus /> Cargar facturas
            </Button>
          </Link>
        </div>
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
                  <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
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
                      <td
                        className={`px-4 py-2.5 text-right tabular ${f.saldo === 0 ? 'text-muted-foreground' : 'text-foreground'}`}
                      >
                        {formatMontoConMoneda(f.saldo, f.moneda)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tono={TONO_ESTADO_PAGO[f.estado_pago]}>
                          {etiquetaEstadoPago(f.estado_pago, f.tipo_operacion)}
                        </Badge>
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
        onCambio={() => refetch({ silencioso: true })}
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
            {modalEliminar?.proveedor_nombre && <> de {modalEliminar.proveedor_nombre}</>}, junto con su archivo,
            sus notas de credito y sus pagos. Esta accion no se puede deshacer.
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
