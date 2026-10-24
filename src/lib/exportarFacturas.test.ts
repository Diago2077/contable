import { describe, expect, it } from 'vitest'
import type { FacturaConRelaciones, NotaCredito, PagoFactura } from './database.types'
import { armarHojas, construirLibro, nombreArchivo, serieFecha } from './exportarFacturas'

const CDC = '01444444017001001001452822017012515873260988'

function factura(parcial: Partial<FacturaConRelaciones> = {}): FacturaConRelaciones {
  return {
    id: 'f1',
    empresa_id: 'e1',
    contribuyente_id: 'c1',
    plan_cuenta_id: null,
    tipo_operacion: 'compra',
    numero_factura: '001-001-0014528',
    fecha_factura: '2026-08-03',
    timbrado: '18387080',
    timbrado_vencimiento: '2026-10-31',
    condicion_venta: 'contado',
    cdc: CDC,
    proveedor_nombre: 'DR PCS E.A.S.',
    proveedor_ruc: '80137878-8',
    proveedor_direccion: null,
    cliente_nombre: 'Fastro S.A.',
    cliente_ruc: '80119851-8',
    cliente_direccion: null,
    moneda: 'PYG',
    tipo_cambio: null,
    exentas: 0,
    gravado_5: 0,
    gravado_10: 1500000,
    iva_5: 0,
    iva_10: 136364,
    total: 1500000,
    iva_total: 136364,
    subtotal: 1363636,
    notas_credito_total: 0,
    pagado_total: 0,
    saldo: 1500000,
    estado_pago: 'pendiente',
    forma_pago: null,
    observaciones: null,
    archivo_path: null,
    archivo_nombre: null,
    archivo_mime: null,
    extraccion_raw: null,
    created_by: null,
    created_at: '2026-08-03T12:00:00Z',
    updated_at: '2026-08-03T12:00:00Z',
    plan_cuentas: { id: 'p1', cuenta: '41112', denominacion: 'Ventas de Servicios' },
    factura_detalles: [],
    notas_credito: [],
    pagos_factura: [],
    ...parcial,
  }
}

const nota = (parcial: Partial<NotaCredito> = {}): NotaCredito =>
  ({
    id: 'n1',
    factura_id: 'f1',
    numero_nota: '001-001-0000007',
    fecha_nota: '2026-08-10',
    cdc: null,
    motivo: 'Devolución',
    timbrado: null,
    exentas: 0,
    gravado_5: 0,
    gravado_10: 200000,
    iva_5: 0,
    iva_10: 18182,
    total: 200000,
    ...parcial,
  }) as NotaCredito

const pago = (parcial: Partial<PagoFactura> = {}): PagoFactura =>
  ({
    id: 'p1',
    factura_id: 'f1',
    fecha_pago: '2026-08-20',
    monto: 800000,
    medio_pago: 'transferencia',
    referencia: 'OP 123',
    observaciones: null,
    ...parcial,
  }) as PagoFactura

/** Valor de una celda de la hoja de facturas, buscando la columna por su titulo. */
function celda(hoja: ReturnType<typeof armarHojas>[number], fila: number, titulo: string) {
  const i = hoja.columnas.findIndex((c) => c.titulo === titulo)
  expect(i, `no hay columna "${titulo}"`).toBeGreaterThanOrEqual(0)
  return hoja.filas[fila][i]
}

describe('armarHojas', () => {
  it('arma las cuatro hojas, aunque no haya nada que poner en algunas', () => {
    const hojas = armarHojas([factura()])
    expect(hojas.map((h) => h.nombre)).toEqual(['Facturas', 'Detalle', 'Notas de crédito', 'Pagos y cobros'])
    expect(hojas[0].filas).toHaveLength(1)
    expect(hojas[1].filas).toHaveLength(0)
  })

  it('cada fila tiene tantas celdas como columnas', () => {
    const hojas = armarHojas([
      factura({
        notas_credito: [nota()],
        pagos_factura: [pago()],
        factura_detalles: [
          { id: 'd1', factura_id: 'f1', orden: 0, descripcion: 'Servicio', cantidad: 1, precio_unitario: 1500000, subtotal_linea: 1500000, tasa_iva: 10 },
        ],
      }),
    ])
    for (const hoja of hojas) {
      for (const fila of hoja.filas) expect(fila).toHaveLength(hoja.columnas.length)
    }
  })

  it('la columna de moneda apunta a la columna de moneda', () => {
    for (const hoja of armarHojas([factura()])) {
      expect(hoja.columnas[hoja.columnaMoneda].titulo).toBe('Moneda')
    }
  })

  it('en la hoja de facturas calcula neto, pagado, saldo y estado con notas y pagos', () => {
    const [hoja] = armarHojas([factura({ notas_credito: [nota()], pagos_factura: [pago()] })])
    expect(celda(hoja, 0, 'Total')).toBe(1500000)
    expect(celda(hoja, 0, 'Notas de crédito')).toBe(200000)
    expect(celda(hoja, 0, 'Neto')).toBe(1300000)
    expect(celda(hoja, 0, 'Pagado / cobrado')).toBe(800000)
    expect(celda(hoja, 0, 'Saldo')).toBe(500000)
    expect(celda(hoja, 0, 'Estado')).toBe('Parcial')
  })

  it('llama cobrada a una venta saldada y pagada a una compra saldada', () => {
    const [compra] = armarHojas([factura({ pagos_factura: [pago({ monto: 1500000 })] })])
    expect(celda(compra, 0, 'Estado')).toBe('Pagada')
    const [venta] = armarHojas([factura({ tipo_operacion: 'venta', pagos_factura: [pago({ monto: 1500000 })] })])
    expect(celda(venta, 0, 'Estado')).toBe('Cobrada')
  })

  it('una factura sin notas ni pagos sale pendiente con saldo igual al total', () => {
    const [hoja] = armarHojas([factura()])
    expect(celda(hoja, 0, 'Estado')).toBe('Pendiente')
    expect(celda(hoja, 0, 'Saldo')).toBe(1500000)
  })

  it('usa al proveedor como contraparte en una compra y al cliente en una venta', () => {
    const hojas = armarHojas([
      factura({ id: 'a', pagos_factura: [pago()] }),
      factura({ id: 'b', tipo_operacion: 'venta', pagos_factura: [pago()] }),
    ])
    const pagos = hojas[3]
    expect(celda(pagos, 0, 'Proveedor / Cliente')).toBe('DR PCS E.A.S.')
    expect(celda(pagos, 1, 'Proveedor / Cliente')).toBe('Fastro S.A.')
  })

  it('numera las lineas de detalle de cada factura desde 1, en orden', () => {
    const lineas = [
      { id: 'd2', factura_id: 'f1', orden: 1, descripcion: 'Segunda', cantidad: 1, precio_unitario: 1, subtotal_linea: 1, tasa_iva: 10 },
      { id: 'd1', factura_id: 'f1', orden: 0, descripcion: 'Primera', cantidad: 1, precio_unitario: 1, subtotal_linea: 1, tasa_iva: 10 },
    ]
    const hojas = armarHojas([factura({ factura_detalles: lineas }), factura({ id: 'g', factura_detalles: lineas })])
    const detalle = hojas[1]
    expect(detalle.filas.map((f) => [f[3], f[4]])).toEqual([
      [1, 'Primera'],
      [2, 'Segunda'],
      [1, 'Primera'],
      [2, 'Segunda'],
    ])
  })

  it('pone la nota de credito junto al numero de la factura que modifica', () => {
    const [, , notas] = armarHojas([factura({ notas_credito: [nota()] })])
    expect(celda(notas, 0, 'N° nota')).toBe('001-001-0000007')
    expect(celda(notas, 0, 'N° factura')).toBe('001-001-0014528')
    expect(celda(notas, 0, 'Total')).toBe(200000)
  })

  it('traduce el medio de pago al nombre que ve el usuario', () => {
    const [, , , pagos] = armarHojas([factura({ pagos_factura: [pago({ medio_pago: 'cheque' })] })])
    expect(celda(pagos, 0, 'Medio')).toBe('Cheque')
  })
})

describe('serieFecha', () => {
  it('da los numeros de serie de Excel conocidos', () => {
    expect(serieFecha('1970-01-01')).toBe(25569)
    expect(serieFecha('2000-01-01')).toBe(36526)
  })

  it('no depende de la zona horaria de quien exporta', () => {
    // Un Date local a medianoche cae un dia antes con husos negativos; esto es puro calculo en UTC
    expect(serieFecha('2026-08-03')! - serieFecha('2026-08-02')!).toBe(1)
  })

  it('devuelve null si no hay fecha', () => {
    expect(serieFecha(null)).toBeNull()
    expect(serieFecha('')).toBeNull()
  })
})

describe('nombreArchivo', () => {
  it('saca las comillas y demas caracteres que Windows no acepta', () => {
    const nombre = nombreArchivo('BEAUTY GROUP PARAGUAY" SOCIEDAD ANONIMA', new Date(2026, 8, 5))
    expect(nombre).toBe('Facturas - BEAUTY GROUP PARAGUAY SOCIEDAD ANONIMA - 2026-09-05.xlsx')
    expect(nombre).not.toMatch(/["\\/:*?<>|]/)
  })

  it('no se rompe con una razon social vacia', () => {
    expect(nombreArchivo('', new Date(2026, 0, 3))).toBe('Facturas - Contribuyente - 2026-01-03.xlsx')
  })
})

describe('construirLibro: el archivo real', () => {
  async function leer(facturas: FacturaConRelaciones[]) {
    const XLSX = await import('xlsx')
    const libro = await construirLibro(facturas)
    // Ida y vuelta por bytes: lo que se ve es lo que Excel va a abrir
    const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' })
    return { XLSX, leido: XLSX.read(bytes, { type: 'array' }) }
  }

  it('el CDC queda como texto de 44 digitos, sin notacion cientifica', async () => {
    const { XLSX, leido } = await leer([factura()])
    const hoja = leido.Sheets['Facturas']
    const col = 5 // CDC
    const c = hoja[XLSX.utils.encode_cell({ r: 1, c: col })]
    expect(c.t).toBe('s')
    expect(c.v).toBe(CDC)
    expect(String(c.v)).toHaveLength(44)
  })

  it('los montos son numeros y no texto', async () => {
    const { XLSX, leido } = await leer([factura()])
    const hoja = leido.Sheets['Facturas']
    const total = hoja[XLSX.utils.encode_cell({ r: 1, c: 19 })]
    expect(total.t).toBe('n')
    expect(total.v).toBe(1500000)
  })

  it('las fechas son fechas de Excel y se ven como dd/mm/aaaa', async () => {
    const { XLSX, leido } = await leer([factura({ fecha_factura: '2026-08-03' })])
    const hoja = leido.Sheets['Facturas']
    const c = hoja[XLSX.utils.encode_cell({ r: 1, c: 0 })]
    expect(c.t).toBe('n')
    expect(c.w).toBe('03/08/2026')
  })

  it('los guaranies van sin decimales y las otras monedas con dos', async () => {
    const { XLSX, leido } = await leer([
      factura({ id: 'a', total: 1500000, moneda: 'PYG' }),
      factura({ id: 'b', total: 1234.5, moneda: 'USD' }),
    ])
    const hoja = leido.Sheets['Facturas']
    const total = (r: number) => hoja[XLSX.utils.encode_cell({ r, c: 19 })]
    expect(total(1).w).toBe('1,500,000')
    expect(total(2).w).toBe('1,234.50')
  })

  it('una cantidad entera se ve como 1 y no como "1."', async () => {
    const linea = { id: 'd1', factura_id: 'f1', orden: 0, descripcion: 'Servicio', cantidad: 1, precio_unitario: 1500000, subtotal_linea: 1500000, tasa_iva: 10 }
    const { XLSX, leido } = await leer([factura({ factura_detalles: [linea, { ...linea, id: 'd2', orden: 1, cantidad: 2.5 }] })])
    const hoja = leido.Sheets['Detalle']
    expect(hoja[XLSX.utils.encode_cell({ r: 1, c: 5 })].w).toBe('1')
    expect(hoja[XLSX.utils.encode_cell({ r: 2, c: 5 })].w).toBe('2.5')
  })

  it('trae las cuatro hojas y el filtro automatico en las que tienen filas', async () => {
    const { leido } = await leer([factura({ pagos_factura: [pago()] })])
    expect(leido.SheetNames).toEqual(['Facturas', 'Detalle', 'Notas de crédito', 'Pagos y cobros'])
    expect(leido.Sheets['Facturas']['!autofilter']).toBeTruthy()
  })
})
