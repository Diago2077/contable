import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { RevisionFacturaCard } from '@/components/facturas/RevisionFacturaCard'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox } from '@/components/ui/estado'
import { useContribuyente } from '@/hooks/useContribuyentes'
import { useFacturaAlta } from '@/hooks/useFacturaAlta'
import { usePlanCuentas } from '@/hooks/usePlanCuentas'
import { EXTENSIONES_PERMITIDAS, archivoDemasiadoGrande, prepararParaExtraccion, tipoPermitido } from '@/lib/archivos'
import { extraccionAFormState, type ExtraccionIA, type FacturaFormState } from '@/lib/extraccion'
import { cn } from '@/lib/utils'

type EstadoItem = 'pendiente' | 'extrayendo' | 'listo' | 'error' | 'descartado' | 'guardando' | 'guardado'

interface ItemLote {
  id: string
  archivo: File
  previewSrc: string
  estado: EstadoItem
  error?: string
  form?: FacturaFormState
  extraccionRaw?: ExtraccionIA
}

function idAleatorio() {
  return Math.random().toString(36).slice(2, 10)
}

export default function CargarFacturas() {
  const { id: contribuyenteId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: contribuyente, loading: cargandoContribuyente } = useContribuyente(contribuyenteId)
  const { data: planCuentas, loading: cargandoPlanCuentas } = usePlanCuentas(contribuyenteId)
  const { extraer, guardar } = useFacturaAlta()

  const [items, setItems] = useState<ItemLote[]>([])
  const [procesando, setProcesando] = useState(false)
  const [guardandoTodo, setGuardandoTodo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function actualizarItem(id: string, cambios: Partial<ItemLote> | ((item: ItemLote) => Partial<ItemLote>)) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...(typeof cambios === 'function' ? cambios(it) : cambios) } : it)),
    )
  }

  async function onArchivosSeleccionados(archivos: FileList | File[]) {
    if (!contribuyenteId) return
    const lista = Array.from(archivos)
    const validos = lista.filter(tipoPermitido)
    const grandes = validos.filter(archivoDemasiadoGrande)
    const utilizables = validos.filter((a) => !archivoDemasiadoGrande(a))

    if (lista.length !== validos.length) {
      toast.error('Algunos archivos no son JPG, PNG, WEBP o PDF y se omitieron.')
    }
    if (grandes.length > 0) {
      toast.error(`${grandes.length === 1 ? 'Un archivo pesa' : `${grandes.length} archivos pesan`} mas de 15 MB y se omitieron.`)
    }
    if (utilizables.length === 0) return

    const nuevos: ItemLote[] = utilizables.map((archivo) => ({
      id: idAleatorio(),
      archivo,
      previewSrc: '',
      estado: 'pendiente',
    }))
    setItems((prev) => [...prev, ...nuevos])
    setProcesando(true)

    for (const item of nuevos) {
      actualizarItem(item.id, { estado: 'extrayendo' })
      try {
        const { base64, mime, previewDataUrl } = await prepararParaExtraccion(item.archivo)
        actualizarItem(item.id, { previewSrc: previewDataUrl })

        const { datos, error } = await extraer(contribuyenteId, base64, mime)
        if (error || !datos) {
          actualizarItem(item.id, { estado: 'error', error: error ?? 'No se pudo leer la factura.' })
          continue
        }
        actualizarItem(item.id, { estado: 'listo', form: extraccionAFormState(datos), extraccionRaw: datos })
      } catch {
        actualizarItem(item.id, { estado: 'error', error: 'No se pudo procesar el archivo.' })
      }
    }

    setProcesando(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrando(false)
    if (e.dataTransfer.files?.length) onArchivosSeleccionados(e.dataTransfer.files)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) onArchivosSeleccionados(e.target.files)
    e.target.value = ''
  }

  const listos = items.filter((i) => i.estado === 'listo' || i.estado === 'guardando' || i.estado === 'guardado')
  const conError = items.filter((i) => i.estado === 'error')
  const todoTerminado = !procesando && items.length > 0 && items.every((i) => i.estado !== 'pendiente' && i.estado !== 'extrayendo')

  async function onGuardarTodo() {
    if (!contribuyenteId) return
    setGuardandoTodo(true)

    for (const item of items) {
      if (item.estado !== 'listo' || !item.form) continue
      actualizarItem(item.id, { estado: 'guardando' })
      const { error } = await guardar(contribuyenteId, item.archivo, item.form, item.extraccionRaw)
      if (error) {
        actualizarItem(item.id, { estado: 'error', error })
      } else {
        actualizarItem(item.id, { estado: 'guardado' })
      }
    }

    setGuardandoTodo(false)

    setItems((prev) => {
      const quedanPendientes = prev.some((i) => i.estado === 'error')
      if (!quedanPendientes) {
        toast.success('Facturas guardadas')
        // "facturas" es la pestana por defecto de la ficha del contribuyente
        navigate(`/contribuyentes/${contribuyenteId}`)
      } else {
        toast.warning('Algunas facturas no se pudieron guardar. Revisalas abajo.')
      }
      return prev
    })
  }

  if (cargandoContribuyente) return <Cargando />
  if (!contribuyente) return <ErrorBox mensaje="No se encontro el contribuyente." />

  return (
    <div>
      <Link
        to={`/contribuyentes/${contribuyente.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {contribuyente.razon_social}
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Cargar facturas</h1>
        <p className="text-sm text-muted-foreground">
          Subi una o varias facturas: se extraen los datos automaticamente y despues las revisas antes de guardar.
        </p>
      </div>

      {!cargandoPlanCuentas && planCuentas.length === 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Este contribuyente todavia no tiene plan de cuentas cargado, asi que las facturas no se van a poder
            categorizar automaticamente.{' '}
            <Link to={`/contribuyentes/${contribuyenteId}`} className="underline underline-offset-2">
              Cargalo primero
            </Link>{' '}
            si queres que la IA sugiera la categoria.
          </p>
        </div>
      )}

      {items.length === 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors',
            arrastrando ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-accent/40',
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Arrastra las facturas aca o hace click para elegirlas</p>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP o PDF · hasta 15 MB cada una</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={EXTENSIONES_PERMITIDAS}
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-foreground">
                {items.length} {items.length === 1 ? 'archivo' : 'archivos'}
              </span>
              {listos.length > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-4" /> {listos.length} listas
                </span>
              )}
              {conError.length > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-4" /> {conError.length} con error
                </span>
              )}
              {procesando && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Procesando…
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={procesando}>
                Agregar mas
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={EXTENSIONES_PERMITIDAS}
                className="hidden"
                onChange={onInputChange}
              />
              {todoTerminado && listos.length > 0 && (
                <Button size="sm" onClick={onGuardarTodo} disabled={guardandoTodo}>
                  {guardandoTodo ? 'Guardando…' : `Guardar ${listos.length === 1 ? 'factura' : `${listos.length} facturas`}`}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {items.map((item) => (
              <ItemLoteRow
                key={item.id}
                item={item}
                planCuentas={planCuentas}
                onCambiar={(cambios) => actualizarItem(item.id, (it) => ({ form: { ...it.form!, ...cambios } }))}
                onDescartar={() => actualizarItem(item.id, { estado: 'descartado' })}
                onRestaurar={() => actualizarItem(item.id, { estado: 'listo' })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ItemLoteRow({
  item,
  planCuentas,
  onCambiar,
  onDescartar,
  onRestaurar,
}: {
  item: ItemLote
  planCuentas: ReturnType<typeof usePlanCuentas>['data']
  onCambiar: (cambios: Partial<FacturaFormState>) => void
  onDescartar: () => void
  onRestaurar: () => void
}) {
  if (item.estado === 'pendiente' || item.estado === 'extrayendo') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground">{item.archivo.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">Extrayendo con IA…</span>
      </div>
    )
  }

  if (item.estado === 'error') {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span className="truncate text-sm font-medium text-foreground">{item.archivo.name}</span>
        </div>
        <p className="mt-1 text-xs text-destructive">{item.error}</p>
      </div>
    )
  }

  if (item.estado === 'guardado') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
        <CheckCircle2 className="size-4 text-success" />
        <span className="truncate text-sm text-foreground">{item.archivo.name}</span>
        <span className="ml-auto text-xs text-success">Guardada</span>
      </div>
    )
  }

  if (item.estado === 'guardando') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground">{item.archivo.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">Guardando…</span>
      </div>
    )
  }

  if (!item.form) return null

  return (
    <RevisionFacturaCard
      nombreArchivo={item.archivo.name}
      previewSrc={item.previewSrc}
      form={item.form}
      descartada={item.estado === 'descartado'}
      planCuentas={planCuentas}
      onCambiar={onCambiar}
      onDescartar={onDescartar}
      onRestaurar={onRestaurar}
    />
  )
}
