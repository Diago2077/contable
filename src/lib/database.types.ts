/**
 * Tipos de la base, escritos a mano.
 *
 * Se mantienen a mano y no generados porque afinan cosas que el generador no
 * puede saber -- que `rol` es una union y no un string suelto, que
 * `tipo_operacion` solo puede ser compra o venta -- y porque llevan los
 * comentarios que explican para que sirve cada campo.
 *
 * El riesgo de eso es que una migracion los deje desactualizados en silencio,
 * y ya paso: cuando plan_cuentas.codigo paso a llamarse cuenta quedo un
 * .order('codigo') vivo en api/extraer.ts que hacia fallar la consulta sin
 * tirar ningun error, y la IA se quedaba sin plan de cuentas. Por eso al
 * final del archivo hay un chequeo contra el esquema real que convierte ese
 * tipo de desfasaje en un error de compilacion.
 */

import type { Database } from './database.generated'

export type Rol = 'super_admin' | 'admin' | 'usuario'
export type TipoOperacion = 'compra' | 'venta'
export type TipoPersona = 'fisica' | 'juridica'
export type CondicionVenta = 'contado' | 'credito'

export const REGIMENES = ['IRE General', 'IRE SIMPLE', 'RESIMPLE', 'IRP', 'Solo IVA'] as const
export const MONEDAS = ['PYG', 'USD', 'BRL', 'ARS', 'EUR'] as const

export interface Empresa {
  id: string
  nombre: string
  ruc: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  logo_url: string | null
  activo: boolean
  /** null = sin limite. Al superarlo en el mes, api/extraer.ts corta la extraccion por IA. */
  limite_tokens_mensual: number | null
  created_at: string
}

/** Un registro por cada llamada a la IA que efectivamente proceso una factura. */
export interface UsoIA {
  id: string
  empresa_id: string
  contribuyente_id: string | null
  usuario_id: string | null
  modelo: string | null
  tokens_prompt: number
  tokens_completion: number
  tokens_total: number
  /** Parte de tokens_prompt que vino del cache de OpenAI, facturada a mitad de precio. */
  tokens_cache: number
  costo_usd: number
  created_at: string
}

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** Fila unica (singleton): que modelo de IA usar y con que parametros, editable por el super_admin. */
export interface ConfiguracionIA {
  id: true
  modelo: string
  precio_input_por_1m: number
  precio_output_por_1m: number
  /** Tokens de prompt servidos desde el cache de OpenAI; en gpt-4o, la mitad del input. */
  precio_cache_por_1m: number
  /** null = no se manda el parametro (modelos que no son gpt-5.x lo ignoran igual). */
  reasoning_effort: ReasoningEffort | null
  max_tokens: number
  /** Tokens que un mismo usuario puede gastar por hora. null = sin tope. */
  limite_tokens_usuario_hora: number | null
  updated_at: string
}
export type ConfiguracionIAUpdate = Partial<Omit<ConfiguracionIA, 'id' | 'updated_at'>>

export interface Usuario {
  id: string
  empresa_id: string | null
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  created_at: string
}

export interface Contribuyente {
  id: string
  empresa_id: string
  ruc: string
  razon_social: string
  nombre_fantasia: string | null
  tipo_persona: TipoPersona
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  email: string | null
  regimen: string | null
  activo: boolean
  created_at: string
}

export type Naturaleza = 'D' | 'A'

export interface PlanCuenta {
  id: string
  empresa_id: string
  contribuyente_id: string
  cuenta: string
  denominacion: string
  /** Profundidad en el arbol del plan de cuentas. Se carga tal cual, no se deriva del codigo. */
  nivel: number | null
  /** D = Deudora, A = Acreedora. */
  naturaleza: Naturaleza | null
  /** Si puede recibir facturas directamente, o es solo una cuenta de agrupacion (ej. "ACTIVO"). */
  asentable: boolean
  centro_costo: boolean
  moneda: string
  /** Texto libre: no tiene un formato fijo en el sistema de origen. */
  tipo_cambio: string | null
  /** Codigo de referencia a otro sistema (ej. SSET/Hechauka), opcional. */
  cuenta_sset: string | null
  activo: boolean
  created_at: string
}

export interface Factura {
  id: string
  empresa_id: string
  contribuyente_id: string
  plan_cuenta_id: string | null

  tipo_operacion: TipoOperacion

  numero_factura: string | null
  fecha_factura: string | null
  timbrado: string | null
  timbrado_vencimiento: string | null
  condicion_venta: CondicionVenta | null

  proveedor_nombre: string | null
  proveedor_ruc: string | null
  proveedor_direccion: string | null
  cliente_nombre: string | null
  cliente_ruc: string | null
  cliente_direccion: string | null

  moneda: string
  tipo_cambio: number | null

  exentas: number
  gravado_5: number
  gravado_10: number
  iva_5: number
  iva_10: number
  total: number
  /** Generada por Postgres: iva_5 + iva_10. Nunca se envia en un insert. */
  iva_total: number
  /** Generada por Postgres: total - iva_total. Nunca se envia en un insert. */
  subtotal: number

  forma_pago: string | null
  observaciones: string | null

  archivo_path: string | null
  archivo_nombre: string | null
  archivo_mime: string | null

  extraccion_raw: unknown | null

  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FacturaDetalle {
  id: string
  factura_id: string
  orden: number
  descripcion: string | null
  cantidad: number | null
  precio_unitario: number | null
  subtotal_linea: number | null
  tasa_iva: number | null
}

/** Campos que la base calcula sola y que no se mandan nunca en un insert/update. */
type Generados = 'id' | 'created_at' | 'updated_at' | 'iva_total' | 'subtotal'

export type FacturaInsert = Omit<Factura, Generados>
export type FacturaUpdate = Partial<FacturaInsert>
export type ContribuyenteInsert = Omit<Contribuyente, 'id' | 'created_at'>
export type ContribuyenteUpdate = Partial<ContribuyenteInsert>
export type PlanCuentaInsert = Omit<PlanCuenta, 'id' | 'created_at'>
export type PlanCuentaUpdate = Partial<PlanCuentaInsert>
export type EmpresaInsert = Omit<Empresa, 'id' | 'created_at'>
export type EmpresaUpdate = Partial<EmpresaInsert>
export type FacturaDetalleInsert = Omit<FacturaDetalle, 'id'>

/** Factura con sus relaciones resueltas, tal como la devuelven los listados. */
export interface FacturaConRelaciones extends Factura {
  plan_cuentas: Pick<PlanCuenta, 'id' | 'cuenta' | 'denominacion'> | null
  factura_detalles?: FacturaDetalle[]
}

// ─────────────────────────────────────────────────────────────
// Chequeo contra el esquema real (ver el comentario de arriba)
//
// No compara los tipos de cada campo -- eso romperia a proposito las uniones
// afinadas de mas arriba -- sino los NOMBRES de las columnas, que es donde
// estan los desfasajes que pasan desapercibidos: una columna renombrada o
// borrada por una migracion deja de existir en el tipo generado y el build
// falla nombrando la tabla.
//
// Para regenerar database.generated.ts despues de migrar: npm run tipos
// ─────────────────────────────────────────────────────────────
type Fila<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type Afirmar<T extends true> = T
type ColumnasExisten<Propio, EnLaBase> =
  Extract<keyof Propio, string> extends Extract<keyof EnLaBase, string> ? true : false

export type ChequeoDeEsquema = [
  Afirmar<ColumnasExisten<Empresa, Fila<'empresas'>>>,
  Afirmar<ColumnasExisten<Usuario, Fila<'usuarios'>>>,
  Afirmar<ColumnasExisten<Contribuyente, Fila<'contribuyentes'>>>,
  Afirmar<ColumnasExisten<PlanCuenta, Fila<'plan_cuentas'>>>,
  Afirmar<ColumnasExisten<Factura, Fila<'facturas'>>>,
  Afirmar<ColumnasExisten<FacturaDetalle, Fila<'factura_detalles'>>>,
  Afirmar<ColumnasExisten<UsoIA, Fila<'uso_ia'>>>,
  Afirmar<ColumnasExisten<ConfiguracionIA, Fila<'configuracion_ia'>>>,
]
