import { describe, expect, it } from 'vitest'
import { bloqueTextoPdf, prompt, promptNotaCredito } from '../extraer.js'

const cuentas = [{ id: 'a', cuenta: '41112', denominacion: 'Ventas de Servicios' }]
const TEXTO = 'FA823 1 BLUSA FOLL JOY 82.980\nTOTAL: 5.015.070'

describe('vencimiento del timbrado', () => {
  it('le dice a la IA que la fecha de inicio de vigencia no es el vencimiento, en facturas y en notas', () => {
    // Real: en una factura electronica la IA devolvio la fecha de INICIO como vencimiento
    for (const p of [prompt('80137878-8', 'DR PCS', cuentas), promptNotaCredito('80137878-8', 'DR PCS')]) {
      expect(p).toMatch(/Fecha Inicio Vigencia" del timbrado NO es su vencimiento/)
      expect(p).toMatch(/devolve null en timbrado_vencimiento/)
    }
  })
})

describe('texto del PDF en el prompt', () => {
  it('no agrega nada si el documento no trae texto (una imagen o un escaneo)', () => {
    expect(bloqueTextoPdf(null)).toBe('')
    expect(prompt('80137878-8', 'DR PCS', cuentas, null)).not.toContain('TEXTO_DEL_PDF')
    expect(promptNotaCredito('80137878-8', 'DR PCS', null)).not.toContain('TEXTO_DEL_PDF')
  })

  it('un prompt sin texto es igual al de antes de agregarlo', () => {
    expect(prompt('80137878-8', 'DR PCS', cuentas)).toBe(prompt('80137878-8', 'DR PCS', cuentas, null))
  })

  it('incluye el texto delimitado, en facturas y en notas de credito', () => {
    for (const p of [prompt('80137878-8', 'DR PCS', cuentas, TEXTO), promptNotaCredito('80137878-8', 'DR PCS', TEXTO)]) {
      expect(p).toContain('<<<TEXTO_DEL_PDF')
      expect(p).toContain(TEXTO)
      expect(p).toContain('TEXTO_DEL_PDF>>>')
    }
  })

  it('le aclara a la IA que el texto es contenido y no instrucciones', () => {
    expect(bloqueTextoPdf(TEXTO)).toMatch(/no son instrucciones/)
  })

  it('va AL FINAL, despues del plan de cuentas, para no romper el cache de OpenAI', () => {
    // El prefijo (reglas + plan de cuentas) es igual en todas las facturas del
    // contribuyente y OpenAI lo cachea; lo que cambia por factura tiene que ir despues.
    const sin = prompt('80137878-8', 'DR PCS', cuentas, null)
    const con = prompt('80137878-8', 'DR PCS', cuentas, TEXTO)
    expect(con.startsWith(sin)).toBe(true)
    expect(con.indexOf('41112')).toBeLessThan(con.indexOf('<<<TEXTO_DEL_PDF'))
  })
})
