import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Cargando, Vacio } from '@/components/ui/estado'
import { Input } from '@/components/ui/field'
import { formatFechaHora, formatMonto } from '@/lib/format'
import { supabase } from '@/lib/supabase'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface Totales {
  facturas: number
  tokens: number
  tokensCache: number
  costoUsd: number
}

interface FilaUso {
  id: string
  created_at: string
  modelo: string | null
  tokens_prompt: number
  tokens_completion: number
  tokens_total: number
  tokens_cache: number
  costo_usd: number
  contribuyente: { razon_social: string } | null
}

/** Consumo de IA del estudio, mes a mes, con limite mensual configurable. */
export function ConsumoIA({
  empresaId,
  limiteTokensMensual,
  onCambiarLimite,
}: {
  empresaId: string
  limiteTokensMensual: number | null
  onCambiarLimite: (limite: number | null) => Promise<{ error: string | null }>
}) {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getUTCFullYear())
  const [mes, setMes] = useState(hoy.getUTCMonth()) // 0-11
  const [totales, setTotales] = useState<Totales | null>(null)
  const [filas, setFilas] = useState<FilaUso[]>([])
  const [cargando, setCargando] = useState(true)

  const esMesActual = anio === hoy.getUTCFullYear() && mes === hoy.getUTCMonth()

  useEffect(() => {
    let cancelado = false
    setCargando(true)

    const inicio = new Date(Date.UTC(anio, mes, 1)).toISOString()
    const fin = new Date(Date.UTC(anio, mes + 1, 1)).toISOString()

    supabase
      .from('uso_ia')
      .select('id, created_at, modelo, tokens_prompt, tokens_completion, tokens_total, tokens_cache, costo_usd, contribuyente:contribuyentes(razon_social)')
      .eq('empresa_id', empresaId)
      .gte('created_at', inicio)
      .lt('created_at', fin)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelado) return
        const lista = (data ?? []) as unknown as FilaUso[]
        setFilas(lista)
        setTotales({
          facturas: lista.length,
          tokens: lista.reduce((acc, f) => acc + f.tokens_total, 0),
          tokensCache: lista.reduce((acc, f) => acc + (f.tokens_cache ?? 0), 0),
          costoUsd: lista.reduce((acc, f) => acc + Number(f.costo_usd), 0),
        })
        setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [empresaId, anio, mes])

  function mesAnterior() {
    if (mes === 0) {
      setAnio((a) => a - 1)
      setMes(11)
    } else {
      setMes((m) => m - 1)
    }
  }

  function mesSiguiente() {
    if (esMesActual) return
    if (mes === 11) {
      setAnio((a) => a + 1)
      setMes(0)
    } else {
      setMes((m) => m + 1)
    }
  }

  const superoLimite = limiteTokensMensual != null && (totales?.tokens ?? 0) >= limiteTokensMensual

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Consumo de IA</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={mesAnterior} title="Mes anterior">
            <ChevronLeft />
          </Button>
          <span className="min-w-32 text-center text-sm text-foreground">
            {MESES[mes]} {anio}
          </span>
          <Button variant="ghost" size="icon" onClick={mesSiguiente} disabled={esMesActual} title="Mes siguiente">
            <ChevronRight />
          </Button>
        </div>
      </div>

      {cargando || !totales ? (
        <Cargando className="py-6" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Facturas procesadas</p>
            <p className="text-lg font-semibold tabular text-foreground">{totales.facturas}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tokens usados</p>
            <p className={`text-lg font-semibold tabular ${superoLimite ? 'text-destructive' : 'text-foreground'}`}>
              {formatMonto(totales.tokens, 'PYG')}
              {limiteTokensMensual != null && (
                <span className="text-xs font-normal text-muted-foreground">
                  {' '}
                  / {formatMonto(limiteTokensMensual, 'PYG')}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Costo estimado</p>
            <p className="text-lg font-semibold tabular text-foreground">${formatMonto(totales.costoUsd, 'USD')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Desde cache</p>
            <p className="text-lg font-semibold tabular text-success">
              {formatMonto(totales.tokensCache, 'PYG')}
              {totales.tokens > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {' '}
                  ({Math.round((totales.tokensCache / totales.tokens) * 100)}%)
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {!cargando && filas.length > 0 && (
        <div className="mt-4 max-h-72 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary/60">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Contribuyente</th>
                <th className="px-3 py-2 font-medium">Modelo</th>
                <th className="px-3 py-2 text-right font-medium">Prompt</th>
                <th className="px-3 py-2 text-right font-medium">Cache</th>
                <th className="px-3 py-2 text-right font-medium">Completion</th>
                <th className="px-3 py-2 text-right font-medium">Costo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatFechaHora(f.created_at)}</td>
                  <td className="px-3 py-2 text-foreground">{f.contribuyente?.razon_social ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{f.modelo ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular text-foreground">{formatMonto(f.tokens_prompt, 'PYG')}</td>
                  <td className="px-3 py-2 text-right tabular text-success">
                    {f.tokens_cache ? formatMonto(f.tokens_cache, 'PYG') : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-foreground">{formatMonto(f.tokens_completion, 'PYG')}</td>
                  <td className="px-3 py-2 text-right tabular text-foreground">${formatMonto(f.costo_usd, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!cargando && totales && filas.length === 0 && (
        <Vacio icono={Sparkles} titulo="Sin uso este mes" />
      )}

      {superoLimite && (
        <p className="mt-3 text-xs text-destructive">
          Este estudio alcanzo su limite mensual: la extraccion por IA esta bloqueada hasta el mes que viene (o hasta
          que le subas o saques el limite).
        </p>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <LimiteMensual limiteActual={limiteTokensMensual} onGuardar={onCambiarLimite} />
      </div>
    </div>
  )
}

function LimiteMensual({
  limiteActual,
  onGuardar,
}: {
  limiteActual: number | null
  onGuardar: (limite: number | null) => Promise<{ error: string | null }>
}) {
  const [valor, setValor] = useState(limiteActual != null ? String(limiteActual) : '')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setValor(limiteActual != null ? String(limiteActual) : '')
  }, [limiteActual])

  const cambio = valor.trim() === '' ? null : Number(valor)
  const huboEdicion = cambio !== limiteActual

  async function onGuardar_() {
    if (valor.trim() !== '' && (!Number.isFinite(cambio) || (cambio as number) < 0)) {
      toast.error('El limite tiene que ser un numero positivo.')
      return
    }
    setGuardando(true)
    const { error } = await onGuardar(cambio)
    setGuardando(false)
    if (error) toast.error(error)
    else toast.success(cambio === null ? 'Limite mensual quitado' : 'Limite mensual actualizado')
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-48">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Limite mensual de tokens</label>
        <Input
          type="number"
          min={0}
          placeholder="Sin limite"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </div>
      <Button variant="outline" size="sm" onClick={onGuardar_} disabled={!huboEdicion || guardando}>
        {guardando ? 'Guardando…' : 'Guardar limite'}
      </Button>
    </div>
  )
}
