import { calcularDV } from './format'

/**
 * CDC (Codigo de Control) de los documentos electronicos de SIFEN.
 *
 * Son 44 digitos con esta estructura fija:
 *
 *   tipo doc (2) · RUC emisor (8) · DV del RUC (1) · establecimiento (3) ·
 *   punto de expedicion (3) · numero (7) · tipo contribuyente (1) ·
 *   fecha de emision AAAAMMDD (8) · tipo de emision (1) ·
 *   codigo de seguridad (9) · DV del CDC (1)
 *
 * El ultimo digito se calcula con modulo 11 sobre los 43 anteriores. Eso
 * permite detectar una lectura equivocada de la IA, y como el CDC es unico
 * por documento, sirve tambien para no cargar dos veces la misma factura.
 */

export const LARGO_CDC = 44

export const TIPOS_DOCUMENTO_CDC: Record<string, string> = {
  '01': 'factura electrónica',
  '02': 'factura electrónica de exportación',
  '03': 'factura electrónica de importación',
  '04': 'autofactura electrónica',
  '05': 'nota de crédito electrónica',
  '06': 'nota de débito electrónica',
  '07': 'nota de remisión electrónica',
  '08': 'comprobante de retención electrónico',
}

export interface CdcDescompuesto {
  tipoDocumento: string
  /** RUC del emisor sin ceros a la izquierda ni DV. */
  rucEmisor: string
  dvEmisor: string
  establecimiento: string
  puntoExpedicion: string
  numeroDocumento: string
  tipoContribuyente: string
  /** yyyy-mm-dd */
  fechaEmision: string
  tipoEmision: string
  codigoSeguridad: string
  dv: string
}

/** Deja solo los digitos: en el papel el CDC se imprime en grupos de cuatro separados por espacios. */
export function normalizarCdc(entrada: string | null | undefined): string {
  return String(entrada ?? '').replace(/\D/g, '')
}

export function descomponerCdc(entrada: string | null | undefined): CdcDescompuesto | null {
  const c = normalizarCdc(entrada)
  if (c.length !== LARGO_CDC) return null
  return {
    tipoDocumento: c.slice(0, 2),
    rucEmisor: c.slice(2, 10).replace(/^0+/, ''),
    dvEmisor: c.slice(10, 11),
    establecimiento: c.slice(11, 14),
    puntoExpedicion: c.slice(14, 17),
    numeroDocumento: c.slice(17, 24),
    tipoContribuyente: c.slice(24, 25),
    fechaEmision: `${c.slice(25, 29)}-${c.slice(29, 31)}-${c.slice(31, 33)}`,
    tipoEmision: c.slice(33, 34),
    codigoSeguridad: c.slice(34, 43),
    dv: c.slice(43, 44),
  }
}

/** true si el ultimo digito corresponde al modulo 11 de los 43 anteriores. */
export function dvCdcCierra(entrada: string | null | undefined): boolean {
  const c = normalizarCdc(entrada)
  if (c.length !== LARGO_CDC) return false
  return calcularDV(c.slice(0, 43)) === Number(c[43])
}

export interface DatosParaCruzar {
  /** RUC del emisor del documento (el proveedor de la factura), con o sin guion. */
  rucEmisor?: string | null
  /** Numero completo (001-001-0000124) o solo el correlativo. */
  numero?: string | null
  /** yyyy-mm-dd */
  fecha?: string | null
  /** 'factura' acepta los tipos 01 a 04; 'nota_credito' solo el 05. */
  esperado?: 'factura' | 'nota_credito'
}

const digitos = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '')
const sinCeros = (v: string) => v.replace(/^0+/, '')

/** "05" -> "5", para comparar el correlativo sin importar los ceros de relleno. */
const numeroPlano = (v: string) => sinCeros(v) || '0'

function formatearNumero(c: CdcDescompuesto) {
  return `${c.establecimiento}-${c.puntoExpedicion}-${c.numeroDocumento}`
}

function formatearFecha(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/**
 * Devuelve los problemas que se le ven a un CDC, en castellano y listos para
 * mostrar al lado del campo. Lista vacia = nada que avisar (incluye el caso
 * de que no haya CDC: no todas las facturas son electronicas).
 *
 * Esto AVISA, nunca bloquea el guardado: igual que con el DV del RUC, si el
 * algoritmo tuviera un detalle mal, rechazar un documento valido seria peor
 * que no avisar.
 */
export function revisarCdc(entrada: string | null | undefined, contra: DatosParaCruzar = {}): string[] {
  const cdc = normalizarCdc(entrada)
  if (!cdc) return []

  if (cdc.length !== LARGO_CDC) {
    return [`El CDC tiene ${cdc.length} dígitos y tienen que ser ${LARGO_CDC}.`]
  }

  const partes = descomponerCdc(cdc)
  if (!partes) return []

  const problemas: string[] = []

  if (!dvCdcCierra(cdc)) {
    problemas.push('El dígito verificador no cierra: revisá que se haya leído bien.')
  }

  if (contra.esperado === 'factura' && !['01', '02', '03', '04'].includes(partes.tipoDocumento)) {
    const que = TIPOS_DOCUMENTO_CDC[partes.tipoDocumento] ?? `documento tipo ${partes.tipoDocumento}`
    problemas.push(`Este CDC es de una ${que}, no de una factura.`)
  }
  if (contra.esperado === 'nota_credito' && partes.tipoDocumento !== '05') {
    const que = TIPOS_DOCUMENTO_CDC[partes.tipoDocumento] ?? `documento tipo ${partes.tipoDocumento}`
    problemas.push(`Este CDC es de una ${que}, no de una nota de crédito.`)
  }

  const ruc = digitos(contra.rucEmisor)
  if (ruc) {
    const delCdc = `${partes.rucEmisor}${partes.dvEmisor}`
    // Con DV (80137878-8) o sin el (80137878): se acepta cualquiera de las dos
    const coincide = sinCeros(ruc) === delCdc || sinCeros(ruc) === partes.rucEmisor
    if (!coincide) {
      problemas.push(`El RUC del emisor en el CDC (${partes.rucEmisor}-${partes.dvEmisor}) no coincide con el cargado.`)
    }
  }

  const numero = digitos(contra.numero)
  if (numero) {
    const completo = `${partes.establecimiento}${partes.puntoExpedicion}${partes.numeroDocumento}`
    let coincide: boolean | null = null
    if (numero.length === 13) coincide = numero === completo
    else if (numero.length <= 7) coincide = numeroPlano(numero) === numeroPlano(partes.numeroDocumento)
    // Otro largo: no se puede comparar con seguridad, mejor no opinar
    if (coincide === false) {
      problemas.push(`El número no coincide con el del CDC (${formatearNumero(partes)}).`)
    }
  }

  if (contra.fecha && contra.fecha !== partes.fechaEmision) {
    problemas.push(`La fecha no coincide con la del CDC (${formatearFecha(partes.fechaEmision)}).`)
  }

  return problemas
}

/**
 * Busca en el texto de un PDF el CDC del documento, sin pasar por la IA.
 *
 * En el KuDE se imprime en once grupos de cuatro digitos separados por
 * espacios (y algunos generadores meten varios espacios o espacios no
 * cortables), pero tambien puede venir corrido. Un candidato solo se acepta
 * si el digito verificador cierra Y es del tipo de documento que se espera:
 * una nota de credito cita en su texto el CDC de la factura que modifica, y
 * esa es de otro tipo, asi que no se confunde con el propio.
 *
 * Devuelve null si no hay ninguno confiable; ahi se queda lo que leyo la IA.
 */
export function buscarCdcEnTexto(
  texto: string | null | undefined,
  esperado?: 'factura' | 'nota_credito',
): string | null {
  if (!texto) return null

  const candidatos: string[] = []
  for (const m of texto.matchAll(/\d{44}/g)) candidatos.push(m[0])
  for (const m of texto.matchAll(/\d{4}(?:\s+\d{4}){10}/g)) candidatos.push(m[0].replace(/\D/g, ''))

  for (const cdc of candidatos) {
    if (!dvCdcCierra(cdc)) continue
    const tipo = cdc.slice(0, 2)
    if (esperado === 'factura' && !['01', '02', '03', '04'].includes(tipo)) continue
    if (esperado === 'nota_credito' && tipo !== '05') continue
    return cdc
  }
  return null
}
