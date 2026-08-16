/**
 * Tipos de la base, escritos a mano y espejados de supabase/migrations/001_schema.sql.
 * Si se toca una migracion, hay que tocar este archivo.
 */

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
  tokens_prompt: number
  tokens_completion: number
  tokens_total: number
  costo_usd: number
  created_at: string
}

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

export interface PlanCuenta {
  id: string
  empresa_id: string
  contribuyente_id: string
  codigo: string
  descripcion: string
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
  plan_cuentas: Pick<PlanCuenta, 'id' | 'codigo' | 'descripcion'> | null
  factura_detalles?: FacturaDetalle[]
}
