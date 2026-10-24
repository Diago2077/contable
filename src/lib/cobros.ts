import type { TonoBadge } from '@/components/ui/badge'
import type { EstadoPago, TipoOperacion } from './database.types'

/**
 * Saldo y estado de pago de una factura.
 *
 * ESPEJO de las columnas generadas `saldo` y `estado_pago` de la migracion
 * 018: la base es la que manda (de ahi sale el filtro por estado del
 * listado), y esto existe para que el detalle de una factura se actualice en
 * el momento en que se carga una nota o un pago, sin esperar a releerla. Si
 * se cambia una regla, hay que cambiarla en los dos lados.
 */

// El "+ 0" convierte -0 en 0: sin eso un saldo que cierra justo aparece como "-0"
const centavos = (n: number) => Math.round(n * 100) / 100 + 0

export interface Cobros {
  /** Lo que queda por pagar o cobrar de la factura despues de las notas de credito. */
  neto: number
  /** Negativo si se pago de mas. */
  saldo: number
  estado: EstadoPago
}

export function calcularCobros(total: number, notasCredito: number, pagado: number): Cobros {
  const neto = centavos(total - notasCredito)
  const saldo = centavos(neto - pagado)

  let estado: EstadoPago
  if (total > 0 && notasCredito >= total) estado = 'acreditada'
  else if (pagado <= 0) estado = 'pendiente'
  else if (pagado >= neto) estado = 'pagada'
  else estado = 'parcial'

  return { neto, saldo, estado }
}

/**
 * En una compra se le paga al proveedor; en una venta se le cobra al cliente.
 * La tabla es la misma, lo que cambia es como se lo llama en pantalla.
 */
export function terminosDePago(tipo: TipoOperacion) {
  return tipo === 'venta'
    ? {
        singular: 'cobro',
        plural: 'cobros',
        registrar: 'Registrar cobro',
        pagada: 'Cobrada',
        verbo: 'cobrado',
      }
    : {
        singular: 'pago',
        plural: 'pagos',
        registrar: 'Registrar pago',
        pagada: 'Pagada',
        verbo: 'pagado',
      }
}

export function etiquetaEstadoPago(estado: EstadoPago, tipo: TipoOperacion): string {
  switch (estado) {
    case 'pendiente':
      return 'Pendiente'
    case 'parcial':
      return 'Parcial'
    case 'pagada':
      return terminosDePago(tipo).pagada
    case 'acreditada':
      return 'Acreditada'
  }
}

export const TONO_ESTADO_PAGO: Record<EstadoPago, TonoBadge> = {
  pendiente: 'warning',
  parcial: 'primary',
  pagada: 'success',
  acreditada: 'neutral',
}
