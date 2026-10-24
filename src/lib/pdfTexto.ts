/**
 * Texto de la primera pagina de un PDF, reconstruido en lineas.
 *
 * Una factura electronica (KuDE) descargada en PDF trae el texto como texto
 * digital, no solo como pixeles. Leerlo directo es exacto: no hay un cero de
 * menos en el CDC ni un 8 confundido con un 3. Pero pdf.js lo entrega en el
 * orden en que el generador lo escribio, que es cualquiera: las etiquetas
 * ("Nombre o Razon Social") llegan lejos de sus valores. Se reconstruyen las
 * lineas por posicion, como las ve un ojo humano, antes de usarlo.
 */

export interface ItemDeTexto {
  str: string
  /** Matriz de transformacion de pdf.js: [a, b, c, d, x, y]. */
  transform: number[]
}

/** pdf.js mezcla fragmentos de texto con marcas de contenido (sin texto): solo sirven los primeros. */
function esFragmentoDeTexto(i: object): i is ItemDeTexto {
  const c = i as Partial<ItemDeTexto>
  return typeof c.str === 'string' && c.str.trim() !== '' && Array.isArray(c.transform)
}

/** Dos fragmentos a menos de esta distancia vertical (en puntos) son de la misma linea. */
const TOLERANCIA_Y = 3

/**
 * Tope de caracteres que se le manda a la IA. Una factura larga de 50 lineas
 * ronda los 6.000; esto deja lugar de sobra sin permitir que un PDF enorme
 * dispare el costo de un solo llamado.
 */
export const LIMITE_TEXTO_PDF = 16_000

export function armarTextoDePagina(items: ReadonlyArray<object>): string {
  const fragmentos = items
    .filter(esFragmentoDeTexto)
    .map((i) => ({ texto: i.str.trim(), x: i.transform[4], y: i.transform[5] }))

  // De arriba hacia abajo (la y de PDF crece hacia arriba) y, dentro de la
  // misma altura, de izquierda a derecha
  fragmentos.sort((a, b) => b.y - a.y || a.x - b.x)

  const lineas: Array<{ y: number; partes: typeof fragmentos }> = []
  for (const f of fragmentos) {
    const ultima = lineas.at(-1)
    if (ultima && Math.abs(ultima.y - f.y) <= TOLERANCIA_Y) ultima.partes.push(f)
    else lineas.push({ y: f.y, partes: [f] })
  }

  const texto = lineas
    .map((l) =>
      l.partes
        .sort((a, b) => a.x - b.x)
        .map((p) => p.texto)
        .join(' ')
        // Algunos generadores rellenan con espacios para alinear columnas
        .replace(/\s+/g, ' '),
    )
    .join('\n')

  return texto.length > LIMITE_TEXTO_PDF ? `${texto.slice(0, LIMITE_TEXTO_PDF)}\n[texto recortado]` : texto
}
