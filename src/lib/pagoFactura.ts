import type { MedioPago, PagoFactura, PagoFacturaInsert, PagoFacturaUpdate } from './database.types'
import { parseMonto } from './format'

/** Estado editable del comprobante de pago: todo texto, se parsea recien al guardar. */
export interface PagoFormState {
  fecha_pago: string // yyyy-mm-dd
  monto: string
  medio_pago: MedioPago
  referencia: string
  observaciones: string
}

/** Hoy en yyyy-mm-dd, en hora local (toISOString devolveria la de Greenwich, que a la noche ya es "manana"). */
export function hoyISO(ahora = new Date()): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

/** Por defecto se propone pagar lo que falta, que es lo que pasa casi siempre. */
export function pagoNuevo(saldo: number, ahora = new Date()): PagoFormState {
  return {
    fecha_pago: hoyISO(ahora),
    monto: saldo > 0 ? String(saldo) : '',
    medio_pago: 'transferencia',
    referencia: '',
    observaciones: '',
  }
}

export function pagoAFormState(pago: PagoFactura): PagoFormState {
  return {
    fecha_pago: pago.fecha_pago,
    monto: String(pago.monto),
    medio_pago: pago.medio_pago,
    referencia: pago.referencia ?? '',
    observaciones: pago.observaciones ?? '',
  }
}

/** Devuelve el mensaje a mostrar si falta algo que la base no va a aceptar, o null si esta bien. */
export function validarPago(form: PagoFormState): string | null {
  if (!form.fecha_pago) return 'Falta la fecha.'
  if (parseMonto(form.monto) <= 0) return 'El monto tiene que ser mayor a cero.'
  return null
}

export function pagoFormAUpdate(form: PagoFormState): PagoFacturaUpdate {
  return {
    fecha_pago: form.fecha_pago,
    monto: parseMonto(form.monto),
    medio_pago: form.medio_pago,
    referencia: form.referencia.trim() || null,
    observaciones: form.observaciones.trim() || null,
  }
}

export function pagoFormAInsert(args: {
  empresaId: string
  contribuyenteId: string
  facturaId: string
  createdBy: string
  archivoPath: string | null
  archivoNombre: string | null
  archivoMime: string | null
  form: PagoFormState
}): PagoFacturaInsert {
  const { empresaId, contribuyenteId, facturaId, createdBy, archivoPath, archivoNombre, archivoMime, form } = args
  return {
    ...(pagoFormAUpdate(form) as Required<PagoFacturaUpdate>),
    empresa_id: empresaId,
    contribuyente_id: contribuyenteId,
    factura_id: facturaId,
    archivo_path: archivoPath,
    archivo_nombre: archivoNombre,
    archivo_mime: archivoMime,
    created_by: createdBy,
  }
}
