import { ExternalLink, FileText, Pencil, Trash2, ZoomIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando } from '@/components/ui/estado'
import { ImageLightbox } from '@/components/ui/image-lightbox'
import { Modal } from '@/components/ui/modal'
import type { FacturaConRelaciones, FacturaDetalle } from '@/lib/database.types'
import { formatFecha, formatMonto, formatMontoConMoneda, formatRuc } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { urlFirmada } from '@/lib/storage'
import { cn } from '@/lib/utils'

export function FacturaDetalleModal({
  factura,
  onCerrar,
  onEditar,
  onEliminar,
}: {
  factura: FacturaConRelaciones | null
  onCerrar: () => void
  onEditar: () => void
  onEliminar: () => void
}) {
  const [urlArchivo, setUrlArchivo] = useState<string | null>(null)
  const [detalles, setDetalles] = useState<FacturaDetalle[]>([])
  const [cargandoDetalles, setCargandoDetalles] = useState(false)
  const [lightboxAbierto, setLightboxAbierto] = useState(false)

  const esImagen = (factura?.archivo_mime ?? '').startsWith('image/')

  useEffect(() => {
    if (!factura) {
      setUrlArchivo(null)
      setDetalles([])
      return
    }

    setUrlArchivo(null)
    if (factura.archivo_path) urlFirmada(factura.archivo_path).then(setUrlArchivo)

    let cancelado = false
    setCargandoDetalles(true)
    supabase
      .from('factura_detalles')
      .select('*')
      .eq('factura_id', factura.id)
      .order('orden', { ascending: true })
      .then(({ data }) => {
        if (cancelado) return
        setDetalles((data as FacturaDetalle[]) ?? [])
        setCargandoDetalles(false)
      })
    return () => {
      cancelado = true
    }
  }, [factura])

  if (!factura) return null

  const totalCalc = factura.exentas + factura.gravado_5 + factura.gravado_10
  const noCierra = Math.abs(totalCalc - factura.total) > 1

  return (
    <>
      <Modal
        abierto={factura !== null}
        titulo="Detalle de factura"
        onCerrar={onCerrar}
        ancho="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={onEliminar}>
              <Trash2 className="text-destructive" /> Eliminar
            </Button>
            <Button onClick={onEditar}>
              <Pencil /> Editar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* Archivo: imagen con zoom, o link si es PDF */}
          <div className="lg:w-64 lg:shrink-0">
            {esImagen && urlArchivo ? (
              <div className="space-y-2">
                <button
                  onClick={() => setLightboxAbierto(true)}
                  className="group relative block w-full overflow-hidden rounded-md border border-border"
                >
                  <img src={urlArchivo} alt={factura.archivo_nombre ?? ''} className="w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                    <ZoomIn className="size-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
                <Button variant="outline" className="w-full" onClick={() => setLightboxAbierto(true)}>
                  <ZoomIn /> Ver factura completa
                </Button>
              </div>
            ) : factura.archivo_path ? (
              <a
                href={urlArchivo ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/40 px-4 py-8 text-center hover:bg-secondary/70"
              >
                <FileText className="size-8 text-muted-foreground" />
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <ExternalLink className="size-3.5" /> Ver archivo original
                </span>
              </a>
            ) : (
              <div className="flex items-center justify-center rounded-md border border-dashed border-border bg-secondary/40 px-4 py-8 text-center text-xs text-muted-foreground">
                Sin archivo adjunto
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tono={factura.tipo_operacion === 'compra' ? 'primary' : 'success'}>
                  {factura.tipo_operacion === 'compra' ? 'Compra' : 'Venta'}
                </Badge>
                <h2 className="text-base font-semibold text-foreground">
                  {factura.numero_factura || 'Sin numero'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">{formatFecha(factura.fecha_factura)}</p>
            </div>

            <FilaDatos
              filas={[
                ['Timbrado', factura.timbrado],
                ['Vencimiento timbrado', formatFecha(factura.timbrado_vencimiento)],
                ['Condicion de venta', factura.condicion_venta === 'contado' ? 'Contado' : factura.condicion_venta === 'credito' ? 'Credito' : null],
                ['Forma de pago', factura.forma_pago],
                ['Categoria', factura.plan_cuentas ? `${factura.plan_cuentas.codigo} — ${factura.plan_cuentas.descripcion}` : null],
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Proveedor</p>
                <p className="text-sm text-foreground">{factura.proveedor_nombre || '—'}</p>
                <p className="text-xs text-muted-foreground">{formatRuc(factura.proveedor_ruc)}</p>
                {factura.proveedor_direccion && (
                  <p className="text-xs text-muted-foreground">{factura.proveedor_direccion}</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Cliente</p>
                <p className="text-sm text-foreground">{factura.cliente_nombre || '—'}</p>
                <p className="text-xs text-muted-foreground">{formatRuc(factura.cliente_ruc)}</p>
                {factura.cliente_direccion && (
                  <p className="text-xs text-muted-foreground">{factura.cliente_direccion}</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Montos ({factura.moneda})</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border bg-secondary/30 p-3 text-sm">
                <MontoFila label="Exentas" valor={factura.exentas} moneda={factura.moneda} />
                <MontoFila label="Gravadas 5%" valor={factura.gravado_5} moneda={factura.moneda} />
                <MontoFila label="IVA 5%" valor={factura.iva_5} moneda={factura.moneda} />
                <MontoFila label="Gravadas 10%" valor={factura.gravado_10} moneda={factura.moneda} />
                <MontoFila label="IVA 10%" valor={factura.iva_10} moneda={factura.moneda} />
                <MontoFila label="IVA total" valor={factura.iva_total} moneda={factura.moneda} />
                <div className="col-span-2 my-1 border-t border-border" />
                <MontoFila label="Total" valor={factura.total} moneda={factura.moneda} destacado />
              </div>
              {noCierra && (
                <p className="mt-1.5 text-xs text-warning">
                  El total no coincide con exentas + gravadas ({formatMontoConMoneda(totalCalc, factura.moneda)}).
                </p>
              )}
            </div>

            {factura.observaciones && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Observaciones</p>
                <p className="text-sm text-foreground">{factura.observaciones}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Lineas de detalle</p>
              {cargandoDetalles ? (
                <Cargando texto="Cargando lineas…" className="py-4" />
              ) : detalles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Esta factura no tiene lineas de detalle cargadas.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Descripcion</th>
                        <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                        <th className="px-3 py-2 text-right font-medium">Precio unit.</th>
                        <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalles.map((d) => (
                        <tr key={d.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-foreground">{d.descripcion || '—'}</td>
                          <td className="px-3 py-2 text-right tabular text-foreground">
                            {d.cantidad ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular text-foreground">
                            {d.precio_unitario !== null ? formatMonto(d.precio_unitario, factura.moneda) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular text-foreground">
                            {d.subtotal_linea !== null ? formatMonto(d.subtotal_linea, factura.moneda) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ImageLightbox
        src={esImagen ? urlArchivo : null}
        alt={factura.archivo_nombre ?? 'Factura'}
        abierto={lightboxAbierto}
        onCerrar={() => setLightboxAbierto(false)}
      />
    </>
  )
}

function FilaDatos({ filas }: { filas: Array<[string, string | null | undefined]> }) {
  const visibles = filas.filter(([, valor]) => valor)
  if (visibles.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
      {visibles.map(([label, valor]) => (
        <div key={label}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-foreground">{valor}</p>
        </div>
      ))}
    </div>
  )
}

function MontoFila({
  label,
  valor,
  moneda,
  destacado,
}: {
  label: string
  valor: number
  moneda: string
  destacado?: boolean
}) {
  return (
    <div className={cn('flex items-baseline justify-between', destacado && 'col-span-2')}>
      <span className={cn('text-muted-foreground', destacado && 'font-medium text-foreground')}>{label}</span>
      <span className={cn('tabular', destacado && 'text-base font-semibold text-foreground')}>
        {formatMonto(valor, moneda)}
      </span>
    </div>
  )
}
