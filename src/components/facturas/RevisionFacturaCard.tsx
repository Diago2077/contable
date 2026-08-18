import { AlertTriangle, RotateCcw, Trash2, ZoomIn } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ImageLightbox } from '@/components/ui/image-lightbox'
import { MontoInput } from '@/components/ui/monto-input'
import type { PlanCuenta } from '@/lib/database.types'
import { MONEDAS } from '@/lib/database.types'
import type { FacturaFormState } from '@/lib/extraccion'
import { ivaNoCierra, totalCalculado } from '@/lib/extraccion'
import { parseMonto, rucSospechoso } from '@/lib/format'
import { cn } from '@/lib/utils'

export function RevisionFacturaCard({
  nombreArchivo,
  previewSrc,
  form,
  descartada,
  planCuentas,
  ivaRecalculado,
  paginasPdf,
  onCambiar,
  onDescartar,
  onRestaurar,
}: {
  nombreArchivo: string
  previewSrc: string
  form: FacturaFormState
  descartada: boolean
  planCuentas: PlanCuenta[]
  ivaRecalculado?: boolean
  paginasPdf?: number
  onCambiar: (cambios: Partial<FacturaFormState>) => void
  onDescartar: () => void
  onRestaurar: () => void
}) {
  const [lightboxAbierto, setLightboxAbierto] = useState(false)

  function campo<K extends keyof FacturaFormState>(key: K, valor: FacturaFormState[K]) {
    onCambiar({ [key]: valor } as Partial<FacturaFormState>)
  }

  const totalIngresado = parseMonto(form.total)
  const totalEsperado = totalCalculado(form)
  const totalNoCierra = form.total.trim() !== '' && Math.abs(totalIngresado - totalEsperado) > 1

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-opacity',
        descartada && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xs font-medium text-foreground">{nombreArchivo}</p>
          {descartada && <Badge tono="neutral">Descartada</Badge>}
        </div>
        {descartada ? (
          <Button variant="ghost" size="sm" onClick={onRestaurar}>
            <RotateCcw /> Restaurar
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onDescartar}>
            <Trash2 className="text-destructive" /> Descartar
          </Button>
        )}
      </div>

      {!descartada && (
        <div className="flex flex-col gap-5 p-4 lg:flex-row">
          {/* Imagen grande, sticky para acompañar el scroll del formulario */}
          <div className="lg:sticky lg:top-20 lg:h-fit lg:w-[460px] lg:shrink-0">
            <button
              type="button"
              onClick={() => setLightboxAbierto(true)}
              className="group relative block w-full overflow-hidden rounded-md border border-border"
            >
              <img
                src={previewSrc}
                alt={nombreArchivo}
                className="max-h-[70vh] w-full object-contain lg:max-h-[640px]"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                <ZoomIn className="size-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-5">
            {(ivaRecalculado || (paginasPdf ?? 1) > 1) && (
              <div className="space-y-2">
                {ivaRecalculado && (
                  <p className="flex items-start gap-1.5 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    El IVA que leyo la IA no cuadraba con las gravadas y se recalculo. Verifica los montos contra
                    la imagen.
                  </p>
                )}
                {(paginasPdf ?? 1) > 1 && (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    El PDF tiene {paginasPdf} paginas y solo se leyo la primera. El archivo completo se guarda
                    igual.
                  </p>
                )}
              </div>
            )}

            {/* Tipo de operacion */}
            <div className="flex gap-2">
              {(['compra', 'venta'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => campo('tipo_operacion', t)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors',
                    form.tipo_operacion === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="N° de factura">
                <Input value={form.numero_factura} onChange={(e) => campo('numero_factura', e.target.value)} />
              </Field>
              <Field label="Fecha">
                <Input
                  type="date"
                  value={form.fecha_factura}
                  onChange={(e) => campo('fecha_factura', e.target.value)}
                />
              </Field>
              <Field label="Condicion de venta">
                <Select
                  value={form.condicion_venta}
                  onChange={(e) => campo('condicion_venta', e.target.value as FacturaFormState['condicion_venta'])}
                >
                  <option value="">Sin especificar</option>
                  <option value="contado">Contado</option>
                  <option value="credito">Credito</option>
                </Select>
              </Field>
              <Field label="Timbrado">
                <Input value={form.timbrado} onChange={(e) => campo('timbrado', e.target.value)} />
              </Field>
              <Field label="Vencimiento timbrado">
                <Input
                  type="date"
                  value={form.timbrado_vencimiento}
                  onChange={(e) => campo('timbrado_vencimiento', e.target.value)}
                />
              </Field>
              <Field label="Forma de pago">
                <Input value={form.forma_pago} onChange={(e) => campo('forma_pago', e.target.value)} />
              </Field>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Proveedor</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Nombre" className="sm:col-span-2">
                  <Input
                    value={form.proveedor_nombre}
                    onChange={(e) => campo('proveedor_nombre', e.target.value)}
                  />
                </Field>
                <Field
                  label="RUC"
                  warning={rucSospechoso(form.proveedor_ruc) ? 'El DV no parece cerrar' : undefined}
                >
                  <Input value={form.proveedor_ruc} onChange={(e) => campo('proveedor_ruc', e.target.value)} />
                </Field>
                <Field label="Direccion" className="sm:col-span-3">
                  <Input
                    value={form.proveedor_direccion}
                    onChange={(e) => campo('proveedor_direccion', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Cliente</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Nombre" className="sm:col-span-2">
                  <Input value={form.cliente_nombre} onChange={(e) => campo('cliente_nombre', e.target.value)} />
                </Field>
                <Field
                  label="RUC"
                  warning={rucSospechoso(form.cliente_ruc) ? 'El DV no parece cerrar' : undefined}
                >
                  <Input value={form.cliente_ruc} onChange={(e) => campo('cliente_ruc', e.target.value)} />
                </Field>
                <Field label="Direccion" className="sm:col-span-3">
                  <Input
                    value={form.cliente_direccion}
                    onChange={(e) => campo('cliente_direccion', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Montos</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Moneda">
                  <Select value={form.moneda} onChange={(e) => campo('moneda', e.target.value)}>
                    {MONEDAS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
                {form.moneda !== 'PYG' && (
                  <Field label="Tipo de cambio">
                    <MontoInput
                      value={form.tipo_cambio}
                      onChange={(v) => campo('tipo_cambio', v)}
                      moneda={form.moneda}
                    />
                  </Field>
                )}
                <Field label="Exentas">
                  <MontoInput
                    value={form.exentas}
                    onChange={(v) => campo('exentas', v)}
                    moneda={form.moneda}
                    className="tabular"
                  />
                </Field>
                <Field label="Gravadas 5%">
                  <MontoInput
                    value={form.gravado_5}
                    onChange={(v) => campo('gravado_5', v)}
                    moneda={form.moneda}
                    className="tabular"
                  />
                </Field>
                <Field label="IVA 5%" warning={ivaNoCierra(form, 5) ? 'No es la 21ava parte de gravadas 5%' : undefined}>
                  <MontoInput
                    value={form.iva_5}
                    onChange={(v) => campo('iva_5', v)}
                    moneda={form.moneda}
                    className="tabular"
                  />
                </Field>
                <Field label="Gravadas 10%">
                  <MontoInput
                    value={form.gravado_10}
                    onChange={(v) => campo('gravado_10', v)}
                    moneda={form.moneda}
                    className="tabular"
                  />
                </Field>
                <Field label="IVA 10%" warning={ivaNoCierra(form, 10) ? 'No es la 11ava parte de gravadas 10%' : undefined}>
                  <MontoInput
                    value={form.iva_10}
                    onChange={(v) => campo('iva_10', v)}
                    moneda={form.moneda}
                    className="tabular"
                  />
                </Field>
                <Field
                  label="Total"
                  warning={totalNoCierra ? `No coincide con exentas + gravadas (₲ ${totalEsperado})` : undefined}
                >
                  <MontoInput
                    value={form.total}
                    onChange={(v) => campo('total', v)}
                    moneda={form.moneda}
                    className="tabular font-medium"
                  />
                </Field>
              </div>
              {totalNoCierra && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="size-3.5" />
                  Revisa los montos: el total no coincide con exentas + gravado 5% + gravado 10%.
                </p>
              )}
            </div>

            <Field label="Categoria (plan de cuentas)">
              <Combobox
                value={form.plan_cuenta_id}
                onChange={(v) => campo('plan_cuenta_id', v)}
                // Las cuentas no asentables son titulos de rubro: no admiten
                // asientos, asi que no se pueden imputar. Se deja pasar la ya
                // elegida por si una factura vieja quedo con una.
                options={planCuentas
                  .filter((c) => c.asentable || c.id === form.plan_cuenta_id)
                  .map((c) => ({ value: c.id, label: `${c.cuenta} — ${c.denominacion}` }))}
                placeholder="Buscar cuenta…"
              />
            </Field>

            <Field label="Observaciones">
              <Textarea
                value={form.observaciones}
                onChange={(e) => campo('observaciones', e.target.value)}
                rows={2}
              />
            </Field>

            {form.detalles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Se van a guardar {form.detalles.length} {form.detalles.length === 1 ? 'linea' : 'lineas'} de
                detalle.
              </p>
            )}
          </div>
        </div>
      )}

      <ImageLightbox src={previewSrc} alt={nombreArchivo} abierto={lightboxAbierto} onCerrar={() => setLightboxAbierto(false)} />
    </div>
  )
}
