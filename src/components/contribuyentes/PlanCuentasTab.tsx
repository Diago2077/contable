import { FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Field, Input, Select } from '@/components/ui/field'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { usePlanCuentas } from '@/hooks/usePlanCuentas'
import type { Naturaleza, PlanCuenta } from '@/lib/database.types'
import { parseCsv } from '@/lib/csv'
import { parseXlsx } from '@/lib/xlsx'

const NATURALEZA_LABEL: Record<Naturaleza, string> = { D: 'Deudora', A: 'Acreedora' }

function siNo(valor: string | undefined, porDefecto: boolean): boolean {
  const v = (valor ?? '').trim().toUpperCase()
  if (!v) return porDefecto
  return v === 'S' || v === 'SI'
}

function naturalezaDe(valor: string | undefined): Naturaleza | null {
  const v = (valor ?? '').trim().toUpperCase()
  return v === 'D' || v === 'A' ? v : null
}

export function PlanCuentasTab({
  contribuyenteId,
  empresaId,
}: {
  contribuyenteId: string
  empresaId: string
}) {
  const { data, loading, error, refetch, crear, crearVarias, actualizar, eliminar } =
    usePlanCuentas(contribuyenteId)

  const [modalCuenta, setModalCuenta] = useState<PlanCuenta | 'nueva' | null>(null)
  const [modalEliminar, setModalEliminar] = useState<PlanCuenta | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)

  async function onImportarArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return

    setImportando(true)
    try {
      const esExcel = /\.xlsx$/i.test(archivo.name)
      const filas = esExcel ? await parseXlsx(archivo) : parseCsv(await archivo.text())
      // Encabezado esperado: Cuenta,Denominacion,Nivel,Naturaleza,Asentable,Centro Costo,Moneda,Tipo cambio,Cuenta SSET
      // (se acepta tambien solo Cuenta,Denominacion, para compatibilidad con CSVs viejos)
      const primera = filas[0]?.map((v) => v.trim().toLowerCase())
      const tieneEncabezado = primera?.[0] === 'cuenta' || primera?.[0] === 'codigo' || primera?.[0] === 'código'
      const filasDatos = tieneEncabezado ? filas.slice(1) : filas

      const nuevas = filasDatos
        .map((f) => ({
          empresa_id: empresaId,
          contribuyente_id: contribuyenteId,
          cuenta: (f[0] ?? '').trim(),
          denominacion: (f[1] ?? '').trim(),
          nivel: f[2]?.trim() ? Number(f[2].trim()) : null,
          naturaleza: naturalezaDe(f[3]),
          asentable: siNo(f[4], true),
          centro_costo: siNo(f[5], false),
          moneda: f[6]?.trim() || 'PYG',
          tipo_cambio: f[7]?.trim() || null,
          cuenta_sset: f[8]?.trim() || null,
          activo: true,
        }))
        .filter((f) => f.cuenta && f.denominacion)

      if (nuevas.length === 0) {
        toast.error('El archivo no tiene filas validas (se espera al menos cuenta,denominacion).')
        return
      }

      const existentes = new Set(data.map((c) => c.cuenta))
      const aInsertar = nuevas.filter((n) => !existentes.has(n.cuenta))
      const repetidas = nuevas.length - aInsertar.length

      const { insertadas, error: err } = await crearVarias(aInsertar)
      if (err) {
        toast.error(err)
        return
      }
      toast.success(
        `${insertadas} ${insertadas === 1 ? 'cuenta importada' : 'cuentas importadas'}` +
          (repetidas > 0 ? ` (${repetidas} ya existian y se omitieron)` : ''),
      )
      refetch()
    } catch {
      toast.error('No se pudo leer el archivo.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Categorias para clasificar las facturas de este contribuyente.
        </p>
        <div className="flex gap-2">
          <input
            ref={inputArchivo}
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onImportarArchivo}
          />
          <Button variant="outline" size="sm" onClick={() => inputArchivo.current?.click()} disabled={importando}>
            <Upload /> {importando ? 'Importando…' : 'Importar CSV o Excel'}
          </Button>
          <Button size="sm" onClick={() => setModalCuenta('nueva')}>
            <Plus /> Nueva cuenta
          </Button>
        </div>
      </div>

      {loading ? (
        <Cargando />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio
          icono={FileSpreadsheet}
          titulo="Sin plan de cuentas"
          descripcion="Agrega cuentas una por una o importa un CSV o Excel con columnas cuenta,denominacion,nivel,naturaleza,asentable,centro costo,moneda,tipo cambio,cuenta sset."
          accion={
            <Button size="sm" onClick={() => setModalCuenta('nueva')}>
              <Plus /> Nueva cuenta
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Cuenta</th>
                <th className="px-4 py-2.5 font-medium">Denominacion</th>
                <th className="px-4 py-2.5 font-medium">Nivel</th>
                <th className="px-4 py-2.5 font-medium">Naturaleza</th>
                <th className="px-4 py-2.5 font-medium">Asentable</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setModalCuenta(c)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-2.5 tabular font-medium text-foreground">{c.cuenta}</td>
                  <td className="px-4 py-2.5 text-foreground">{c.denominacion}</td>
                  <td className="px-4 py-2.5 tabular text-muted-foreground">{c.nivel ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {c.naturaleza ? NATURALEZA_LABEL[c.naturaleza] : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.asentable ? 'Si' : 'No'}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const { error: err } = await actualizar(c.id, { activo: !c.activo })
                        if (err) toast.error(err)
                        else refetch()
                      }}
                    >
                      <Badge tono={c.activo ? 'success' : 'neutral'}>
                        {c.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          setModalEliminar(c)
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CuentaModal
        cuenta={modalCuenta}
        empresaId={empresaId}
        contribuyenteId={contribuyenteId}
        onCerrar={() => setModalCuenta(null)}
        crear={crear}
        actualizar={actualizar}
        onGuardado={() => {
          setModalCuenta(null)
          refetch()
        }}
      />

      <ConfirmModal
        abierto={modalEliminar !== null}
        titulo="Eliminar cuenta"
        mensaje={
          <>
            Se va a eliminar <strong>{modalEliminar?.cuenta} — {modalEliminar?.denominacion}</strong>.
            Las facturas que la usaban quedan sin categorizar.
          </>
        }
        onCancelar={() => setModalEliminar(null)}
        onConfirmar={async () => {
          if (!modalEliminar) return
          const { error: err } = await eliminar(modalEliminar.id)
          if (err) toast.error(err)
          else {
            toast.success('Cuenta eliminada')
            refetch()
          }
          setModalEliminar(null)
        }}
      />
    </div>
  )
}

interface FormCuenta {
  cuenta: string
  denominacion: string
  nivel: string
  naturaleza: '' | Naturaleza
  asentable: boolean
  centroCosto: boolean
  moneda: string
  tipoCambio: string
  cuentaSset: string
}

const FORM_VACIO: FormCuenta = {
  cuenta: '',
  denominacion: '',
  nivel: '',
  naturaleza: '',
  asentable: true,
  centroCosto: false,
  moneda: 'PYG',
  tipoCambio: '',
  cuentaSset: '',
}

function CuentaModal({
  cuenta,
  empresaId,
  contribuyenteId,
  onCerrar,
  crear,
  actualizar,
  onGuardado,
}: {
  cuenta: PlanCuenta | 'nueva' | null
  empresaId: string
  contribuyenteId: string
  onCerrar: () => void
  crear: ReturnType<typeof usePlanCuentas>['crear']
  actualizar: ReturnType<typeof usePlanCuentas>['actualizar']
  onGuardado: () => void
}) {
  const editando = cuenta && cuenta !== 'nueva' ? cuenta : null
  const [form, setForm] = useState<FormCuenta>(FORM_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setForm(
      editando
        ? {
            cuenta: editando.cuenta,
            denominacion: editando.denominacion,
            nivel: editando.nivel != null ? String(editando.nivel) : '',
            naturaleza: editando.naturaleza ?? '',
            asentable: editando.asentable,
            centroCosto: editando.centro_costo,
            moneda: editando.moneda,
            tipoCambio: editando.tipo_cambio ?? '',
            cuentaSset: editando.cuenta_sset ?? '',
          }
        : FORM_VACIO,
    )
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuenta])

  function campo<K extends keyof FormCuenta>(key: K, valor: FormCuenta[K]) {
    setForm((f) => ({ ...f, [key]: valor }))
  }

  async function onGuardar() {
    if (!form.cuenta.trim() || !form.denominacion.trim()) {
      setError('Completa cuenta y denominacion.')
      return
    }
    setGuardando(true)
    setError(null)

    const payload = {
      cuenta: form.cuenta.trim(),
      denominacion: form.denominacion.trim(),
      nivel: form.nivel.trim() ? Number(form.nivel.trim()) : null,
      naturaleza: form.naturaleza || null,
      asentable: form.asentable,
      centro_costo: form.centroCosto,
      moneda: form.moneda.trim() || 'PYG',
      tipo_cambio: form.tipoCambio.trim() || null,
      cuenta_sset: form.cuentaSset.trim() || null,
    }

    const resultado = editando
      ? await actualizar(editando.id, payload)
      : await crear({ empresa_id: empresaId, contribuyente_id: contribuyenteId, activo: true, ...payload })
    setGuardando(false)
    if (resultado.error) {
      setError(resultado.error)
      return
    }
    toast.success(editando ? 'Cuenta actualizada' : 'Cuenta creada')
    onGuardado()
  }

  return (
    <Modal
      abierto={cuenta !== null}
      titulo={editando ? 'Editar cuenta' : 'Nueva cuenta'}
      onCerrar={onCerrar}
      ancho="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuenta *">
            <Input value={form.cuenta} onChange={(e) => campo('cuenta', e.target.value)} autoFocus />
          </Field>
          <Field label="Nivel">
            <Input type="number" min={1} value={form.nivel} onChange={(e) => campo('nivel', e.target.value)} />
          </Field>
        </div>

        <Field label="Denominacion *">
          <Input value={form.denominacion} onChange={(e) => campo('denominacion', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Naturaleza">
            <Select
              value={form.naturaleza}
              onChange={(e) => campo('naturaleza', e.target.value as FormCuenta['naturaleza'])}
            >
              <option value="">Sin especificar</option>
              <option value="D">Deudora</option>
              <option value="A">Acreedora</option>
            </Select>
          </Field>
          <Field label="Moneda">
            <Input value={form.moneda} onChange={(e) => campo('moneda', e.target.value)} placeholder="PYG" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Asentable">
            <div className="flex gap-2">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => campo('asentable', v)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    form.asentable === v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {v ? 'Si' : 'No'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Centro de costo">
            <div className="flex gap-2">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => campo('centroCosto', v)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    form.centroCosto === v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {v ? 'Si' : 'No'}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo cambio">
            <Input value={form.tipoCambio} onChange={(e) => campo('tipoCambio', e.target.value)} />
          </Field>
          <Field label="Cuenta SSET">
            <Input value={form.cuentaSset} onChange={(e) => campo('cuentaSset', e.target.value)} />
          </Field>
        </div>

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}
