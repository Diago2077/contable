/**
 * Lee un archivo de texto detectando el encoding: si no es UTF-8 valido
 * (tipico de un CSV exportado desde Excel en Windows, que usa windows-1252),
 * cae a esa codificacion. Sin esto cualquier tilde se rompe -- "Créditos"
 * queda "Cr�ditos" -- porque File.text() siempre asume UTF-8.
 */
export async function leerTextoArchivo(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer()
  let texto: string
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    texto = new TextDecoder('windows-1252').decode(buffer)
  }
  // Excel a veces antepone un BOM a los CSV UTF-8; si no se saca, queda
  // pegado al primer campo del encabezado y rompe la deteccion de columnas.
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
}

/** Parser de CSV chico: alcanza para "codigo,descripcion" con comillas y comas escapadas. */
export function parseCsv(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let entreComillas = false

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]

    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          entreComillas = false
        }
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') {
      entreComillas = true
    } else if (c === ',' || c === ';') {
      fila.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo)
      filas.push(fila)
      fila = []
      campo = ''
    } else {
      campo += c
    }
  }

  if (campo || fila.length > 0) {
    fila.push(campo)
    filas.push(fila)
  }

  return filas.filter((f) => f.some((v) => v.trim() !== ''))
}
