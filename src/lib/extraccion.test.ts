import { describe, expect, it } from 'vitest'
import type { Factura } from './database.types'
import {
  extraccionAFormState,
  facturaAFormState,
  formStateADetalles,
  formStateAFacturaInsert,
  ivaDeGravado,
  ivaNoCierra,
  totalCalculado,
  type ExtraccionIA,
  type FacturaFormState,
} from './extraccion'

/** Extraccion minima: todo null salvo lo que cada test necesite. */
function extraccion(parcial: Partial<ExtraccionIA> = {}): ExtraccionIA {
  return {
    tipo_operacion: 'compra',
    numero_factura: null,
    fecha_factura: null,
    timbrado: null,
    timbrado_vencimiento: null,
    condicion_venta: null,
    proveedor_nombre: null,
    proveedor_ruc: null,
    proveedor_direccion: null,
    cliente_nombre: null,
    cliente_ruc: null,
    cliente_direccion: null,
    moneda: 'PYG',
    tipo_cambio: null,
    exentas: 0,
    gravado_5: 0,
    iva_5: 0,
    gravado_10: 0,
    iva_10: 0,
    total: 0,
    forma_pago: null,
    observaciones: null,
    plan_cuenta_id: null,
    detalles: [],
    ...parcial,
  }
}

function form(parcial: Partial<FacturaFormState> = {}): FacturaFormState {
  return { ...extraccionAFormState(extraccion()), ...parcial }
}

describe('ivaDeGravado', () => {
  it('saca el 10% como la onceava parte del monto con IVA incluido', () => {
    // Verificado contra una factura real: 1.500.000 gravadas -> 136.363 de IVA
    expect(ivaDeGravado(1500000, 10)).toBeCloseTo(136363.64, 2)
  })

  it('saca el 5% como la veintiunava parte', () => {
    expect(ivaDeGravado(21000, 5)).toBe(1000)
  })

  it('devuelve 0 si no hay gravadas', () => {
    expect(ivaDeGravado(0, 10)).toBe(0)
    expect(ivaDeGravado(0, 5)).toBe(0)
  })
})

describe('ivaNoCierra', () => {
  it('acepta el redondeo de la factura impresa', () => {
    // El papel dice 136.363 y la cuenta exacta da 136.363,63: no es un error
    expect(ivaNoCierra(form({ gravado_10: '1500000', iva_10: '136363' }), 10)).toBe(false)
  })

  it('marca un IVA que no se corresponde con las gravadas', () => {
    expect(ivaNoCierra(form({ gravado_10: '1500000', iva_10: '150000' }), 10)).toBe(true)
  })

  it('no dice nada si los dos campos estan vacios', () => {
    expect(ivaNoCierra(form({ gravado_10: '', iva_10: '' }), 10)).toBe(false)
  })

  it('marca cuando hay gravadas pero el IVA quedo en cero', () => {
    expect(ivaNoCierra(form({ gravado_10: '1500000', iva_10: '0' }), 10)).toBe(true)
  })
})

describe('totalCalculado', () => {
  it('suma exentas mas las dos gravadas', () => {
    expect(totalCalculado(form({ exentas: '1000', gravado_5: '2000', gravado_10: '3000' }))).toBe(6000)
  })
})

describe('extraccionAFormState', () => {
  it('pasa la fecha al formato del input date', () => {
    expect(extraccionAFormState(extraccion({ fecha_factura: '03/08/2026' })).fecha_factura).toBe('2026-08-03')
  })

  it('convierte los null en texto vacio', () => {
    const f = extraccionAFormState(extraccion({ proveedor_nombre: null }))
    expect(f.proveedor_nombre).toBe('')
  })

  it('cae a compra ante un tipo de operacion raro', () => {
    expect(extraccionAFormState(extraccion({ tipo_operacion: 'venta' })).tipo_operacion).toBe('venta')
    const raro = extraccion({ tipo_operacion: 'otra' as ExtraccionIA['tipo_operacion'] })
    expect(extraccionAFormState(raro).tipo_operacion).toBe('compra')
  })

  it('cae a PYG si no vino moneda', () => {
    expect(extraccionAFormState(extraccion({ moneda: '' })).moneda).toBe('PYG')
  })

  it('descarta una condicion de venta que no reconoce', () => {
    const raro = extraccion({ condicion_venta: 'otra' as ExtraccionIA['condicion_venta'] })
    expect(extraccionAFormState(raro).condicion_venta).toBe('')
  })
})

describe('formStateAFacturaInsert', () => {
  const base = {
    empresaId: 'e1',
    contribuyenteId: 'c1',
    createdBy: 'u1',
    archivoPath: null,
    archivoNombre: null,
    archivoMime: null,
    extraccionRaw: null,
  }

  it('manda null en vez de texto vacio', () => {
    const insert = formStateAFacturaInsert({ ...base, form: form({ numero_factura: '   ' }) })
    expect(insert.numero_factura).toBeNull()
  })

  it('parsea los montos con puntos de miles', () => {
    const insert = formStateAFacturaInsert({ ...base, form: form({ total: '1.500.000' }) })
    expect(insert.total).toBe(1500000)
  })

  it('deja el plan de cuentas en null si no se eligio ninguno', () => {
    const insert = formStateAFacturaInsert({ ...base, form: form({ plan_cuenta_id: '' }) })
    expect(insert.plan_cuenta_id).toBeNull()
  })
})

describe('formStateADetalles', () => {
  it('descarta las lineas sin descripcion y numera el resto', () => {
    const detalles = formStateADetalles(
      form({
        detalles: [
          { descripcion: 'Servicio', cantidad: '1', precio_unitario: '1.500.000', subtotal_linea: '1.500.000', tasa_iva: '10' },
          { descripcion: '   ', cantidad: '', precio_unitario: '', subtotal_linea: '', tasa_iva: '' },
        ],
      }),
    )
    expect(detalles).toHaveLength(1)
    expect(detalles[0]).toMatchObject({ orden: 0, descripcion: 'Servicio', cantidad: 1, tasa_iva: 10 })
  })
})

describe('facturaAFormState', () => {
  it('deja lista para editar una factura ya guardada', () => {
    const factura = {
      tipo_operacion: 'venta',
      numero_factura: '001-001-0000124',
      fecha_factura: '2026-08-03',
      total: 1500000,
      gravado_10: 1500000,
      iva_10: 136363,
      moneda: 'PYG',
      plan_cuenta_id: 'pc1',
    } as Factura

    const f = facturaAFormState(factura)
    expect(f.numero_factura).toBe('001-001-0000124')
    expect(f.total).toBe('1500000')
    expect(f.plan_cuenta_id).toBe('pc1')
    // Los detalles no se editan desde el listado
    expect(f.detalles).toEqual([])
  })
})
