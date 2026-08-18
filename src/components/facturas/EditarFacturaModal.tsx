import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { MontoInput } from '@/components/ui/monto-input'
import type { FacturaConRelaciones, PlanCuenta } from '@/lib/database.types'
import { MONEDAS } from '@/lib/database.types'
import {
  facturaAFormState,
  formStateAFacturaUpdate,
  ivaNoCierra,
  totalCalculado,
  type FacturaFormState,
} from '@/lib/extraccion'
import { parseMonto, rucSospechoso } from '@/lib/format'
import { urlFirmada } from '@/lib/storage'
import { cn } from '@/lib/utils'

export function EditarFacturaModal({
  factura,
  planCuentas,
  onCerrar,
  onGuardado,
  actualizar,
}: {
  factura: FacturaConRelaciones | null
  planCuentas: PlanCuenta[]
  onCerrar: () => void
  onGuardado: () => void
  actualizar: (id: string, payload: ReturnType<typeof formStateAFacturaUpdate>) => Promise<{ error: string | null }>
}) {
  const [form, setForm] = useState<FacturaFormState | null>(null)
  const [urlArchivo, setUrlArchivo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!factura) {
      setForm(null)
      setUrlArchivo(null)
      return
    }
    setForm(facturaAFormState(factura))
    setError(null)
    setUrlArchivo(null)
    if (factura.archivo_path) urlFirmada(factura.archivo_path).then(setUrlArchivo)
  }, [factura])

  function campo<K extends keyof FacturaFormState>(key: K, valor: FacturaFormState[K]) {
    setForm((f) => (f ? { ...f, [key]: valor } : f))
  }

  async function onGuardar() {
    if (!factura || !form) return
    setGuardando(true)
    setError(null)
    const { error: err } = await actualizar(factura.id, formStateAFacturaUpdate(form))
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    toast.success('Factura actualizada')
    onGuardado()
  }

  if (!factura || !form) return null

  const totalIngresado = parseMonto(form.total)
  const totalEsperado = totalCalculado(form)
  const totalNoCierra = form.total.trim() !== '' && Math.abs(totalIngresado - totalEsperado) > 1

  return (
    <Modal
      abierto={factura !== null}
      titulo="Editar factura"
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {urlArchivo && (
          <a
            href={urlArchivo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" /> Ver archivo original
          </a>
        )}

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
            <Input type="date" value={form.fecha_factura} onChange={(e) => campo('fecha_factura', e.target.value)} />
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
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Proveedor</p>
            <Field label="Nombre">
              <Input value={form.proveedor_nombre} onChange={(e) => campo('proveedor_nombre', e.target.value)} />
            </Field>
            <Field label="RUC" warning={rucSospechoso(form.proveedor_ruc) ? 'El DV no parece cerrar' : undefined}>
              <Input value={form.proveedor_ruc} onChange={(e) => campo('proveedor_ruc', e.target.value)} />
            </Field>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Cliente</p>
            <Field label="Nombre">
              <Input value={form.cliente_nombre} onChange={(e) => campo('cliente_nombre', e.target.value)} />
            </Field>
            <Field label="RUC" warning={rucSospechoso(form.cliente_ruc) ? 'El DV no parece cerrar' : undefined}>
              <Input value={form.cliente_ruc} onChange={(e) => campo('cliente_ruc', e.target.value)} />
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
        </div>

        <Field label="Categoria (plan de cuentas)">
          <Combobox
            value={form.plan_cuenta_id}
            onChange={(v) => campo('plan_cuenta_id', v)}
            // Solo cuentas asentables: las de nivel superior son titulos de
            // rubro y no admiten asientos. Se deja pasar la ya elegida por si
            // una factura vieja quedo con una.
            options={planCuentas
              .filter((c) => c.asentable || c.id === form.plan_cuenta_id)
              .map((c) => ({ value: c.id, label: `${c.cuenta} — ${c.denominacion}` }))}
            placeholder="Buscar cuenta…"
          />
        </Field>

        <Field label="Observaciones">
          <Textarea value={form.observaciones} onChange={(e) => campo('observaciones', e.target.value)} rows={2} />
        </Field>

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}
