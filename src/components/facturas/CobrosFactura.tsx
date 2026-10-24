import { Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando } from '@/components/ui/estado'
import { ConfirmModal } from '@/components/ui/modal'
import { useNotasCredito } from '@/hooks/useNotasCredito'
import { usePagos } from '@/hooks/usePagos'
import { calcularCobros, etiquetaEstadoPago, terminosDePago, TONO_ESTADO_PAGO } from '@/lib/cobros'
import { MEDIOS_PAGO, type FacturaConRelaciones, type NotaCredito, type PagoFactura } from '@/lib/database.types'
import { formatFecha, formatMonto, formatMontoConMoneda } from '@/lib/format'
import { cn } from '@/lib/utils'
import { abrirArchivo } from './abrirArchivo'
import { NotaCreditoModal } from './NotaCreditoModal'
import { PagoModal } from './PagoModal'

const suma = (valores: number[]) => valores.reduce((acc, v) => acc + v, 0)

/**
 * Estado de cuenta de una factura, con sus notas de credito y sus pagos.
 *
 * Los totales se calculan a partir de las listas que se acaban de leer, no
 * de las columnas de la factura que vino con el listado: esas quedan viejas
 * apenas se carga una nota o un pago, y el detalle tiene que reflejarlo en
 * el momento. Mientras las listas cargan se usan las de la base.
 */
export function CobrosFactura({
  factura,
  onCambio,
}: {
  factura: FacturaConRelaciones
  /** Avisa que algo cambio, para que el listado de atras se vuelva a pedir. */
  onCambio: () => void
}) {
  const notas = useNotasCredito(factura.id)
  const pagos = usePagos(factura.id)
  const termino = terminosDePago(factura.tipo_operacion)

  const [notaAbierta, setNotaAbierta] = useState<NotaCredito | 'nueva' | null>(null)
  const [pagoAbierto, setPagoAbierto] = useState<PagoFactura | 'nuevo' | null>(null)
  const [notaAEliminar, setNotaAEliminar] = useState<NotaCredito | null>(null)
  const [pagoAEliminar, setPagoAEliminar] = useState<PagoFactura | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const cargando = notas.loading || pagos.loading
  const totalNotas = cargando ? factura.notas_credito_total : suma(notas.data.map((n) => n.total))
  const totalPagado = cargando ? factura.pagado_total : suma(pagos.data.map((p) => p.monto))
  const cobros = calcularCobros(factura.total, totalNotas, totalPagado)

  // Al editar, lo propio de esa nota/pago no cuenta contra si misma
  const notaEnEdicion = notaAbierta && notaAbierta !== 'nueva' ? notaAbierta : null
  const pagoEnEdicion = pagoAbierto && pagoAbierto !== 'nuevo' ? pagoAbierto : null
  const sinAcreditar = factura.total - totalNotas + (notaEnEdicion?.total ?? 0)
  const saldoParaPago = cobros.saldo + (pagoEnEdicion?.monto ?? 0)

  async function despuesDeCambio() {
    await Promise.all([notas.refetch(), pagos.refetch()])
    onCambio()
  }

  async function confirmarEliminar() {
    setEliminando(true)
    const { error } = notaAEliminar ? await notas.eliminar(notaAEliminar) : await pagos.eliminar(pagoAEliminar!)
    setEliminando(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success(notaAEliminar ? 'Nota de credito eliminada' : `${termino.singular[0].toUpperCase()}${termino.singular.slice(1)} eliminado`)
      await despuesDeCambio()
    }
    setNotaAEliminar(null)
    setPagoAEliminar(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">Estado de cuenta ({factura.moneda})</p>
          <Badge tono={TONO_ESTADO_PAGO[cobros.estado]}>{etiquetaEstadoPago(cobros.estado, factura.tipo_operacion)}</Badge>
        </div>
        <div className="space-y-1.5 rounded-md border border-border bg-secondary/30 p-3 text-sm">
          <FilaCuenta label="Total de la factura" valor={formatMonto(factura.total, factura.moneda)} />
          {totalNotas > 0 && (
            <FilaCuenta label="Notas de credito" valor={`− ${formatMonto(totalNotas, factura.moneda)}`} />
          )}
          {totalPagado > 0 && (
            <FilaCuenta
              label={factura.tipo_operacion === 'venta' ? 'Cobrado' : 'Pagado'}
              valor={`− ${formatMonto(totalPagado, factura.moneda)}`}
            />
          )}
          <div className="my-1 border-t border-border" />
          <FilaCuenta
            label="Saldo"
            valor={formatMonto(cobros.saldo, factura.moneda)}
            destacado
            negativo={cobros.saldo < 0}
          />
        </div>
      </div>

      <Seccion
        titulo="Notas de credito"
        accion={
          <Button variant="outline" size="sm" onClick={() => setNotaAbierta('nueva')}>
            <Plus /> Agregar nota
          </Button>
        }
      >
        {notas.loading ? (
          <Cargando texto="Cargando notas…" className="py-4" />
        ) : notas.data.length === 0 ? (
          <Vacia texto="Esta factura no tiene notas de credito." />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {notas.data.map((n) => (
              <Fila
                key={n.id}
                titulo={n.numero_nota || 'Sin numero'}
                fecha={n.fecha_nota}
                detalle={n.motivo}
                monto={`− ${formatMontoConMoneda(n.total, factura.moneda)}`}
                archivo={n.archivo_path}
                onEditar={() => setNotaAbierta(n)}
                onEliminar={() => setNotaAEliminar(n)}
              />
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        titulo={factura.tipo_operacion === 'venta' ? 'Cobros' : 'Pagos'}
        accion={
          <Button variant="outline" size="sm" onClick={() => setPagoAbierto('nuevo')}>
            <Plus /> {termino.registrar}
          </Button>
        }
      >
        {pagos.loading ? (
          <Cargando texto={`Cargando ${termino.plural}…`} className="py-4" />
        ) : pagos.data.length === 0 ? (
          <Vacia texto={`Todavia no hay ${termino.plural} registrados.`} />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {pagos.data.map((p) => (
              <Fila
                key={p.id}
                titulo={MEDIOS_PAGO.find((m) => m.value === p.medio_pago)?.label ?? p.medio_pago}
                fecha={p.fecha_pago}
                detalle={[p.entidad, p.referencia].filter(Boolean).join(' · ') || null}
                monto={formatMontoConMoneda(p.monto, factura.moneda)}
                archivo={p.archivo_path}
                onEditar={() => setPagoAbierto(p)}
                onEliminar={() => setPagoAEliminar(p)}
              />
            ))}
          </ul>
        )}
      </Seccion>

      <NotaCreditoModal
        abierto={notaAbierta !== null}
        factura={factura}
        nota={notaEnEdicion}
        sinAcreditar={sinAcreditar}
        onCerrar={() => setNotaAbierta(null)}
        onGuardado={() => {
          setNotaAbierta(null)
          despuesDeCambio()
        }}
        guardar={notas.guardar}
        actualizar={notas.actualizar}
      />

      {pagoAbierto !== null && (
        <PagoModal
          abierto
          factura={factura}
          pago={pagoEnEdicion}
          saldo={saldoParaPago}
          onCerrar={() => setPagoAbierto(null)}
          onGuardado={() => {
            setPagoAbierto(null)
            despuesDeCambio()
          }}
          guardar={pagos.guardar}
          actualizar={pagos.actualizar}
        />
      )}

      <ConfirmModal
        abierto={notaAEliminar !== null || pagoAEliminar !== null}
        titulo={notaAEliminar ? 'Eliminar nota de credito' : `Eliminar ${termino.singular}`}
        mensaje={
          notaAEliminar ? (
            <>
              Se va a eliminar la nota <strong>{notaAEliminar.numero_nota || 'sin numero'}</strong> de{' '}
              {formatMontoConMoneda(notaAEliminar.total, factura.moneda)}, junto con su archivo. El saldo de la
              factura sube en ese monto.
            </>
          ) : (
            <>
              Se va a eliminar el {termino.singular} de{' '}
              <strong>{pagoAEliminar ? formatMontoConMoneda(pagoAEliminar.monto, factura.moneda) : ''}</strong>, junto
              con su comprobante. El saldo de la factura sube en ese monto.
            </>
          )
        }
        procesando={eliminando}
        onCancelar={() => {
          setNotaAEliminar(null)
          setPagoAEliminar(null)
        }}
        onConfirmar={confirmarEliminar}
      />
    </div>
  )
}

function Seccion({
  titulo,
  accion,
  children,
}: {
  titulo: string
  accion: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
        {accion}
      </div>
      {children}
    </div>
  )
}

function Vacia({ texto }: { texto: string }) {
  return <p className="text-xs text-muted-foreground">{texto}</p>
}

function FilaCuenta({
  label,
  valor,
  destacado,
  negativo,
}: {
  label: string
  valor: string
  destacado?: boolean
  negativo?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={cn('text-muted-foreground', destacado && 'font-medium text-foreground')}>{label}</span>
      <span className={cn('tabular', destacado && 'text-base font-semibold text-foreground', negativo && 'text-warning')}>
        {valor}
      </span>
    </div>
  )
}

function Fila({
  titulo,
  fecha,
  detalle,
  monto,
  archivo,
  onEditar,
  onEliminar,
}: {
  titulo: string
  fecha: string | null
  detalle: string | null
  monto: string
  archivo: string | null
  onEditar: () => void
  onEliminar: () => void
}) {
  return (
    <li className="flex items-start gap-1 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="text-foreground">
          <span className="break-words">{titulo}</span>{' '}
          <span className="whitespace-nowrap text-muted-foreground">· {formatFecha(fecha)}</span>
        </p>
        {detalle && <p className="truncate text-xs text-muted-foreground">{detalle}</p>}
        {/* En pantallas chicas el monto va debajo: a la derecha no queda lugar entre los botones */}
        <p className="tabular font-medium text-foreground sm:hidden">{monto}</p>
      </div>
      <span className="tabular hidden shrink-0 self-center font-medium text-foreground sm:block">{monto}</span>
      <div className="flex shrink-0 items-center self-center">
        <Button
          variant="ghost"
          size="icon"
          title={archivo ? 'Ver archivo' : 'Sin archivo adjunto'}
          disabled={!archivo}
          onClick={() => archivo && abrirArchivo(archivo)}
        >
          <Paperclip />
        </Button>
        <Button variant="ghost" size="icon" title="Editar" onClick={onEditar}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" title="Eliminar" onClick={onEliminar}>
          <Trash2 className="text-destructive" />
        </Button>
      </div>
    </li>
  )
}
