import { describe, expect, it } from 'vitest'
import { LIMITE_TEXTO_PDF, armarTextoDePagina } from './pdfTexto'

/** Fragmento como lo entrega pdf.js: el texto y su posicion en la matriz de transformacion. */
const frag = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] })

describe('armarTextoDePagina', () => {
  it('une en una linea lo que esta a la misma altura, de izquierda a derecha', () => {
    // pdf.js los puede entregar en cualquier orden: la etiqueta lejos de su valor
    const texto = armarTextoDePagina([frag('MARIJO BOUTIQUE', 120, 700), frag('Nombre Fantasia :', 30, 700)])
    expect(texto).toBe('Nombre Fantasia : MARIJO BOUTIQUE')
  })

  it('ordena las lineas de arriba hacia abajo (la y de PDF crece hacia arriba)', () => {
    const texto = armarTextoDePagina([frag('abajo', 30, 100), frag('arriba', 30, 700), frag('medio', 30, 400)])
    expect(texto).toBe('arriba\nmedio\nabajo')
  })

  it('tolera una pequena diferencia de altura dentro de la misma linea', () => {
    // Una etiqueta y su valor pueden estar a 1 o 2 puntos de distancia por la tipografia
    const texto = armarTextoDePagina([frag('Total:', 30, 500), frag('5.015.070', 200, 498.5)])
    expect(texto).toBe('Total: 5.015.070')
  })

  it('separa lineas que estan mas alejadas que la tolerancia', () => {
    const texto = armarTextoDePagina([frag('uno', 30, 500), frag('dos', 30, 490)])
    expect(texto).toBe('uno\ndos')
  })

  it('colapsa los espacios con que algunos generadores alinean columnas', () => {
    expect(armarTextoDePagina([frag('Nombre   o   Razón   Social', 30, 500)])).toBe('Nombre o Razón Social')
  })

  it('ignora los fragmentos vacios y las marcas de contenido sin texto', () => {
    const texto = armarTextoDePagina([
      frag('   ', 30, 500),
      { type: 'beginMarkedContent', id: 'x' },
      { str: 'sin matriz' },
      frag('real', 30, 400),
    ])
    expect(texto).toBe('real')
  })

  it('devuelve vacio para un PDF sin capa de texto (un escaneo)', () => {
    expect(armarTextoDePagina([])).toBe('')
  })

  it('arma una fila de tabla entera, que es lo que hace util al texto', () => {
    const texto = armarTextoDePagina([
      frag('82.980', 520, 300),
      frag('FA823', 30, 300),
      frag('BLUSA FOLL JOY', 80, 300),
      frag('10,00', 440, 300),
      frag('1', 62, 300),
    ])
    expect(texto).toBe('FA823 1 BLUSA FOLL JOY 10,00 82.980')
  })

  it('recorta un texto desmedido y lo avisa', () => {
    const largo = armarTextoDePagina([frag('x'.repeat(LIMITE_TEXTO_PDF + 500), 30, 500)])
    expect(largo.length).toBeLessThan(LIMITE_TEXTO_PDF + 40)
    expect(largo.endsWith('[texto recortado]')).toBe(true)
  })
})
