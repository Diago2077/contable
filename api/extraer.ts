import { clienteAdmin, exigeUsuario } from './_lib/auth.js'
import { conManejoDeErrores, error, exigeMetodo, leerBody, type ApiHandler } from './_lib/http.js'

/**
 * Extrae los datos de una factura paraguaya a partir de una imagen, usando
 * un modelo de vision de OpenAI (configurable, ver configuracion_ia) con
 * structured outputs (json_schema + strict), asi que la respuesta ya viene
 * tipada -- no hace falta parsear fences markdown como en el sistema viejo.
 *
 * El RUC y la razon social del contribuyente se buscan en la base del lado
 * del servidor (nunca se confia en lo que mande el cliente) y se le pasan al
 * modelo para que decida si la factura es una compra o una venta: si el RUC
 * del receptor coincide con el del contribuyente, es una compra; si coincide
 * el del emisor, es una venta.
 */

// El modelo, los precios y el resto de los parametros de la llamada viven
// en la tabla configuracion_ia (editable por el super_admin desde
// /admindrpcs), no hardcodeados aca. Esto es solo el respaldo por si esa
// fila no existiera por algun motivo (no deberia pasar, la migracion la crea).
const CONFIG_POR_DEFECTO: { modelo: string; precio_input_por_1m: number; precio_output_por_1m: number; reasoning_effort: string | null; max_tokens: number } = {
  modelo: 'gpt-4o',
  precio_input_por_1m: 2.5,
  precio_output_por_1m: 10,
  reasoning_effort: null,
  max_tokens: 2500,
}

interface Body {
  contribuyente_id?: string
  imagen_base64?: string
  mime_type?: string
}

interface CuentaPlan {
  id: string
  cuenta: string
  denominacion: string
}

const ESQUEMA_DETALLE = {
  type: 'object',
  properties: {
    descripcion: { type: ['string', 'null'] },
    cantidad: { type: ['number', 'null'] },
    precio_unitario: { type: ['number', 'null'] },
    subtotal_linea: { type: ['number', 'null'] },
    tasa_iva: { type: ['integer', 'null'], enum: [0, 5, 10, null] },
  },
  required: ['descripcion', 'cantidad', 'precio_unitario', 'subtotal_linea', 'tasa_iva'],
  additionalProperties: false,
} as const

function esquemaFactura(planCuentas: CuentaPlan[]) {
  // Se usa el indice (0, 1, 2...) en vez del uuid real de la cuenta: con un
  // plan de cuentas de varios cientos de filas, mandarle el uuid completo a
  // la IA -- dos veces, una en el prompt y otra en este enum -- multiplica el
  // costo por varias veces sin necesidad. El indice se traduce de vuelta al
  // uuid real del lado del servidor, nunca se expone al cliente.
  const propiedadPlanCuenta = planCuentas.length > 0
    ? {
        type: ['string', 'null'] as const,
        enum: [...planCuentas.map((_, i) => String(i)), null],
        description:
          'indice de la cuenta del plan de cuentas que mejor clasifica esta factura segun su detalle. Si ninguna es un buen match, elegi la mas parecida igual.',
      }
    : { type: 'null' as const, description: 'el contribuyente no tiene plan de cuentas cargado' }

  return {
    type: 'object',
    properties: {
      tipo_operacion: {
        type: 'string',
        enum: ['compra', 'venta'],
        description:
          'compra si el RUC del contribuyente aparece como receptor/cliente; venta si aparece como emisor/proveedor',
      },
      numero_factura: { type: ['string', 'null'] },
      fecha_factura: { type: ['string', 'null'], description: 'formato DD/MM/AAAA tal como figura en la factura' },
      timbrado: { type: ['string', 'null'] },
      timbrado_vencimiento: { type: ['string', 'null'], description: 'formato DD/MM/AAAA' },
      condicion_venta: { type: ['string', 'null'], enum: ['contado', 'credito', null] },

      proveedor_nombre: { type: ['string', 'null'] },
      proveedor_ruc: { type: ['string', 'null'] },
      proveedor_direccion: { type: ['string', 'null'] },
      cliente_nombre: { type: ['string', 'null'] },
      cliente_ruc: { type: ['string', 'null'] },
      cliente_direccion: { type: ['string', 'null'] },

      moneda: { type: 'string', description: "codigo de 3 letras, por defecto 'PYG'" },
      tipo_cambio: { type: ['number', 'null'] },

      exentas: { type: 'number', description: 'monto de la columna Exentas, 0 si no tiene' },
      gravado_5: { type: 'number', description: 'monto de la columna Gravadas 5% (IVA incluido), 0 si no tiene' },
      iva_5: { type: 'number', description: 'IVA liquidado sobre gravado_5, 0 si no tiene' },
      gravado_10: { type: 'number', description: 'monto de la columna Gravadas 10% (IVA incluido), 0 si no tiene' },
      iva_10: { type: 'number', description: 'IVA liquidado sobre gravado_10, 0 si no tiene' },
      total: { type: 'number', description: 'total de la factura: exentas + gravado_5 + gravado_10' },

      forma_pago: { type: ['string', 'null'] },
      observaciones: { type: ['string', 'null'] },

      plan_cuenta_id: propiedadPlanCuenta,

      detalles: { type: 'array', items: ESQUEMA_DETALLE, description: 'todas las lineas de detalle que se encuentren' },
    },
    required: [
      'tipo_operacion', 'numero_factura', 'fecha_factura', 'timbrado', 'timbrado_vencimiento',
      'condicion_venta', 'proveedor_nombre', 'proveedor_ruc', 'proveedor_direccion',
      'cliente_nombre', 'cliente_ruc', 'cliente_direccion', 'moneda', 'tipo_cambio',
      'exentas', 'gravado_5', 'iva_5', 'gravado_10', 'iva_10', 'total',
      'forma_pago', 'observaciones', 'plan_cuenta_id', 'detalles',
    ],
    additionalProperties: false,
  } as const
}

function prompt(rucContribuyente: string, razonSocial: string, planCuentas: CuentaPlan[]): string {
  const listaCuentas = planCuentas.length > 0
    ? planCuentas.map((c, i) => `  - indice ${i}: ${c.cuenta} — ${c.denominacion}`).join('\n')
    : null

  return `Sos un asistente que extrae datos de facturas paraguayas (timbradas por la SET) a partir de una imagen.

El contribuyente que esta cargando esta factura es:
  RUC: ${rucContribuyente}
  Razon social: ${razonSocial}

Reglas:
- Si el RUC de ${rucContribuyente} aparece como RECEPTOR/CLIENTE de la factura, es una COMPRA para el contribuyente.
- Si el RUC de ${rucContribuyente} aparece como EMISOR/PROVEEDOR de la factura, es una VENTA del contribuyente.
- Las columnas "Exentas", "Gravadas 5%" y "Gravadas 10%" de una factura paraguaya vienen CON el IVA incluido. El total es la suma de esas tres columnas.
- Si un campo no esta visible en la imagen, devolve null (o 0 para los montos).
- Los montos son numeros, sin simbolo de moneda ni separadores de miles.
- Las fechas van en formato DD/MM/AAAA tal como aparecen en la factura.
- Extrae TODAS las lineas de detalle que encuentres.
- No inventes datos que no esten en la imagen.
${
  listaCuentas
    ? `\nEste es el plan de cuentas del contribuyente, para categorizar la factura segun el detalle de mercaderias/servicios:\n${listaCuentas}\n\nElegi el indice de la cuenta que mejor clasifique la factura en base a lo que se compro o vendio. Si ninguna calza perfecto, elegi la mas parecida de todas formas. Devolve el numero de indice tal como aparece en la lista, no el codigo de la cuenta.`
    : ''
}`
}

const handler: ApiHandler = async (req, res) => {
  if (!exigeMetodo(req, res, 'POST')) return

  const perfil = await exigeUsuario(req, res)
  if (!perfil) return

  const body = leerBody<Body>(req)
  if (!body.contribuyente_id) return error(res, 400, 'Falta el contribuyente.')
  if (!body.imagen_base64) return error(res, 400, 'Falta la imagen.')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return error(res, 500, 'El servidor no tiene configurada la extraccion por IA.')

  const admin = clienteAdmin()
  const { data: contribuyente } = await admin
    .from('contribuyentes')
    .select('id, empresa_id, ruc, razon_social')
    .eq('id', body.contribuyente_id)
    .maybeSingle()

  if (!contribuyente) return error(res, 404, 'Contribuyente no encontrado.')
  if (perfil.rol !== 'super_admin' && contribuyente.empresa_id !== perfil.empresa_id) {
    return error(res, 403, 'Ese contribuyente no pertenece a tu estudio.')
  }

  const { data: empresa } = await admin
    .from('empresas')
    .select('limite_tokens_mensual')
    .eq('id', contribuyente.empresa_id)
    .maybeSingle()

  if (empresa?.limite_tokens_mensual != null) {
    const inicioMes = new Date()
    inicioMes.setUTCDate(1)
    inicioMes.setUTCHours(0, 0, 0, 0)

    const { data: usoMes } = await admin
      .from('uso_ia')
      .select('tokens_total')
      .eq('empresa_id', contribuyente.empresa_id)
      .gte('created_at', inicioMes.toISOString())

    const tokensUsados = (usoMes ?? []).reduce((acc, u) => acc + u.tokens_total, 0)
    if (tokensUsados >= empresa.limite_tokens_mensual) {
      return error(
        res,
        429,
        'Este estudio alcanzo su limite mensual de extraccion por IA. Contactate con el administrador del sistema.',
      )
    }
  }

  const { data: planCuentas } = await admin
    .from('plan_cuentas')
    .select('id, cuenta, denominacion')
    .eq('contribuyente_id', body.contribuyente_id)
    .eq('activo', true)
    .order('cuenta', { ascending: true })

  const { data: configDb } = await admin.from('configuracion_ia').select('*').eq('id', true).maybeSingle()
  const config = configDb ?? CONFIG_POR_DEFECTO

  const mime = body.mime_type || 'image/png'

  try {
    const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelo,
        temperature: 0,
        // Los modelos gpt-5.x (razonadores) no aceptan 'max_tokens' -- piden
        // 'max_completion_tokens' en su lugar; los demas (gpt-4o y previos)
        // es al reves. Mandar el que no corresponde tira un error 400.
        ...(config.modelo.startsWith('gpt-5')
          ? { max_completion_tokens: config.max_tokens }
          : { max_tokens: config.max_tokens }),
        // gpt-4o no reconoce este parametro; solo se manda para modelos de
        // la familia gpt-5.x, que sí lo soportan (y lo usan aunque no se
        // mande, por defecto en 'medium'). Va plano (reasoning_effort) en
        // /v1/chat/completions -- la forma anidada { reasoning: { effort } }
        // es de /v1/responses, otro endpoint, y tira "Unknown parameter".
        ...(config.modelo.startsWith('gpt-5') && config.reasoning_effort
          ? { reasoning_effort: config.reasoning_effort }
          : {}),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt(contribuyente.ruc, contribuyente.razon_social, planCuentas ?? []) },
              {
                type: 'image_url',
                image_url: { url: `data:${mime};base64,${body.imagen_base64}`, detail: 'high' },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'factura', strict: true, schema: esquemaFactura(planCuentas ?? []) },
        },
      }),
    })

    if (!respuesta.ok) {
      const texto = await respuesta.text()
      console.error('OpenAI error', respuesta.status, texto)
      return error(res, 502, 'No se pudo procesar la factura con IA.')
    }

    const json = (await respuesta.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const contenido = json.choices?.[0]?.message?.content
    if (!contenido) return error(res, 502, 'La IA no devolvio ningun resultado.')

    const tokensPrompt = json.usage?.prompt_tokens ?? 0
    const tokensCompletion = json.usage?.completion_tokens ?? 0
    const tokensTotal = json.usage?.total_tokens ?? tokensPrompt + tokensCompletion
    const costoUsd =
      (tokensPrompt * config.precio_input_por_1m + tokensCompletion * config.precio_output_por_1m) / 1_000_000

    // Se espera el insert (aunque un fallo aca no corta la respuesta): en el
    // runtime serverless de Vercel, una promesa disparada sin await puede no
    // llegar a completarse si el contenedor se congela apenas se devuelve la
    // respuesta -- el registro de consumo se perdia en silencio.
    const { error: errUso } = await admin.from('uso_ia').insert({
      empresa_id: contribuyente.empresa_id,
      contribuyente_id: contribuyente.id,
      tokens_prompt: tokensPrompt,
      tokens_completion: tokensCompletion,
      tokens_total: tokensTotal,
      costo_usd: costoUsd,
    })
    if (errUso) console.error('No se pudo registrar el uso de IA', errUso)

    const datos = JSON.parse(contenido) as { plan_cuenta_id?: string | null; [k: string]: unknown }

    // La IA devuelve el indice de la lista, no el uuid real: se traduce aca
    // antes de mandarselo al cliente, que espera un plan_cuenta_id de verdad.
    if (datos.plan_cuenta_id != null) {
      const indice = Number(datos.plan_cuenta_id)
      datos.plan_cuenta_id = Number.isInteger(indice) ? (planCuentas?.[indice]?.id ?? null) : null
    }

    res.status(200).json({ ok: true, datos })
  } catch (e) {
    console.error('api/extraer', e)
    return error(res, 500, 'Error interno al extraer la factura.')
  }
}

export default conManejoDeErrores(handler)
