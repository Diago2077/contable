import { describe, expect, it } from 'vitest'
import { esquemaFactura, esquemaNotaCredito } from '../extraer.js'

/**
 * OpenAI con `strict: true` rechaza el esquema entero (error 400, y con eso
 * TODA extraccion) si alguna propiedad no figura en `required` o si falta
 * `additionalProperties: false` en cualquier nivel. Es facil romperlo al
 * agregar un campo, y recien se ve en produccion.
 */
type Esquema = {
  type?: unknown
  properties?: Record<string, Esquema>
  required?: string[]
  additionalProperties?: unknown
  items?: Esquema
}

function problemasDe(esquema: Esquema, ruta = 'raiz'): string[] {
  const problemas: string[] = []

  if (esquema.type === 'object') {
    const propiedades = Object.keys(esquema.properties ?? {})
    const requeridas = esquema.required ?? []
    const sinRequerir = propiedades.filter((p) => !requeridas.includes(p))
    const sinDefinir = requeridas.filter((r) => !propiedades.includes(r))
    if (sinRequerir.length) problemas.push(`${ruta}: propiedades que no estan en required: ${sinRequerir.join(', ')}`)
    if (sinDefinir.length) problemas.push(`${ruta}: required sin propiedad: ${sinDefinir.join(', ')}`)
    if (esquema.additionalProperties !== false) problemas.push(`${ruta}: falta additionalProperties: false`)
    for (const [nombre, hijo] of Object.entries(esquema.properties ?? {})) {
      problemas.push(...problemasDe(hijo, `${ruta}.${nombre}`))
    }
  }
  if (esquema.type === 'array' && esquema.items) problemas.push(...problemasDe(esquema.items, `${ruta}[]`))

  return problemas
}

describe('esquema de factura', () => {
  const cuentas = [{ id: 'a', cuenta: '41112', denominacion: 'Ventas' }]

  it('es valido para el modo estricto, con y sin plan de cuentas', () => {
    expect(problemasDe(esquemaFactura(cuentas) as unknown as Esquema)).toEqual([])
    expect(problemasDe(esquemaFactura([]) as unknown as Esquema)).toEqual([])
  })

  it('pide el CDC', () => {
    const e = esquemaFactura(cuentas) as unknown as Esquema
    expect(e.properties).toHaveProperty('cdc')
    expect(e.required).toContain('cdc')
  })
})

describe('esquema de nota de credito', () => {
  it('es valido para el modo estricto', () => {
    expect(problemasDe(esquemaNotaCredito() as unknown as Esquema)).toEqual([])
  })

  it('pide el CDC, el numero de la factura que modifica y el motivo', () => {
    const e = esquemaNotaCredito() as unknown as Esquema
    for (const campo of ['cdc', 'factura_numero', 'motivo', 'numero_nota', 'total']) {
      expect(e.required, campo).toContain(campo)
    }
  })

  it('no repite proveedor, cliente ni plan de cuentas: son los de la factura', () => {
    const e = esquemaNotaCredito() as unknown as Esquema
    for (const campo of ['proveedor_nombre', 'cliente_nombre', 'plan_cuenta_id', 'tipo_operacion']) {
      expect(e.properties, campo).not.toHaveProperty(campo)
    }
  })
})

describe('el detector de problemas', () => {
  it('detecta una propiedad que falta en required', () => {
    const roto: Esquema = {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' } },
      required: ['a'],
      additionalProperties: false,
    }
    expect(problemasDe(roto)[0]).toMatch(/no estan en required: b/)
  })

  it('detecta un objeto anidado sin additionalProperties', () => {
    const roto: Esquema = {
      type: 'object',
      properties: { x: { type: 'object', properties: {}, required: [] } },
      required: ['x'],
      additionalProperties: false,
    }
    expect(problemasDe(roto)[0]).toMatch(/raiz\.x: falta additionalProperties/)
  })
})
