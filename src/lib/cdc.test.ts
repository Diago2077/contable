import { describe, expect, it } from 'vitest'
import { descomponerCdc, dvCdcCierra, normalizarCdc, revisarCdc } from './cdc'
import { calcularDV } from './format'

/**
 * Ejemplo oficial del Manual Tecnico de SIFEN. Si el algoritmo del digito
 * verificador estuviera mal, este es el test que lo delata: el ultimo 8 lo
 * calculo la SET, no nosotros.
 *
 * Importa porque con pesos 2 a 11 (el algoritmo correcto) el resultado es 8,
 * y con 2 a 12 daria 3: un ejemplo cualquiera podria coincidir de casualidad
 * con una variante equivocada, este no.
 */
const CDC_MANUAL_SIFEN = '01444444017001001001452822017012515873260988'

/** Arma un CDC con el DV bien calculado, para probar sin depender de un solo ejemplo. */
function armarCdc(p: {
  tipo?: string
  ruc?: string
  dvRuc?: string
  est?: string
  pun?: string
  num?: string
  fecha?: string
}) {
  const base =
    (p.tipo ?? '01') +
    (p.ruc ?? '80137878').padStart(8, '0') +
    (p.dvRuc ?? '8') +
    (p.est ?? '001') +
    (p.pun ?? '001') +
    (p.num ?? '0000124') +
    '2' +
    (p.fecha ?? '20260803') +
    '1' +
    '123456789'
  return base + calcularDV(base)
}

describe('normalizarCdc', () => {
  it('saca los espacios con que se imprime en el papel', () => {
    const impreso = CDC_MANUAL_SIFEN.replace(/(.{4})/g, '$1 ').trim()
    expect(impreso).toContain(' ')
    expect(normalizarCdc(impreso)).toBe(CDC_MANUAL_SIFEN)
  })

  it('devuelve vacio si no hay nada', () => {
    expect(normalizarCdc(null)).toBe('')
    expect(normalizarCdc(undefined)).toBe('')
  })
})

describe('dvCdcCierra', () => {
  it('valida el ejemplo del manual de SIFEN', () => {
    expect(dvCdcCierra(CDC_MANUAL_SIFEN)).toBe(true)
  })

  it('detecta un digito mal leido', () => {
    // Se cambia un digito del medio: el verificador original ya no corresponde
    const mal = CDC_MANUAL_SIFEN.slice(0, 20) + '9' + CDC_MANUAL_SIFEN.slice(21)
    expect(dvCdcCierra(mal)).toBe(false)
  })

  it('no valida lo que no tiene 44 digitos', () => {
    expect(dvCdcCierra(CDC_MANUAL_SIFEN.slice(0, 43))).toBe(false)
    expect(dvCdcCierra('')).toBe(false)
  })

  it('valida los CDC armados en los tests', () => {
    expect(dvCdcCierra(armarCdc({}))).toBe(true)
  })
})

describe('descomponerCdc', () => {
  it('separa cada parte del ejemplo del manual', () => {
    expect(descomponerCdc(CDC_MANUAL_SIFEN)).toEqual({
      tipoDocumento: '01',
      rucEmisor: '44444401',
      dvEmisor: '7',
      establecimiento: '001',
      puntoExpedicion: '001',
      numeroDocumento: '0014528',
      tipoContribuyente: '2',
      fechaEmision: '2017-01-25',
      tipoEmision: '1',
      codigoSeguridad: '587326098',
      dv: '8',
    })
  })

  it('el RUC embebido coincide con su propio DV', () => {
    const c = descomponerCdc(CDC_MANUAL_SIFEN)!
    expect(calcularDV(c.rucEmisor)).toBe(Number(c.dvEmisor))
  })

  it('saca los ceros a la izquierda de un RUC corto', () => {
    const c = descomponerCdc(armarCdc({ ruc: '1234567', dvRuc: '0' }))!
    expect(c.rucEmisor).toBe('1234567')
  })

  it('devuelve null si no tiene 44 digitos', () => {
    expect(descomponerCdc('123')).toBeNull()
  })
})

describe('revisarCdc', () => {
  const cdc = armarCdc({ ruc: '80137878', dvRuc: '8', est: '001', pun: '001', num: '0000124', fecha: '20260803' })

  it('no dice nada si no hay CDC (no todas las facturas son electronicas)', () => {
    expect(revisarCdc('')).toEqual([])
    expect(revisarCdc(null, { rucEmisor: '80137878-8' })).toEqual([])
  })

  it('no dice nada cuando todo cierra', () => {
    expect(
      revisarCdc(cdc, {
        rucEmisor: '80137878-8',
        numero: '001-001-0000124',
        fecha: '2026-08-03',
        esperado: 'factura',
      }),
    ).toEqual([])
  })

  it('avisa si el largo no es 44', () => {
    expect(revisarCdc('0180069563')[0]).toMatch(/10 dígitos/)
  })

  it('avisa si el digito verificador no cierra', () => {
    const mal = cdc.slice(0, 43) + String((Number(cdc[43]) + 1) % 10)
    expect(revisarCdc(mal)[0]).toMatch(/verificador/)
  })

  it('acepta el RUC con o sin DV', () => {
    expect(revisarCdc(cdc, { rucEmisor: '80137878' })).toEqual([])
    expect(revisarCdc(cdc, { rucEmisor: '80137878-8' })).toEqual([])
  })

  it('avisa si el RUC del emisor es otro', () => {
    const problemas = revisarCdc(cdc, { rucEmisor: '80119851-8' })
    expect(problemas).toHaveLength(1)
    expect(problemas[0]).toMatch(/RUC del emisor/)
  })

  it('avisa si el numero es otro', () => {
    const problemas = revisarCdc(cdc, { numero: '001-001-0000125' })
    expect(problemas[0]).toMatch(/número/)
    expect(problemas[0]).toContain('001-001-0000124')
  })

  it('compara solo el correlativo cuando no viene el numero completo', () => {
    expect(revisarCdc(cdc, { numero: '0000124' })).toEqual([])
    expect(revisarCdc(cdc, { numero: '124' })).toEqual([])
    expect(revisarCdc(cdc, { numero: '125' })).toHaveLength(1)
  })

  it('no opina si el numero tiene un largo que no se puede comparar', () => {
    expect(revisarCdc(cdc, { numero: '0010010000' })).toEqual([])
  })

  it('avisa si la fecha es otra', () => {
    const problemas = revisarCdc(cdc, { fecha: '2026-08-04' })
    expect(problemas[0]).toMatch(/fecha/)
    expect(problemas[0]).toContain('03/08/2026')
  })

  it('distingue una factura de una nota de credito', () => {
    const nota = armarCdc({ tipo: '05' })
    expect(revisarCdc(nota, { esperado: 'nota_credito' })).toEqual([])
    expect(revisarCdc(nota, { esperado: 'factura' })[0]).toMatch(/nota de crédito electrónica, no de una factura/)
    expect(revisarCdc(cdc, { esperado: 'nota_credito' })[0]).toMatch(/factura electrónica, no de una nota de crédito/)
  })

  it('acepta como factura las variantes 02, 03 y 04', () => {
    for (const tipo of ['02', '03', '04']) {
      expect(revisarCdc(armarCdc({ tipo }), { esperado: 'factura' })).toEqual([])
    }
  })

  it('junta todos los problemas a la vez', () => {
    const problemas = revisarCdc(cdc, {
      rucEmisor: '80119851-8',
      numero: '001-001-0000999',
      fecha: '2026-01-01',
    })
    expect(problemas).toHaveLength(3)
  })
})
