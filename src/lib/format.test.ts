import { describe, expect, it } from 'vitest'
import {
  calcularDV,
  formatFecha,
  formatRuc,
  formatearMontoEnVivo,
  mismoRuc,
  normalizar,
  parseFecha,
  parseMonto,
  rucSospechoso,
} from './format'

describe('parseMonto', () => {
  it('lee el formato paraguayo con puntos de miles', () => {
    expect(parseMonto('1.500.000')).toBe(1500000)
    expect(parseMonto('₲ 1.500')).toBe(1500)
    expect(parseMonto('136.363')).toBe(136363)
  })

  it('lee el formato con coma decimal', () => {
    expect(parseMonto('1.500,50')).toBe(1500.5)
    expect(parseMonto('1,50')).toBe(1.5)
  })

  it('lee el formato anglosajon', () => {
    expect(parseMonto('1,500,000.50')).toBe(1500000.5)
  })

  it('trata la coma como separador de miles cuando deja tres digitos', () => {
    // '1,500' es mil quinientos, no uno coma cinco
    expect(parseMonto('1,500')).toBe(1500)
  })

  it('devuelve 0 para vacio o basura', () => {
    expect(parseMonto('')).toBe(0)
    expect(parseMonto(null)).toBe(0)
    expect(parseMonto(undefined)).toBe(0)
    expect(parseMonto('abc')).toBe(0)
  })

  it('deja pasar los numeros tal cual', () => {
    expect(parseMonto(1500)).toBe(1500)
    expect(parseMonto(Number.NaN)).toBe(0)
  })
})

describe('formatearMontoEnVivo', () => {
  it('pone los puntos de miles mientras se tipea', () => {
    expect(formatearMontoEnVivo('1500000')).toBe('1.500.000')
  })

  it('ignora la coma en guaranies, que no tienen decimales', () => {
    // La coma se descarta y los digitos siguen de largo. Se ve raro escrito
    // asi, pero tecleando de a un caracter el numero crece a la vista y el
    // guarani no admite centavos, con lo cual la coma es un error de tipeo.
    expect(formatearMontoEnVivo('1500,50', 'PYG')).toBe('150.050')
  })

  it('acepta decimales en las demas monedas', () => {
    expect(formatearMontoEnVivo('1500,50', 'USD')).toBe('1.500,50')
  })

  it('no confunde con una coma decimal los puntos que puso el mismo', () => {
    // Se re-formatea lo que ya salio formateado, que es lo que pasa tecla a tecla
    expect(formatearMontoEnVivo(formatearMontoEnVivo('1500000'))).toBe('1.500.000')
  })

  it('recorta los decimales de sobra', () => {
    expect(formatearMontoEnVivo('10,999', 'USD')).toBe('10,99')
  })
})

describe('parseFecha', () => {
  it('interpreta dia/mes/anio, como se escribe en Paraguay', () => {
    expect(parseFecha('03/08/2026')).toBe('2026-08-03')
    expect(parseFecha('3/8/2026')).toBe('2026-08-03')
  })

  it('deja pasar lo que ya viene en ISO', () => {
    expect(parseFecha('2026-08-03')).toBe('2026-08-03')
  })

  it('acepta guion y punto como separadores', () => {
    expect(parseFecha('03-08-2026')).toBe('2026-08-03')
    expect(parseFecha('03.08.2026')).toBe('2026-08-03')
  })

  it('completa el siglo de los anios de dos digitos', () => {
    expect(parseFecha('03/08/26')).toBe('2026-08-03')
    expect(parseFecha('03/08/85')).toBe('1985-08-03')
  })

  it('rechaza dias y meses imposibles', () => {
    expect(parseFecha('32/08/2026')).toBeNull()
    expect(parseFecha('03/13/2026')).toBeNull()
  })

  it('devuelve null para vacio', () => {
    expect(parseFecha('')).toBeNull()
    expect(parseFecha(null)).toBeNull()
  })
})

describe('formatFecha', () => {
  it('pasa de ISO a dd/mm/aaaa', () => {
    expect(formatFecha('2026-08-03')).toBe('03/08/2026')
  })

  it('recorta la hora de un timestamp', () => {
    expect(formatFecha('2026-08-03T15:30:00Z')).toBe('03/08/2026')
  })

  it('muestra un guion cuando no hay fecha', () => {
    expect(formatFecha(null)).toBe('—')
  })
})

describe('RUC', () => {
  it('valida el DV de RUCs reales', () => {
    // Los dos que se usan en el sistema
    expect(rucSospechoso('80137878-8')).toBe(false)
    expect(rucSospechoso('80119851-8')).toBe(false)
  })

  it('marca como sospechoso un DV que no cierra', () => {
    expect(rucSospechoso('80137878-1')).toBe(true)
  })

  it('no opina sobre un RUC sin guion', () => {
    // No se puede evaluar, asi que no se avisa nada
    expect(rucSospechoso('801378788')).toBe(false)
    expect(rucSospechoso('')).toBe(false)
  })

  it('calcula el DV', () => {
    expect(calcularDV('80137878')).toBe(8)
    expect(calcularDV('')).toBeNull()
  })

  it('formatea con guion', () => {
    expect(formatRuc('801378788')).toBe('80137878-8')
    expect(formatRuc('80137878-8')).toBe('80137878-8')
    expect(formatRuc(null)).toBe('—')
  })

  it('compara ignorando guiones', () => {
    expect(mismoRuc('80137878-8', '801378788')).toBe(true)
    expect(mismoRuc('80137878-8', '80119851-8')).toBe(false)
    expect(mismoRuc('', '')).toBe(false)
  })
})

describe('normalizar', () => {
  it('saca tildes y mayusculas para poder buscar', () => {
    expect(normalizar('Categoría')).toBe('categoria')
  })

  it('tambien convierte la ñ en n', () => {
    // Efecto de descomponer en NFD y sacar todos los diacriticos. Es lo que
    // se busca: escribiendo "nandu" se encuentra "ñandú".
    expect(normalizar('  ÑANDÚ ')).toBe('nandu')
  })
})
