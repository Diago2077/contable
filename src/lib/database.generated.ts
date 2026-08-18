/**
 * GENERADO AUTOMATICAMENTE — no editar a mano.
 *
 * Refleja el esquema real de la base. Se usa desde database.types.ts para
 * chequear en tiempo de compilacion que los tipos escritos a mano no se
 * hayan quedado atras respecto de una migracion.
 *
 * Para regenerarlo despues de aplicar migraciones:
 *   npx supabase gen types typescript --project-id ofhpyyutsezyhyxbhjcf > src/lib/database.generated.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      configuracion_ia: {
        Row: {
          id: boolean
          limite_tokens_usuario_hora: number | null
          max_tokens: number
          modelo: string
          precio_cache_por_1m: number
          precio_input_por_1m: number
          precio_output_por_1m: number
          reasoning_effort: string | null
          updated_at: string
        }
      }
      contribuyentes: {
        Row: {
          activo: boolean
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_id: string
          id: string
          nombre_fantasia: string | null
          razon_social: string
          regimen: string | null
          ruc: string
          telefono: string | null
          tipo_persona: string
        }
      }
      empresas: {
        Row: {
          activo: boolean
          created_at: string | null
          direccion: string | null
          email: string | null
          id: string
          limite_tokens_mensual: number | null
          logo_url: string | null
          nombre: string
          ruc: string | null
          telefono: string | null
        }
      }
      factura_detalles: {
        Row: {
          cantidad: number | null
          descripcion: string | null
          factura_id: string
          id: string
          orden: number
          precio_unitario: number | null
          subtotal_linea: number | null
          tasa_iva: number | null
        }
      }
      facturas: {
        Row: {
          archivo_mime: string | null
          archivo_nombre: string | null
          archivo_path: string | null
          cliente_direccion: string | null
          cliente_nombre: string | null
          cliente_ruc: string | null
          condicion_venta: string | null
          contribuyente_id: string
          created_at: string | null
          created_by: string | null
          empresa_id: string
          exentas: number
          extraccion_raw: Json | null
          fecha_factura: string | null
          forma_pago: string | null
          gravado_10: number
          gravado_5: number
          id: string
          iva_10: number
          iva_5: number
          iva_total: number | null
          moneda: string
          numero_factura: string | null
          observaciones: string | null
          plan_cuenta_id: string | null
          proveedor_direccion: string | null
          proveedor_nombre: string | null
          proveedor_ruc: string | null
          subtotal: number | null
          timbrado: string | null
          timbrado_vencimiento: string | null
          tipo_cambio: number | null
          tipo_operacion: string
          total: number
          updated_at: string | null
        }
      }
      plan_cuentas: {
        Row: {
          activo: boolean
          asentable: boolean
          centro_costo: boolean
          contribuyente_id: string
          created_at: string | null
          cuenta: string
          cuenta_sset: string | null
          denominacion: string
          empresa_id: string
          id: string
          moneda: string
          naturaleza: string | null
          nivel: number | null
          tipo_cambio: string | null
        }
      }
      uso_ia: {
        Row: {
          contribuyente_id: string | null
          costo_usd: number
          created_at: string
          empresa_id: string
          id: string
          modelo: string | null
          tokens_cache: number
          tokens_completion: number
          tokens_prompt: number
          tokens_total: number
          usuario_id: string | null
        }
      }
      usuarios: {
        Row: {
          activo: boolean
          created_at: string | null
          email: string
          empresa_id: string | null
          id: string
          nombre: string
          rol: string
        }
      }
    }
    Functions: {
      crear_factura_con_detalles: {
        Args: { detalles?: Json; factura: Json }
        Returns: string
      }
    }
  }
}
