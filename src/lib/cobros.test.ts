import { describe, expect, it } from 'vitest'
import { calcularCobros, etiquetaEstadoPago, terminosDePago } from './cobros'

/**
 * Los mismos escenarios que se probaron contra la base real en la migracion
 * 018. Si esto y las columnas generadas se desalinean, el detalle de una
 * factura mostraria un estado distinto al del listado.
 */
describe('calcularCobros', () => {
  it('una factura nueva queda pendiente con saldo igual al total', () => {
    expect(calcularCobros(1500000, 0, 0)).toEqual({ neto: 1500000, saldo: 1500000, estado: 'pendiente' })
  })

  it('una nota de credito baja el saldo pero sigue pendiente', () => {
    expect(calcularCobros(1500000, 200000, 0)).toEqual({ neto: 1300000, saldo: 1300000, estado: 'pendiente' })
  })

  it('un pago que no alcanza la deja en parcial', () => {
    expect(calcularCobros(1500000, 200000, 800000)).toEqual({ neto: 1300000, saldo: 500000, estado: 'parcial' })
  })

  it('completar lo que queda la deja pagada con saldo cero', () => {
    expect(calcularCobros(1500000, 200000, 1300000)).toEqual({ neto: 1300000, saldo: 0, estado: 'pagada' })
  })

  it('una nota que cubre todo la deja acreditada', () => {
    expect(calcularCobros(1500000, 1500000, 0).estado).toBe('acreditada')
  })

  it('una nota que cubre todo gana aunque haya pagos', () => {
    expect(calcularCobros(1500000, 1500000, 100000).estado).toBe('acreditada')
  })

  it('una factura en cero no se marca acreditada si no hay pagos', () => {
    expect(calcularCobros(0, 0, 0).estado).toBe('pendiente')
  })

  it('pagar de mas la deja pagada con saldo negativo', () => {
    expect(calcularCobros(100000, 0, 150000)).toEqual({ neto: 100000, saldo: -50000, estado: 'pagada' })
  })

  it('no arrastra errores de coma flotante en los centavos', () => {
    // 0.1 + 0.2 no es 0.3 en coma flotante; el saldo tiene que cerrar igual
    expect(calcularCobros(0.3, 0, 0.1 + 0.2).saldo).toBe(0)
  })
})

describe('terminosDePago', () => {
  it('habla de pagos en una compra y de cobros en una venta', () => {
    expect(terminosDePago('compra').registrar).toBe('Registrar pago')
    expect(terminosDePago('venta').registrar).toBe('Registrar cobro')
  })
})

describe('etiquetaEstadoPago', () => {
  it('adapta pagada/cobrada al tipo de operacion y deja el resto igual', () => {
    expect(etiquetaEstadoPago('pagada', 'compra')).toBe('Pagada')
    expect(etiquetaEstadoPago('pagada', 'venta')).toBe('Cobrada')
    expect(etiquetaEstadoPago('parcial', 'venta')).toBe('Parcial')
    expect(etiquetaEstadoPago('pendiente', 'compra')).toBe('Pendiente')
    expect(etiquetaEstadoPago('acreditada', 'compra')).toBe('Acreditada')
  })
})
