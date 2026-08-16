import type { Factura, FacturaDetalleInsert, FacturaInsert, FacturaUpdate, TipoOperacion } from './database.types'
import { formatFecha, parseFecha, parseMonto } from './format'

/** Espejo del json_schema de api/extraer.ts. */
export interface ExtraccionIA {
  tipo_operacion: TipoOperacion
  numero_factura: string | null
  fecha_factura: string | null
  timbrado: string | null
  timbrado_vencimiento: string | null
  condicion_venta: 'contado' | 'credito' | null
  proveedor_nombre: string | null
  proveedor_ruc: string | null
  proveedor_direccion: string | null
  cliente_nombre: string | null
  cliente_ruc: string | null
  cliente_direccion: string | null
  moneda: string
  tipo_cambio: number | null
  exentas: number
  gravado_5: number
  iva_5: number
  gravado_10: number
  iva_10: number
  total: number
  forma_pago: string | null
  observaciones: string | null
  plan_cuenta_id: string | null
  detalles: Array<{
    descripcion: string | null
    cantidad: number | null
    precio_unitario: number | null
    subtotal_linea: number | null
    tasa_iva: number | null
  }>
}

/** Estado editable de la pantalla de revision. Todo texto: se parsea recien al guardar. */
export interface FacturaFormState {
  tipo_operacion: TipoOperacion
  numero_factura: string
  fecha_factura: string // yyyy-mm-dd, para <input type="date">
  timbrado: string
  timbrado_vencimiento: string // yyyy-mm-dd
  condicion_venta: '' | 'contado' | 'credito'
  proveedor_nombre: string
  proveedor_ruc: string
  proveedor_direccion: string
  cliente_nombre: string
  cliente_ruc: string
  cliente_direccion: string
  moneda: string
  tipo_cambio: string
  exentas: string
  gravado_5: string
  iva_5: string
  gravado_10: string
  iva_10: string
  total: string
  forma_pago: string
  observaciones: string
  plan_cuenta_id: string
  detalles: Array<{
    descripcion: string
    cantidad: string
    precio_unitario: string
    subtotal_linea: string
    tasa_iva: string
  }>
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const s = (v: string | null | undefined) => v ?? ''

export function extraccionAFormState(datos: ExtraccionIA): FacturaFormState {
  return {
    tipo_operacion: datos.tipo_operacion === 'venta' ? 'venta' : 'compra',
    numero_factura: s(datos.numero_factura),
    fecha_factura: parseFecha(datos.fecha_factura) ?? '',
    timbrado: s(datos.timbrado),
    timbrado_vencimiento: parseFecha(datos.timbrado_vencimiento) ?? '',
    condicion_venta: datos.condicion_venta === 'credito' ? 'credito' : datos.condicion_venta === 'contado' ? 'contado' : '',
    proveedor_nombre: s(datos.proveedor_nombre),
    proveedor_ruc: s(datos.proveedor_ruc),
    proveedor_direccion: s(datos.proveedor_direccion),
    cliente_nombre: s(datos.cliente_nombre),
    cliente_ruc: s(datos.cliente_ruc),
    cliente_direccion: s(datos.cliente_direccion),
    moneda: datos.moneda || 'PYG',
    tipo_cambio: n(datos.tipo_cambio),
    exentas: n(datos.exentas),
    gravado_5: n(datos.gravado_5),
    iva_5: n(datos.iva_5),
    gravado_10: n(datos.gravado_10),
    iva_10: n(datos.iva_10),
    total: n(datos.total),
    forma_pago: s(datos.forma_pago),
    observaciones: s(datos.observaciones),
    plan_cuenta_id: s(datos.plan_cuenta_id),
    detalles: (datos.detalles ?? []).map((d) => ({
      descripcion: s(d.descripcion),
      cantidad: n(d.cantidad),
      precio_unitario: n(d.precio_unitario),
      subtotal_linea: n(d.subtotal_linea),
      tasa_iva: d.tasa_iva === null || d.tasa_iva === undefined ? '' : String(d.tasa_iva),
    })),
  }
}

/** Resumen legible para la tarjeta colapsada: "12/03/2026 · Total ₲ 150.000". */
export function resumenFactura(form: FacturaFormState): string {
  const partes = [form.numero_factura && `N° ${form.numero_factura}`, formatFecha(form.fecha_factura)].filter(
    Boolean,
  )
  return partes.join(' · ')
}

export function formStateAFacturaInsert(args: {
  empresaId: string
  contribuyenteId: string
  createdBy: string
  archivoPath: string | null
  archivoNombre: string | null
  archivoMime: string | null
  extraccionRaw: unknown
  form: FacturaFormState
}): FacturaInsert {
  const { empresaId, contribuyenteId, createdBy, archivoPath, archivoNombre, archivoMime, extraccionRaw, form } = args
  return {
    empresa_id: empresaId,
    contribuyente_id: contribuyenteId,
    plan_cuenta_id: form.plan_cuenta_id || null,
    tipo_operacion: form.tipo_operacion,
    numero_factura: form.numero_factura.trim() || null,
    fecha_factura: form.fecha_factura || null,
    timbrado: form.timbrado.trim() || null,
    timbrado_vencimiento: form.timbrado_vencimiento || null,
    condicion_venta: form.condicion_venta || null,
    proveedor_nombre: form.proveedor_nombre.trim() || null,
    proveedor_ruc: form.proveedor_ruc.trim() || null,
    proveedor_direccion: form.proveedor_direccion.trim() || null,
    cliente_nombre: form.cliente_nombre.trim() || null,
    cliente_ruc: form.cliente_ruc.trim() || null,
    cliente_direccion: form.cliente_direccion.trim() || null,
    moneda: form.moneda.trim() || 'PYG',
    tipo_cambio: form.tipo_cambio.trim() ? parseMonto(form.tipo_cambio) : null,
    exentas: parseMonto(form.exentas),
    gravado_5: parseMonto(form.gravado_5),
    gravado_10: parseMonto(form.gravado_10),
    iva_5: parseMonto(form.iva_5),
    iva_10: parseMonto(form.iva_10),
    total: parseMonto(form.total),
    forma_pago: form.forma_pago.trim() || null,
    observaciones: form.observaciones.trim() || null,
    archivo_path: archivoPath,
    archivo_nombre: archivoNombre,
    archivo_mime: archivoMime,
    extraccion_raw: extraccionRaw,
    created_by: createdBy,
  }
}

export function formStateADetalles(form: FacturaFormState): Omit<FacturaDetalleInsert, 'factura_id'>[] {
  return form.detalles
    .filter((d) => d.descripcion.trim())
    .map((d, i) => ({
      orden: i,
      descripcion: d.descripcion.trim(),
      cantidad: d.cantidad.trim() ? parseMonto(d.cantidad) : null,
      precio_unitario: d.precio_unitario.trim() ? parseMonto(d.precio_unitario) : null,
      subtotal_linea: d.subtotal_linea.trim() ? parseMonto(d.subtotal_linea) : null,
      tasa_iva: d.tasa_iva.trim() ? Number(d.tasa_iva) : null,
    }))
}

/** total = exentas + gravado_5 + gravado_10, para avisar si no cierra. */
export function totalCalculado(form: FacturaFormState): number {
  return parseMonto(form.exentas) + parseMonto(form.gravado_5) + parseMonto(form.gravado_10)
}

/** Factura ya guardada -> estado editable del formulario. Sin detalles: no se editan desde el listado. */
export function facturaAFormState(f: Factura): FacturaFormState {
  return {
    tipo_operacion: f.tipo_operacion,
    numero_factura: s(f.numero_factura),
    fecha_factura: f.fecha_factura ?? '',
    timbrado: s(f.timbrado),
    timbrado_vencimiento: f.timbrado_vencimiento ?? '',
    condicion_venta: f.condicion_venta ?? '',
    proveedor_nombre: s(f.proveedor_nombre),
    proveedor_ruc: s(f.proveedor_ruc),
    proveedor_direccion: s(f.proveedor_direccion),
    cliente_nombre: s(f.cliente_nombre),
    cliente_ruc: s(f.cliente_ruc),
    cliente_direccion: s(f.cliente_direccion),
    moneda: f.moneda || 'PYG',
    tipo_cambio: n(f.tipo_cambio),
    exentas: n(f.exentas),
    gravado_5: n(f.gravado_5),
    iva_5: n(f.iva_5),
    gravado_10: n(f.gravado_10),
    iva_10: n(f.iva_10),
    total: n(f.total),
    forma_pago: s(f.forma_pago),
    observaciones: s(f.observaciones),
    plan_cuenta_id: f.plan_cuenta_id ?? '',
    detalles: [],
  }
}

/** Cambios editables desde el listado: no toca archivo, extraccion_raw ni created_by. */
export function formStateAFacturaUpdate(form: FacturaFormState): FacturaUpdate {
  return {
    plan_cuenta_id: form.plan_cuenta_id || null,
    tipo_operacion: form.tipo_operacion,
    numero_factura: form.numero_factura.trim() || null,
    fecha_factura: form.fecha_factura || null,
    timbrado: form.timbrado.trim() || null,
    timbrado_vencimiento: form.timbrado_vencimiento || null,
    condicion_venta: form.condicion_venta || null,
    proveedor_nombre: form.proveedor_nombre.trim() || null,
    proveedor_ruc: form.proveedor_ruc.trim() || null,
    proveedor_direccion: form.proveedor_direccion.trim() || null,
    cliente_nombre: form.cliente_nombre.trim() || null,
    cliente_ruc: form.cliente_ruc.trim() || null,
    cliente_direccion: form.cliente_direccion.trim() || null,
    moneda: form.moneda.trim() || 'PYG',
    tipo_cambio: form.tipo_cambio.trim() ? parseMonto(form.tipo_cambio) : null,
    exentas: parseMonto(form.exentas),
    gravado_5: parseMonto(form.gravado_5),
    gravado_10: parseMonto(form.gravado_10),
    iva_5: parseMonto(form.iva_5),
    iva_10: parseMonto(form.iva_10),
    total: parseMonto(form.total),
    forma_pago: form.forma_pago.trim() || null,
    observaciones: form.observaciones.trim() || null,
  }
}
