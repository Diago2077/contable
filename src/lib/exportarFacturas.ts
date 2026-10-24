import { calcularCobros, etiquetaEstadoPago } from './cobros'
import type { FacturaConRelaciones } from './database.types'
import { MEDIOS_PAGO } from './database.types'

/**
 * Libro de Excel con las facturas de un contribuyente.
 *
 * Los montos y las fechas salen como numeros y fechas de verdad, no como
 * texto con puntos: asi se pueden sumar, ordenar y filtrar en Excel. El CDC es
 * lo contrario: son 44 digitos que NO son un numero, y Excel los pasaria a
 * notacion cientifica y se comeria los ultimos digitos, asi que va como texto.
 */

export type TipoColumna = 'texto' | 'fecha' | 'monto' | 'numero' | 'entero'
export type CeldaExcel = string | number | null

export interface ColumnaExcel {
  titulo: string
  ancho: number
  tipo: TipoColumna
}

export interface HojaExcel {
  nombre: string
  columnas: ColumnaExcel[]
  /** Las fechas van como yyyy-mm-dd; se convierten recien al escribir el archivo. */
  filas: CeldaExcel[][]
  /** Columna con la moneda de cada fila: de ella depende el formato de los montos. */
  columnaMoneda: number
}

const t = (titulo: string, ancho: number): ColumnaExcel => ({ titulo, ancho, tipo: 'texto' })
const f = (titulo: string): ColumnaExcel => ({ titulo, ancho: 12, tipo: 'fecha' })
const m = (titulo: string): ColumnaExcel => ({ titulo, ancho: 15, tipo: 'monto' })

const COLUMNAS_FACTURAS: ColumnaExcel[] = [
  f('Fecha'),
  t('Tipo', 9),
  t('N° factura', 18),
  t('Timbrado', 11),
  f('Venc. timbrado'),
  t('CDC', 48),
  t('Condición', 10),
  t('Proveedor', 32),
  t('RUC proveedor', 14),
  t('Cliente', 32),
  t('RUC cliente', 14),
  t('Moneda', 8),
  { titulo: 'Tipo de cambio', ancho: 12, tipo: 'numero' },
  m('Exentas'),
  m('Gravadas 5%'),
  m('IVA 5%'),
  m('Gravadas 10%'),
  m('IVA 10%'),
  m('IVA total'),
  m('Total'),
  m('Notas de crédito'),
  m('Neto'),
  m('Pagado / cobrado'),
  m('Saldo'),
  t('Estado', 11),
  t('Cuenta', 10),
  t('Denominación', 34),
  t('Forma de pago', 16),
  t('Observaciones', 40),
]

const COLUMNAS_DETALLE: ColumnaExcel[] = [
  f('Fecha'),
  t('N° factura', 18),
  t('Proveedor / Cliente', 32),
  { titulo: 'Línea', ancho: 7, tipo: 'entero' },
  t('Descripción', 50),
  { titulo: 'Cantidad', ancho: 10, tipo: 'numero' },
  m('Precio unitario'),
  m('Subtotal'),
  { titulo: 'IVA %', ancho: 7, tipo: 'entero' },
  t('Moneda', 8),
]

const COLUMNAS_NOTAS: ColumnaExcel[] = [
  f('Fecha'),
  t('N° nota', 18),
  t('N° factura', 18),
  t('Proveedor / Cliente', 32),
  t('CDC', 48),
  t('Motivo', 34),
  t('Timbrado', 11),
  t('Moneda', 8),
  m('Exentas'),
  m('Gravadas 5%'),
  m('IVA 5%'),
  m('Gravadas 10%'),
  m('IVA 10%'),
  m('Total'),
]

const COLUMNAS_PAGOS: ColumnaExcel[] = [
  f('Fecha'),
  t('N° factura', 18),
  t('Tipo', 9),
  t('Proveedor / Cliente', 32),
  t('Moneda', 8),
  m('Monto'),
  t('Medio', 14),
  t('Banco / entidad', 22),
  t('Referencia', 22),
  t('Observaciones', 40),
]

const contraparte = (fac: FacturaConRelaciones) =>
  (fac.tipo_operacion === 'compra' ? fac.proveedor_nombre : fac.cliente_nombre) ?? null

const medioDe = (medio: string) => MEDIOS_PAGO.find((x) => x.value === medio)?.label ?? medio

/**
 * El saldo y el estado se recalculan aca a partir de las notas y los pagos
 * que vienen con la factura, en vez de leer las columnas de la base: es lo
 * mismo (cobros.ts espeja la migracion 018) y deja la hoja consistente aunque
 * se haya editado algo entre que se cargo el listado y se apreto exportar.
 */
export function armarHojas(facturas: FacturaConRelaciones[]): HojaExcel[] {
  const hojaFacturas: CeldaExcel[][] = []
  const hojaDetalle: CeldaExcel[][] = []
  const hojaNotas: CeldaExcel[][] = []
  const hojaPagos: CeldaExcel[][] = []

  for (const fac of facturas) {
    const notas = fac.notas_credito ?? []
    const pagos = fac.pagos_factura ?? []
    const totalNotas = notas.reduce((acc, n) => acc + n.total, 0)
    const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0)
    const cobros = calcularCobros(fac.total, totalNotas, totalPagado)

    hojaFacturas.push([
      fac.fecha_factura,
      fac.tipo_operacion === 'compra' ? 'Compra' : 'Venta',
      fac.numero_factura,
      fac.timbrado,
      fac.timbrado_vencimiento,
      fac.cdc,
      fac.condicion_venta === 'contado' ? 'Contado' : fac.condicion_venta === 'credito' ? 'Crédito' : null,
      fac.proveedor_nombre,
      fac.proveedor_ruc,
      fac.cliente_nombre,
      fac.cliente_ruc,
      fac.moneda,
      fac.tipo_cambio,
      fac.exentas,
      fac.gravado_5,
      fac.iva_5,
      fac.gravado_10,
      fac.iva_10,
      fac.iva_total,
      fac.total,
      totalNotas,
      cobros.neto,
      totalPagado,
      cobros.saldo,
      etiquetaEstadoPago(cobros.estado, fac.tipo_operacion),
      fac.plan_cuentas?.cuenta ?? null,
      fac.plan_cuentas?.denominacion ?? null,
      fac.forma_pago,
      fac.observaciones,
    ])

    const lineas = [...(fac.factura_detalles ?? [])].sort((a, b) => a.orden - b.orden)
    lineas.forEach((d, i) => {
      hojaDetalle.push([
        fac.fecha_factura,
        fac.numero_factura,
        contraparte(fac),
        i + 1,
        d.descripcion,
        d.cantidad,
        d.precio_unitario,
        d.subtotal_linea,
        d.tasa_iva,
        fac.moneda,
      ])
    })

    for (const n of notas) {
      hojaNotas.push([
        n.fecha_nota,
        n.numero_nota,
        fac.numero_factura,
        contraparte(fac),
        n.cdc,
        n.motivo,
        n.timbrado,
        fac.moneda,
        n.exentas,
        n.gravado_5,
        n.iva_5,
        n.gravado_10,
        n.iva_10,
        n.total,
      ])
    }

    for (const p of pagos) {
      hojaPagos.push([
        p.fecha_pago,
        fac.numero_factura,
        fac.tipo_operacion === 'compra' ? 'Compra' : 'Venta',
        contraparte(fac),
        fac.moneda,
        p.monto,
        medioDe(p.medio_pago),
        p.entidad,
        p.referencia,
        p.observaciones,
      ])
    }
  }

  return [
    { nombre: 'Facturas', columnas: COLUMNAS_FACTURAS, filas: hojaFacturas, columnaMoneda: 11 },
    { nombre: 'Detalle', columnas: COLUMNAS_DETALLE, filas: hojaDetalle, columnaMoneda: 9 },
    { nombre: 'Notas de crédito', columnas: COLUMNAS_NOTAS, filas: hojaNotas, columnaMoneda: 7 },
    { nombre: 'Pagos y cobros', columnas: COLUMNAS_PAGOS, filas: hojaPagos, columnaMoneda: 4 },
  ]
}

/**
 * yyyy-mm-dd -> numero de serie de Excel (dias desde el 30/12/1899).
 *
 * Se calcula a mano con UTC en vez de pasarle un Date a la libreria: ella
 * convierte segun la zona horaria de quien exporta y, con un huso negativo
 * como el de Paraguay, una fecha a medianoche UTC aparece como el dia anterior.
 */
export function serieFecha(iso: string | null): number | null {
  if (!iso) return null
  const [a, mes, d] = iso.split('T')[0].split('-').map(Number)
  if (!a || !mes || !d) return null
  return Date.UTC(a, mes - 1, d) / 86_400_000 + 25_569
}

/** Nombre de archivo sin los caracteres que Windows no acepta (la razon social puede traer comillas). */
export function nombreArchivo(razonSocial: string, hoy = new Date()): string {
  const limpio = razonSocial.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'Contribuyente'
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `Facturas - ${limpio} - ${hoy.getFullYear()}-${mes}-${dia}.xlsx`
}

const FORMATO_FECHA = 'dd/mm/yyyy'

function formatoDeMonto(moneda: unknown): string {
  return moneda === 'PYG' ? '#,##0' : '#,##0.00'
}

/** Arma el libro. La libreria se carga recien aca: pesa ~500 kB y casi nadie exporta. */
export async function construirLibro(facturas: FacturaConRelaciones[]) {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()

  for (const hoja of armarHojas(facturas)) {
    const filas = hoja.filas.map((fila) =>
      fila.map((valor, i) => (hoja.columnas[i].tipo === 'fecha' ? serieFecha(valor as string | null) : valor)),
    )
    const ws = XLSX.utils.aoa_to_sheet([hoja.columnas.map((c) => c.titulo), ...filas])

    hoja.filas.forEach((fila, r) => {
      hoja.columnas.forEach((col, c) => {
        const celda = ws[XLSX.utils.encode_cell({ r: r + 1, c })]
        if (!celda) return
        if (col.tipo === 'fecha') celda.z = FORMATO_FECHA
        else if (col.tipo === 'monto') celda.z = formatoDeMonto(fila[hoja.columnaMoneda])
        // 'numero' (cantidad, tipo de cambio) queda en General: un formato con decimales
        // opcionales como #,##0.#### muestra el 1 como "1.", con el punto colgando
        else if (col.tipo === 'entero') celda.z = '0'
      })
    })

    ws['!cols'] = hoja.columnas.map((c) => ({ wch: c.ancho }))
    if (hoja.filas.length > 0 && ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] }
    XLSX.utils.book_append_sheet(libro, ws, hoja.nombre)
  }
  return libro
}

/** Escribe el .xlsx y dispara la descarga. */
export async function descargarExcel(facturas: FacturaConRelaciones[], razonSocial: string): Promise<void> {
  const XLSX = await import('xlsx')
  XLSX.writeFile(await construirLibro(facturas), nombreArchivo(razonSocial))
}
