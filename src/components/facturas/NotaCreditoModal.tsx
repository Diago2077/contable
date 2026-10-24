import { AlertTriangle, FileText, Loader2, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { MontoInput } from '@/components/ui/monto-input'
import { useFacturaAlta } from '@/hooks/useFacturaAlta'
import type { useNotasCredito } from '@/hooks/useNotasCredito'
import { EXTENSIONES_PERMITIDAS, archivoDemasiadoGrande, prepararParaExtraccion, tipoPermitido } from '@/lib/archivos'
import type { Factura, NotaCredito } from '@/lib/database.types'
import { ivaNoCierra, totalCalculado } from '@/lib/extraccion'
import { formatMontoConMoneda, parseMonto } from '@/lib/format'
import {
  NOTA_VACIA,
  advertenciasCdcNota,
  coincideFacturaReferida,
  extraccionANotaForm,
  notaAFormState,
  notaFormAUpdate,
  type NotaCreditoExtraccion,
  type NotaCreditoFormState,
} from '@/lib/notaCredito'
import { cn } from '@/lib/utils'

type Fase = 'archivo' | 'leyendo' | 'formulario'

type FacturaDeLaNota = Pick<
  Factura,
  'id' | 'empresa_id' | 'contribuyente_id' | 'numero_factura' | 'proveedor_ruc' | 'moneda'
>

/**
 * Alta de una nota de credito: se sube la imagen o el PDF, la IA lee los
 * datos y se revisan antes de guardar. Tambien sirve para editar una nota ya
 * guardada (sin paso de archivo) y para cargarla a mano si la IA no pudo.
 */
export function NotaCreditoModal({
  abierto,
  factura,
  nota,
  sinAcreditar,
  onCerrar,
  onGuardado,
  guardar,
  actualizar,
}: {
  abierto: boolean
  factura: FacturaDeLaNota
  /** Si viene, se edita esa nota en vez de crear una nueva. */
  nota: NotaCredito | null
  /** Lo que de la factura todavia no esta acreditado, para avisar si la nota se pasa. */
  sinAcreditar: number
  onCerrar: () => void
  onGuardado: () => void
  guardar: ReturnType<typeof useNotasCredito>['guardar']
  actualizar: ReturnType<typeof useNotasCredito>['actualizar']
}) {
  const { extraerNota } = useFacturaAlta()
  const inputRef = useRef<HTMLInputElement>(null)

  const [fase, setFase] = useState<Fase>('archivo')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [extraccion, setExtraccion] = useState<NotaCreditoExtraccion | null>(null)
  const [form, setForm] = useState<NotaCreditoFormState>(NOTA_VACIA)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setError(null)
    setGuardando(false)
    setArchivo(null)
    setExtraccion(null)
    if (nota) {
      setForm(notaAFormState(nota))
      setFase('formulario')
    } else {
      setForm(NOTA_VACIA)
      setFase('archivo')
    }
  }, [abierto, nota])

  function campo<K extends keyof NotaCreditoFormState>(key: K, valor: NotaCreditoFormState[K]) {
    setForm((f) => ({ ...f, [key]: valor }))
  }

  async function procesar(elegido: File) {
    if (!tipoPermitido(elegido)) return setError('El archivo tiene que ser JPG, PNG, WEBP o PDF.')
    if (archivoDemasiadoGrande(elegido)) return setError('El archivo pesa mas de 15 MB.')

    setError(null)
    setArchivo(elegido)
    setFase('leyendo')

    const sinLectura = (motivo: string) => {
      setError(`${motivo} Podes cargar los datos a mano: el archivo queda adjunto.`)
      setForm(NOTA_VACIA)
      setFase('formulario')
    }

    try {
      const { base64, mime } = await prepararParaExtraccion(elegido)
      const { datos, error: err } = await extraerNota(factura.contribuyente_id, base64, mime)
      if (err || !datos) return sinLectura(err ?? 'No se pudo leer la nota.')
      setExtraccion(datos)
      setForm(extraccionANotaForm(datos))
      setFase('formulario')
    } catch {
      sinLectura('No se pudo procesar el archivo.')
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0]
    e.target.value = ''
    if (elegido) procesar(elegido)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrando(false)
    const elegido = e.dataTransfer.files?.[0]
    if (elegido) procesar(elegido)
  }

  async function onGuardar() {
    if (Math.abs(parseMonto(form.total)) <= 0) {
      setError('Falta el total de la nota.')
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err } = nota
      ? await actualizar(nota.id, notaFormAUpdate(form))
      : await guardar(factura, archivo, form, extraccion)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    toast.success(nota ? 'Nota de credito actualizada' : 'Nota de credito guardada')
    onGuardado()
  }

  const totalNota = Math.abs(parseMonto(form.total))
  const totalNoCierra = form.total.trim() !== '' && Math.abs(totalNota - totalCalculado(form)) > 1
  const advertenciaCdc = advertenciasCdcNota(form, factura).join(' ')
  const facturaCitada = extraccion ? coincideFacturaReferida(extraccion.factura_numero, factura.numero_factura) : null
  const sePasa = totalNota > sinAcreditar + 1

  return (
    <Modal
      abierto={abierto}
      titulo={nota ? 'Editar nota de credito' : 'Agregar nota de credito'}
      descripcion={factura.numero_factura ? `Factura ${factura.numero_factura}` : undefined}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      footer={
        fase === 'formulario' ? (
          <>
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : nota ? 'Guardar cambios' : 'Guardar nota'}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onCerrar} disabled={fase === 'leyendo'}>
            Cancelar
          </Button>
        )
      }
    >
      {fase === 'archivo' && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
              arrastrando ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-accent/40',
            )}
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Arrastra la nota de credito aca o hace click</p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WEBP o PDF · hasta 15 MB. La IA lee los datos y despues los revisas.
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={EXTENSIONES_PERMITIDAS}
              className="hidden"
              onChange={onInputChange}
            />
          </div>
          {error && <ErrorBox mensaje={error} />}
          <button
            type="button"
            onClick={() => {
              setError(null)
              setFase('formulario')
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Cargarla a mano, sin archivo
          </button>
        </div>
      )}

      {fase === 'leyendo' && (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Leyendo la nota con IA…
          {archivo && <span className="max-w-xs truncate text-xs">{archivo.name}</span>}
        </div>
      )}

      {fase === 'formulario' && (
        <div className="space-y-5">
          {archivo && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="size-3.5" /> {archivo.name}
            </p>
          )}

          {facturaCitada === false && (
            <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                La nota dice referirse a la factura <strong>{extraccion?.factura_numero}</strong>, pero la estas
                agregando a la <strong>{factura.numero_factura}</strong>. Verifica que sea la correcta.
              </span>
            </p>
          )}
          {extraccion?.iva_recalculado && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              El IVA que leyo la IA no cuadraba con las gravadas y se recalculo. Verifica los montos contra la imagen.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="N° de nota">
              <Input value={form.numero_nota} onChange={(e) => campo('numero_nota', e.target.value)} />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={form.fecha_nota} onChange={(e) => campo('fecha_nota', e.target.value)} />
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
          </div>

          <Field
            label="CDC (nota de credito electronica)"
            warning={advertenciaCdc || undefined}
            hint="44 digitos junto al codigo QR. Vacio si es una nota preimpresa."
          >
            <Input
              value={form.cdc}
              onChange={(e) => campo('cdc', e.target.value)}
              inputMode="numeric"
              className="tabular text-xs"
              placeholder="0500 0000 …"
            />
          </Field>

          <Field label="Motivo">
            <Input
              value={form.motivo}
              onChange={(e) => campo('motivo', e.target.value)}
              placeholder="Devolucion, descuento, ajuste de precio…"
            />
          </Field>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Montos acreditados ({factura.moneda})</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Exentas">
                <MontoInput value={form.exentas} onChange={(v) => campo('exentas', v)} moneda={factura.moneda} className="tabular" />
              </Field>
              <Field label="Gravadas 5%">
                <MontoInput value={form.gravado_5} onChange={(v) => campo('gravado_5', v)} moneda={factura.moneda} className="tabular" />
              </Field>
              <Field label="IVA 5%" warning={ivaNoCierra(form, 5) ? 'No es la 21ava parte de gravadas 5%' : undefined}>
                <MontoInput value={form.iva_5} onChange={(v) => campo('iva_5', v)} moneda={factura.moneda} className="tabular" />
              </Field>
              <Field label="Gravadas 10%">
                <MontoInput value={form.gravado_10} onChange={(v) => campo('gravado_10', v)} moneda={factura.moneda} className="tabular" />
              </Field>
              <Field label="IVA 10%" warning={ivaNoCierra(form, 10) ? 'No es la 11ava parte de gravadas 10%' : undefined}>
                <MontoInput value={form.iva_10} onChange={(v) => campo('iva_10', v)} moneda={factura.moneda} className="tabular" />
              </Field>
              <Field
                label="Total"
                warning={
                  totalNoCierra
                    ? `No coincide con exentas + gravadas (${formatMontoConMoneda(totalCalculado(form), factura.moneda)})`
                    : undefined
                }
              >
                <MontoInput value={form.total} onChange={(v) => campo('total', v)} moneda={factura.moneda} className="tabular font-medium" />
              </Field>
            </div>
            {sePasa && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Esta nota ({formatMontoConMoneda(totalNota, factura.moneda)}) supera lo que le queda sin acreditar a la
                factura ({formatMontoConMoneda(Math.max(sinAcreditar, 0), factura.moneda)}).
              </p>
            )}
          </div>

          <Field label="Observaciones">
            <Textarea value={form.observaciones} onChange={(e) => campo('observaciones', e.target.value)} rows={2} />
          </Field>

          {error && <ErrorBox mensaje={error} />}
        </div>
      )}
    </Modal>
  )
}
