/** Formateo y parseo con las convenciones paraguayas. */

/** El guarani no usa decimales; las demas monedas si. */
export function decimalesDe(moneda: string): number {
  return moneda === 'PYG' ? 0 : 2
}

export function formatMonto(valor: number | string | null | undefined, moneda = 'PYG'): string {
  const n = typeof valor === 'number' ? valor : Number(valor ?? 0)
  if (!Number.isFinite(n)) return '—'
  const d = decimalesDe(moneda)
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n)
}

export function formatMontoConMoneda(valor: number | null | undefined, moneda = 'PYG'): string {
  return `${moneda === 'PYG' ? '₲' : moneda} ${formatMonto(valor, moneda)}`
}

/**
 * Formatea un monto MIENTRAS se edita: separa en digitos + como mucho una
 * marca decimal, descarta el resto de caracteres, y devuelve el texto ya
 * con puntos de miles. Pensado para usarse en cada tecla, no solo al perder
 * el foco.
 *
 * Solo la coma cuenta como marca decimal (es-PY: coma decimal, punto de
 * miles). El punto NUNCA se toma como decimal aca a proposito: como el
 * propio formateo ya inserta puntos de miles en cada tecla, si tambien se
 * aceptara '.' como marca decimal, el separador que la funcion puso en la
 * vuelta anterior se confundiria con una coma decimal tecleada por el
 * usuario y se perderia un digito.
 */
export function formatearMontoEnVivo(crudo: string, moneda = 'PYG'): string {
  const decimales = decimalesDe(moneda)
  let vistoMarcaDecimal = false
  let parteEntera = ''
  let parteDecimal = ''

  for (const ch of crudo) {
    if (ch >= '0' && ch <= '9') {
      if (vistoMarcaDecimal) parteDecimal += ch
      else parteEntera += ch
    } else if (ch === ',' && decimales > 0 && !vistoMarcaDecimal) {
      vistoMarcaDecimal = true
    }
  }
  parteDecimal = parteDecimal.slice(0, decimales)

  const enteroFormateado = parteEntera ? new Intl.NumberFormat('es-PY').format(BigInt(parteEntera)) : ''
  if (!vistoMarcaDecimal) return enteroFormateado
  return `${enteroFormateado || '0'},${parteDecimal}`
}

/** '2026-03-14' → '14/03/2026'. Recorta la hora si viene un timestamp. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [fecha] = iso.split('T')
  const [a, m, d] = fecha.split('-')
  if (!a || !m || !d) return iso
  return `${d}/${m}/${a}`
}

export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return '—'
  return `${formatFecha(iso)} ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`
}

/**
 * Convierte a numero un monto escrito por la IA o tipeado a mano.
 * Tiene que sobrevivir a '1.500.000', '1,500,000.50', '1.500,50' y '₲ 1.500'.
 */
export function parseMonto(entrada: string | number | null | undefined): number {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : 0
  if (!entrada) return 0

  let s = String(entrada).replace(/[^\d.,-]/g, '').trim()
  if (!s) return 0

  // El signo se separa antes de interpretar los puntos y comas: con el menos
  // adelante, '-200.000' no pasaba por la regla de los puntos de miles y se
  // leia como -200 en vez de -200000.
  const negativo = s.startsWith('-')
  if (negativo) s = s.slice(1)

  const ultimaComa = s.lastIndexOf(',')
  const ultimoPunto = s.lastIndexOf('.')

  if (ultimaComa > -1 && ultimoPunto > -1) {
    // El separador decimal es el que aparece mas a la derecha
    if (ultimaComa > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (ultimaComa > -1) {
    // Una sola coma: es decimal solo si deja 1 o 2 digitos atras ('1,50').
    // Si deja 3 ('1,500') es separador de miles.
    const decimales = s.length - ultimaComa - 1
    s = decimales > 0 && decimales <= 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (ultimoPunto > -1) {
    const decimales = s.length - ultimoPunto - 1
    if (decimales === 3 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return 0
  return negativo ? -n : n
}

/**
 * Normaliza a 'YYYY-MM-DD' lo que sea que devuelva la IA.
 * Ante '03/04/2026' asume dia/mes, que es como se escribe en Paraguay.
 */
export function parseFecha(entrada: string | null | undefined): string | null {
  if (!entrada) return null
  const s = String(entrada).trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const dia = Number(m[1])
    const mes = Number(m[2])
    let anio = Number(m[3])
    if (anio < 100) anio += anio < 70 ? 2000 : 1900
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  const f = new Date(s)
  if (!Number.isNaN(f.getTime())) return f.toISOString().slice(0, 10)
  return null
}

/**
 * Digito verificador del RUC, algoritmo modulo 11 de la SET.
 * Los RUC viejos podian traer letras: se convierten a su codigo ASCII.
 *
 * ADVERTENCIA: esto sirve para AVISAR, nunca para bloquear. Si el algoritmo
 * tuviera un detalle mal, rechazar un RUC valido seria peor que no avisar.
 * Ver `rucSospechoso`.
 */
export function calcularDV(rucSinDV: string, baseMax = 11): number | null {
  const limpio = String(rucSinDV).trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!limpio) return null

  let digitos = ''
  for (const c of limpio) {
    digitos += c >= '0' && c <= '9' ? c : String(c.charCodeAt(0))
  }

  let total = 0
  let k = 2
  for (let i = digitos.length - 1; i >= 0; i--) {
    if (k > baseMax) k = 2
    total += Number(digitos[i]) * k
    k++
  }
  const resto = total % 11
  return resto > 1 ? 11 - resto : 0
}

/**
 * true si el RUC tiene forma '80012345-6' y el DV NO cierra.
 * Se usa solo para pintar una advertencia al lado del campo; el guardado
 * nunca se frena por esto. Un RUC sin guion no se considera sospechoso
 * porque simplemente no se puede evaluar.
 */
export function rucSospechoso(ruc: string | null | undefined): boolean {
  if (!ruc) return false
  const m = String(ruc).trim().match(/^([0-9A-Za-z]+)-(\d)$/)
  if (!m) return false
  return calcularDV(m[1]) !== Number(m[2])
}

/** '800123456' → '80012345-6'. Deja intacto lo que ya trae guion. */
export function formatRuc(ruc: string | null | undefined): string {
  if (!ruc) return '—'
  const s = String(ruc).trim()
  if (s.includes('-')) return s
  const d = s.replace(/\D/g, '')
  if (d.length < 2) return s
  return `${d.slice(0, -1)}-${d.slice(-1)}`
}

/** Compara RUCs ignorando guiones y espacios. */
export function mismoRuc(a: string | null | undefined, b: string | null | undefined): boolean {
  const limpiar = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '')
  const x = limpiar(a)
  return x.length > 0 && x === limpiar(b)
}

/** Normaliza texto para buscar sin tildes ni mayusculas. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}
