import { describe, expect, it } from 'vitest'
import type { PagoFactura } from './database.types'
import { hoyISO, pagoAFormState, pagoFormAInsert, pagoFormAUpdate, pagoNuevo, validarPago } from './pagoFactura'

describe('hoyISO', () => {
  it('usa la fecha local, no la de Greenwich', () => {
    // 23:30 del 5 de setiembre en hora local: toISOString() ya diria el dia 6 en UTC+0 o mas
    const tarde = new Date(2026, 8, 5, 23, 30)
    expect(hoyISO(tarde)).toBe('2026-09-05')
  })

  it('rellena mes y dia con cero', () => {
    expect(hoyISO(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('pagoNuevo', () => {
  it('propone pagar el saldo que queda', () => {
    const p = pagoNuevo(500000, new Date(2026, 8, 5))
    expect(p.monto).toBe('500000')
    expect(p.fecha_pago).toBe('2026-09-05')
    expect(p.medio_pago).toBe('transferencia')
  })

  it('no propone nada si ya no queda saldo', () => {
    expect(pagoNuevo(0).monto).toBe('')
    expect(pagoNuevo(-50000).monto).toBe('')
  })
})

describe('validarPago', () => {
  const ok = { fecha_pago: '2026-09-05', monto: '1.500.000', medio_pago: 'efectivo' as const, referencia: '', observaciones: '' }

  it('acepta un pago completo', () => {
    expect(validarPago(ok)).toBeNull()
  })

  it('pide la fecha', () => {
    expect(validarPago({ ...ok, fecha_pago: '' })).toMatch(/fecha/)
  })

  it('rechaza monto cero o vacio, que la base tambien rechaza', () => {
    expect(validarPago({ ...ok, monto: '' })).toMatch(/monto/)
    expect(validarPago({ ...ok, monto: '0' })).toMatch(/monto/)
  })
})

describe('conversion del formulario', () => {
  it('parsea el monto con puntos de miles y deja null lo vacio', () => {
    const u = pagoFormAUpdate({
      fecha_pago: '2026-09-05',
      monto: '1.500.000',
      medio_pago: 'cheque',
      referencia: '  ',
      observaciones: '',
    })
    expect(u).toEqual({
      fecha_pago: '2026-09-05',
      monto: 1500000,
      medio_pago: 'cheque',
      referencia: null,
      observaciones: null,
    })
  })

  it('ata el pago a su factura y puede no tener archivo', () => {
    const insert = pagoFormAInsert({
      empresaId: 'e1',
      contribuyenteId: 'c1',
      facturaId: 'f1',
      createdBy: 'u1',
      archivoPath: null,
      archivoNombre: null,
      archivoMime: null,
      form: pagoNuevo(100),
    })
    expect(insert).toMatchObject({ empresa_id: 'e1', contribuyente_id: 'c1', factura_id: 'f1', monto: 100, archivo_path: null })
  })

  it('carga un pago guardado para editarlo', () => {
    const f = pagoAFormState({
      fecha_pago: '2026-08-10',
      monto: 800000,
      medio_pago: 'transferencia',
      referencia: 'OP 123',
      observaciones: null,
    } as PagoFactura)
    expect(f).toEqual({
      fecha_pago: '2026-08-10',
      monto: '800000',
      medio_pago: 'transferencia',
      referencia: 'OP 123',
      observaciones: '',
    })
  })
})
