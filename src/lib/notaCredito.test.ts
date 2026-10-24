import { describe, expect, it } from 'vitest'
import {
  NOTA_VACIA,
  advertenciasCdcNota,
  coincideFacturaReferida,
  extraccionANotaForm,
  notaAFormState,
  notaFormAInsert,
  notaFormAUpdate,
  type NotaCreditoExtraccion,
} from './notaCredito'
import type { NotaCredito } from './database.types'

function extraccion(parcial: Partial<NotaCreditoExtraccion> = {}): NotaCreditoExtraccion {
  return {
    numero_nota: null,
    fecha_nota: null,
    timbrado: null,
    timbrado_vencimiento: null,
    cdc: null,
    factura_numero: null,
    motivo: null,
    exentas: 0,
    gravado_5: 0,
    iva_5: 0,
    gravado_10: 0,
    iva_10: 0,
    total: 0,
    observaciones: null,
    ...parcial,
  }
}

describe('extraccionANotaForm', () => {
  it('pasa la fecha al formato del input date y los null a texto vacio', () => {
    const f = extraccionANotaForm(extraccion({ fecha_nota: '03/08/2026', numero_nota: '001-001-0000007' }))
    expect(f.fecha_nota).toBe('2026-08-03')
    expect(f.numero_nota).toBe('001-001-0000007')
    expect(f.motivo).toBe('')
    expect(f.cdc).toBe('')
  })

  it('deja el CDC solo con digitos', () => {
    expect(extraccionANotaForm(extraccion({ cdc: '0144 4444 0170' })).cdc).toBe('014444440170')
  })

  it('convierte los montos a texto para el formulario', () => {
    const f = extraccionANotaForm(extraccion({ gravado_10: 200000, iva_10: 18182, total: 200000 }))
    expect(f.gravado_10).toBe('200000')
    expect(f.total).toBe('200000')
  })
})

describe('notaFormAUpdate', () => {
  it('parsea los montos con puntos de miles', () => {
    const u = notaFormAUpdate({ ...NOTA_VACIA, total: '1.500.000', gravado_10: '1.500.000' })
    expect(u.total).toBe(1500000)
    expect(u.gravado_10).toBe(1500000)
  })

  it('guarda siempre en positivo aunque se tipee con signo', () => {
    // El CHECK de la base rechaza negativos: mejor corregirlo aca que fallar al guardar
    expect(notaFormAUpdate({ ...NOTA_VACIA, total: '-200.000' }).total).toBe(200000)
  })

  it('manda null en vez de texto vacio', () => {
    const u = notaFormAUpdate({ ...NOTA_VACIA, numero_nota: '   ', motivo: '' })
    expect(u.numero_nota).toBeNull()
    expect(u.motivo).toBeNull()
    expect(u.cdc).toBeNull()
    expect(u.fecha_nota).toBeNull()
  })
})

describe('notaFormAInsert', () => {
  it('ata la nota a su factura, empresa y contribuyente', () => {
    const insert = notaFormAInsert({
      empresaId: 'e1',
      contribuyenteId: 'c1',
      facturaId: 'f1',
      createdBy: 'u1',
      archivoPath: 'e1/c1/nota-1.jpg',
      archivoNombre: 'nota.jpg',
      archivoMime: 'image/jpeg',
      extraccionRaw: { total: 5 },
      form: { ...NOTA_VACIA, total: '5' },
    })
    expect(insert).toMatchObject({
      empresa_id: 'e1',
      contribuyente_id: 'c1',
      factura_id: 'f1',
      created_by: 'u1',
      archivo_path: 'e1/c1/nota-1.jpg',
      total: 5,
    })
  })

  it('sin archivo ni extraccion (carga a mano) deja esos campos en null', () => {
    const insert = notaFormAInsert({
      empresaId: 'e1',
      contribuyenteId: 'c1',
      facturaId: 'f1',
      createdBy: 'u1',
      archivoPath: null,
      archivoNombre: null,
      archivoMime: null,
      extraccionRaw: undefined,
      form: NOTA_VACIA,
    })
    expect(insert.archivo_path).toBeNull()
    expect(insert.extraccion_raw).toBeNull()
  })
})

describe('notaAFormState', () => {
  it('deja lista para editar una nota ya guardada', () => {
    const nota = { numero_nota: '001-001-0000007', fecha_nota: '2026-08-03', total: 200000, cdc: null } as NotaCredito
    const f = notaAFormState(nota)
    expect(f.numero_nota).toBe('001-001-0000007')
    expect(f.fecha_nota).toBe('2026-08-03')
    expect(f.total).toBe('200000')
    expect(f.cdc).toBe('')
  })
})

describe('advertenciasCdcNota', () => {
  // Ejemplo del manual de SIFEN, tipo 01: una factura, no una nota
  const CDC_FACTURA = '01444444017001001001452822017012515873260988'

  it('no dice nada si no hay CDC', () => {
    expect(advertenciasCdcNota(NOTA_VACIA, { proveedor_ruc: '44444401-7' })).toEqual([])
  })

  it('avisa si el CDC es de una factura y no de una nota de credito', () => {
    const problemas = advertenciasCdcNota({ ...NOTA_VACIA, cdc: CDC_FACTURA }, { proveedor_ruc: '44444401-7' })
    expect(problemas.some((p) => /no de una nota de crédito/.test(p))).toBe(true)
  })
})

describe('coincideFacturaReferida', () => {
  it('compara el numero completo', () => {
    expect(coincideFacturaReferida('001-001-0000124', '001-001-0000124')).toBe(true)
    expect(coincideFacturaReferida('001-001-0000125', '001-001-0000124')).toBe(false)
  })

  it('acepta que la nota cite solo el correlativo', () => {
    expect(coincideFacturaReferida('124', '001-001-0000124')).toBe(true)
    expect(coincideFacturaReferida('0000124', '001-001-0000124')).toBe(true)
    expect(coincideFacturaReferida('125', '001-001-0000124')).toBe(false)
  })

  it('distingue otro establecimiento aunque el correlativo sea igual', () => {
    expect(coincideFacturaReferida('002-001-0000124', '001-001-0000124')).toBe(false)
  })

  it('devuelve null cuando no hay con que comparar', () => {
    expect(coincideFacturaReferida(null, '001-001-0000124')).toBeNull()
    expect(coincideFacturaReferida('001-001-0000124', '')).toBeNull()
  })
})
