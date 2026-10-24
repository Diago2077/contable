import { describe, expect, it } from 'vitest'
import { buscarCdcEnTexto, descomponerCdc, dvCdcCierra, revisarCdc } from './cdc'
import { calcularDV } from './format'

/**
 * CDC de una factura electronica REAL emitida por FASTRO SA (RUC 80119851-8):
 * sale de un documento que genero SIFEN, no de este codigo. Es el segundo
 * vector independiente del algoritmo, ademas del ejemplo del manual.
 */
const CDC_REAL = '01801198518001001000040422026102410000004335'

describe('CDC de una factura real', () => {
  it('el digito verificador cierra', () => {
    expect(dvCdcCierra(CDC_REAL)).toBe(true)
  })

  it('se descompone en el emisor, el numero y la fecha que figuran en el documento', () => {
    const c = descomponerCdc(CDC_REAL)!
    expect(c.tipoDocumento).toBe('01')
    expect(`${c.rucEmisor}-${c.dvEmisor}`).toBe('80119851-8')
    expect(`${c.establecimiento}-${c.puntoExpedicion}-${c.numeroDocumento}`).toBe('001-001-0000404')
    expect(c.fechaEmision).toBe('2026-10-24')
    expect(calcularDV(c.rucEmisor)).toBe(Number(c.dvEmisor))
  })

  it('cruza sin avisos con los datos que trae el propio documento', () => {
    expect(
      revisarCdc(CDC_REAL, { rucEmisor: '80119851-8', numero: '001-001-0000404', fecha: '2026-10-24', esperado: 'factura' }),
    ).toEqual([])
  })
})

/** Un CDC de nota de credito (tipo 05) con el verificador bien calculado. */
function cdcDeNota() {
  const base = '05' + '80119851' + '8' + '001' + '001' + '0000007' + '2' + '20261025' + '1' + '000000123'
  return base + calcularDV(base)
}

describe('buscarCdcEnTexto', () => {
  // Asi sale del PDF real, con espacios de mas entre algunos grupos
  const IMPRESO = '0180   1198   5180   0100   1000 0404 2202 6102 4100 0000 4335'

  it('encuentra el CDC impreso en grupos de cuatro, aunque haya espacios de mas', () => {
    const texto = `Consulte la validez...\n${IMPRESO}\nESTE DOCUMENTO ES UNA REPRESENTACION`
    expect(buscarCdcEnTexto(texto)).toBe(CDC_REAL)
  })

  it('encuentra el CDC corrido, sin espacios', () => {
    expect(buscarCdcEnTexto(`CDC: ${CDC_REAL}`)).toBe(CDC_REAL)
  })

  it('acepta espacios no cortables entre los grupos', () => {
    expect(buscarCdcEnTexto(IMPRESO.replace(/ /g, ' '))).toBe(CDC_REAL)
  })

  it('descarta un candidato cuyo digito verificador no cierra', () => {
    expect(buscarCdcEnTexto(IMPRESO.slice(0, -1) + '9')).toBeNull()
  })

  it('no inventa un CDC con numeros sueltos del documento', () => {
    expect(buscarCdcEnTexto('SUBTOTAL: 0 0 5.015.070\nTOTAL: 5.015.070\nTimbrado Nro 18408797')).toBeNull()
  })

  it('devuelve null si no hay texto', () => {
    expect(buscarCdcEnTexto('')).toBeNull()
    expect(buscarCdcEnTexto(null)).toBeNull()
  })

  it('en una nota de credito elige el CDC propio y no el de la factura que cita', () => {
    // La nota imprime su CDC (tipo 05) y, en "Documento asociado", el de la factura (tipo 01)
    const propio = cdcDeNota()
    expect(dvCdcCierra(propio)).toBe(true)
    const texto = `Documento asociado CDC: ${CDC_REAL}\nCDC: ${propio}`
    expect(buscarCdcEnTexto(texto, 'nota_credito')).toBe(propio)
    expect(buscarCdcEnTexto(texto, 'factura')).toBe(CDC_REAL)
  })

  it('si el unico CDC del texto no es del tipo esperado, no devuelve nada', () => {
    expect(buscarCdcEnTexto(IMPRESO, 'nota_credito')).toBeNull()
  })
})
