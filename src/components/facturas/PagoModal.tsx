import { ExternalLink, Paperclip } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { MontoInput } from '@/components/ui/monto-input'
import type { usePagos } from '@/hooks/usePagos'
import { EXTENSIONES_PERMITIDAS, archivoDemasiadoGrande, tipoPermitido } from '@/lib/archivos'
import { terminosDePago } from '@/lib/cobros'
import { MEDIOS_PAGO, type Factura, type MedioPago, type PagoFactura } from '@/lib/database.types'
import { formatMontoConMoneda, parseMonto } from '@/lib/format'
import { pagoAFormState, pagoNuevo, validarPago, type PagoFormState } from '@/lib/pagoFactura'
import { abrirArchivo } from './abrirArchivo'

type FacturaDelPago = Pick<Factura, 'id' | 'empresa_id' | 'contribuyente_id' | 'moneda' | 'tipo_operacion'>

/**
 * Alta o edicion del comprobante de pago de una factura: monto, fecha, medio
 * y, si lo hay, el archivo (transferencia, recibo, cheque). En una venta el
 * mismo formulario registra un cobro.
 */
export function PagoModal({
  abierto,
  factura,
  pago,
  saldo,
  onCerrar,
  onGuardado,
  guardar,
  actualizar,
}: {
  abierto: boolean
  factura: FacturaDelPago
  /** Si viene, se edita ese pago en vez de crear uno nuevo. */
  pago: PagoFactura | null
  /** Lo que falta pagar de la factura (sin contar este pago si se esta editando). */
  saldo: number
  onCerrar: () => void
  onGuardado: () => void
  guardar: ReturnType<typeof usePagos>['guardar']
  actualizar: ReturnType<typeof usePagos>['actualizar']
}) {
  const termino = terminosDePago(factura.tipo_operacion)
  const inputRef = useRef<HTMLInputElement>(null)

  // El modal se monta recien cuando se abre (ver CobrosFactura), asi que el
  // estado arranca limpio cada vez y no hace falta reiniciarlo con un efecto,
  // que ademas pisaria lo que se esta tipeando si el saldo cambia mientras tanto.
  const [form, setForm] = useState<PagoFormState>(() => (pago ? pagoAFormState(pago) : pagoNuevo(saldo)))
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function campo<K extends keyof PagoFormState>(key: K, valor: PagoFormState[K]) {
    setForm((f) => ({ ...f, [key]: valor }))
  }

  function onElegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0]
    e.target.value = ''
    if (!elegido) return
    if (!tipoPermitido(elegido)) return setError('El comprobante tiene que ser JPG, PNG, WEBP o PDF.')
    if (archivoDemasiadoGrande(elegido)) return setError('El archivo pesa mas de 15 MB.')
    setError(null)
    setArchivo(elegido)
  }

  async function onGuardar() {
    const problema = validarPago(form)
    if (problema) {
      setError(problema)
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err } = pago ? await actualizar(pago, form, archivo) : await guardar(factura, archivo, form)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    toast.success(pago ? 'Actualizado' : `${termino.singular[0].toUpperCase()}${termino.singular.slice(1)} registrado`)
    onGuardado()
  }

  const monto = parseMonto(form.monto)
  const sePasa = monto > saldo + 1 && saldo > 0
  const yaEstabaSaldada = saldo <= 0 && monto > 0

  return (
    <Modal
      abierto={abierto}
      titulo={pago ? `Editar ${termino.singular}` : termino.registrar}
      onCerrar={onCerrar}
      ancho="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : pago ? 'Guardar cambios' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <Input type="date" value={form.fecha_pago} onChange={(e) => campo('fecha_pago', e.target.value)} />
          </Field>
          <Field
            label={`Monto (${factura.moneda})`}
            warning={
              sePasa
                ? `Supera lo que falta (${formatMontoConMoneda(saldo, factura.moneda)}): queda ${termino.verbo} de mas.`
                : yaEstabaSaldada
                  ? 'La factura ya estaba saldada: esto queda como un exceso.'
                  : undefined
            }
          >
            <MontoInput
              value={form.monto}
              onChange={(v) => campo('monto', v)}
              moneda={factura.moneda}
              className="tabular font-medium"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Medio">
            <Select value={form.medio_pago} onChange={(e) => campo('medio_pago', e.target.value as MedioPago)}>
              {MEDIOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Banco o entidad">
            <Input
              value={form.entidad}
              onChange={(e) => campo('entidad', e.target.value)}
              placeholder="Ej: Banco Itau, Tigo Money"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="Referencia" hint="N° de operacion, de cheque, de recibo…">
          <Input value={form.referencia} onChange={(e) => campo('referencia', e.target.value)} />
        </Field>

        <Field label="Observaciones">
          <Textarea value={form.observaciones} onChange={(e) => campo('observaciones', e.target.value)} rows={2} />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Comprobante (opcional)</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Paperclip /> {archivo || pago?.archivo_path ? 'Cambiar archivo' : 'Adjuntar archivo'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={EXTENSIONES_PERMITIDAS}
              className="hidden"
              onChange={onElegirArchivo}
            />
            {archivo ? (
              <span className="max-w-xs truncate text-xs text-foreground">{archivo.name}</span>
            ) : pago?.archivo_path ? (
              <button
                type="button"
                onClick={() => abrirArchivo(pago.archivo_path!)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" /> Ver el actual
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Transferencia, recibo o cheque. Un pago en efectivo puede ir sin archivo.
              </span>
            )}
          </div>
        </div>

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}
