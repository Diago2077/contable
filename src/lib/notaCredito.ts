import { normalizarCdc, revisarCdc } from './cdc'
import type { Factura, NotaCredito, NotaCreditoInsert, NotaCreditoUpdate } from './database.types'
import { parseFecha, parseMonto } from './format'

/** Espejo del json_schema de nota de credito en api/extraer.ts. */
export interface NotaCreditoExtraccion {
  numero_nota: string | null
  fecha_nota: string | null
  timbrado: string | null
  timbrado_vencimiento: string | null
  cdc: string | null
  /** Numero de la factura que la nota dice modificar, tal como lo leyo la IA. */
  factura_numero: string | null
  motivo: string | null
  exentas: number
  gravado_5: number
  iva_5: number
  gravado_10: number
  iva_10: number
  total: number
  observaciones: string | null
  /** Lo agrega el servidor, no la IA: el IVA leido no cuadraba con las gravadas. */
  iva_recalculado?: boolean
}

/** Estado editable de la nota: todo texto, se parsea recien al guardar. */
export interface NotaCreditoFormState {
  numero_nota: string
  fecha_nota: string // yyyy-mm-dd
  timbrado: string
  timbrado_vencimiento: string // yyyy-mm-dd
  cdc: string
  motivo: string
  exentas: string
  gravado_5: string
  iva_5: string
  gravado_10: string
  iva_10: string
  total: string
  observaciones: string
}

export const NOTA_VACIA: NotaCreditoFormState = {
  numero_nota: '',
  fecha_nota: '',
  timbrado: '',
  timbrado_vencimiento: '',
  cdc: '',
  motivo: '',
  exentas: '',
  gravado_5: '',
  iva_5: '',
  gravado_10: '',
  iva_10: '',
  total: '',
  observaciones: '',
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const s = (v: string | null | undefined) => v ?? ''

export function extraccionANotaForm(datos: NotaCreditoExtraccion): NotaCreditoFormState {
  return {
    numero_nota: s(datos.numero_nota),
    fecha_nota: parseFecha(datos.fecha_nota) ?? '',
    timbrado: s(datos.timbrado),
    timbrado_vencimiento: parseFecha(datos.timbrado_vencimiento) ?? '',
    cdc: normalizarCdc(datos.cdc),
    motivo: s(datos.motivo),
    exentas: n(datos.exentas),
    gravado_5: n(datos.gravado_5),
    iva_5: n(datos.iva_5),
    gravado_10: n(datos.gravado_10),
    iva_10: n(datos.iva_10),
    total: n(datos.total),
    observaciones: s(datos.observaciones),
  }
}

export function notaAFormState(nota: NotaCredito): NotaCreditoFormState {
  return {
    numero_nota: s(nota.numero_nota),
    fecha_nota: nota.fecha_nota ?? '',
    timbrado: s(nota.timbrado),
    timbrado_vencimiento: nota.timbrado_vencimiento ?? '',
    cdc: s(nota.cdc),
    motivo: s(nota.motivo),
    exentas: n(nota.exentas),
    gravado_5: n(nota.gravado_5),
    iva_5: n(nota.iva_5),
    gravado_10: n(nota.gravado_10),
    iva_10: n(nota.iva_10),
    total: n(nota.total),
    observaciones: s(nota.observaciones),
  }
}

/** Los montos van siempre en positivo: la nota resta, pero el signo lo pone quien la usa. */
const monto = (v: string) => Math.abs(parseMonto(v))

function camposEditables(form: NotaCreditoFormState): NotaCreditoUpdate {
  return {
    numero_nota: form.numero_nota.trim() || null,
    fecha_nota: form.fecha_nota || null,
    timbrado: form.timbrado.trim() || null,
    timbrado_vencimiento: form.timbrado_vencimiento || null,
    cdc: normalizarCdc(form.cdc) || null,
    motivo: form.motivo.trim() || null,
    exentas: monto(form.exentas),
    gravado_5: monto(form.gravado_5),
    gravado_10: monto(form.gravado_10),
    iva_5: monto(form.iva_5),
    iva_10: monto(form.iva_10),
    total: monto(form.total),
    observaciones: form.observaciones.trim() || null,
  }
}

export function notaFormAUpdate(form: NotaCreditoFormState): NotaCreditoUpdate {
  return camposEditables(form)
}

export function notaFormAInsert(args: {
  empresaId: string
  contribuyenteId: string
  facturaId: string
  createdBy: string
  archivoPath: string | null
  archivoNombre: string | null
  archivoMime: string | null
  extraccionRaw: unknown
  form: NotaCreditoFormState
}): NotaCreditoInsert {
  const { empresaId, contribuyenteId, facturaId, createdBy, archivoPath, archivoNombre, archivoMime, extraccionRaw, form } =
    args
  return {
    ...(camposEditables(form) as Required<NotaCreditoUpdate>),
    empresa_id: empresaId,
    contribuyente_id: contribuyenteId,
    factura_id: facturaId,
    archivo_path: archivoPath,
    archivo_nombre: archivoNombre,
    archivo_mime: archivoMime,
    extraccion_raw: extraccionRaw ?? null,
    created_by: createdBy,
  }
}

/**
 * Problemas del CDC de la nota. El emisor de la nota es el mismo que el de la
 * factura que modifica, asi que se compara contra el RUC del proveedor de esa
 * factura.
 */
export function advertenciasCdcNota(form: NotaCreditoFormState, factura: Pick<Factura, 'proveedor_ruc'>): string[] {
  return revisarCdc(form.cdc, {
    rucEmisor: factura.proveedor_ruc,
    numero: form.numero_nota,
    fecha: form.fecha_nota,
    esperado: 'nota_credito',
  })
}

const digitos = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '')

/**
 * Si el numero de factura que la IA leyo en la nota es el de la factura a la
 * que se la esta agregando. null = no se puede saber (falta alguno de los dos).
 *
 * Se comparan los ultimos digitos en comun, asi sirve tanto "001-001-0000124"
 * como solo "124".
 */
export function coincideFacturaReferida(
  leido: string | null | undefined,
  numeroFactura: string | null | undefined,
): boolean | null {
  const a = digitos(leido)
  const b = digitos(numeroFactura)
  if (!a || !b) return null
  const k = Math.min(a.length, b.length, 13)
  return a.slice(-k) === b.slice(-k)
}
