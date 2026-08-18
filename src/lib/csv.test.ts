import { describe, expect, it } from 'vitest'
import { leerTextoArchivo, parseCsv } from './csv'

/** File de mentira con bytes controlados, para probar la deteccion de encoding. */
function archivoCon(bytes: Uint8Array): File {
  return new File([bytes as BlobPart], 'plan.csv', { type: 'text/csv' })
}

describe('parseCsv', () => {
  it('separa por coma y por punto y coma', () => {
    expect(parseCsv('1,Caja\n2,Banco')).toEqual([
      ['1', 'Caja'],
      ['2', 'Banco'],
    ])
    expect(parseCsv('1;Caja')).toEqual([['1', 'Caja']])
  })

  it('respeta las comas dentro de comillas', () => {
    expect(parseCsv('1,"Caja, chica"')).toEqual([['1', 'Caja, chica']])
  })

  it('desescapa las comillas dobles', () => {
    expect(parseCsv('1,"Cuenta ""A"""')).toEqual([['1', 'Cuenta "A"']])
  })

  it('acepta saltos de linea de Windows y de Unix', () => {
    expect(parseCsv('1,Caja\r\n2,Banco')).toEqual([
      ['1', 'Caja'],
      ['2', 'Banco'],
    ])
  })

  it('descarta las filas vacias', () => {
    expect(parseCsv('1,Caja\n\n\n2,Banco')).toEqual([
      ['1', 'Caja'],
      ['2', 'Banco'],
    ])
  })

  it('no pierde la ultima fila si el archivo no termina en salto', () => {
    expect(parseCsv('1,Caja')).toEqual([['1', 'Caja']])
  })
})

describe('leerTextoArchivo', () => {
  it('lee UTF-8', async () => {
    const bytes = new TextEncoder().encode('1,Créditos')
    expect(await leerTextoArchivo(archivoCon(bytes))).toBe('1,Créditos')
  })

  it('cae a windows-1252 cuando el archivo no es UTF-8 valido', async () => {
    // Asi exporta Excel en Windows: la é es un solo byte 0xE9, que en UTF-8
    // es una secuencia invalida. Sin el fallback quedaba "Cr�ditos".
    const bytes = new Uint8Array([0x31, 0x2c, 0x43, 0x72, 0xe9, 0x64, 0x69, 0x74, 0x6f, 0x73])
    expect(await leerTextoArchivo(archivoCon(bytes))).toBe('1,Créditos')
  })

  it('saca el BOM que Excel antepone', async () => {
    const bytes = new TextEncoder().encode('﻿cuenta,denominacion')
    const texto = await leerTextoArchivo(archivoCon(bytes))
    expect(texto).toBe('cuenta,denominacion')
    // Sin sacarlo, el BOM queda pegado al primer campo y rompe la deteccion
    // del encabezado en la importacion del plan de cuentas.
    expect(parseCsv(texto)[0][0]).toBe('cuenta')
  })
})
