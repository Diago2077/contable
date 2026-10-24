import type { PostgrestError } from '@supabase/supabase-js'

/**
 * PostgREST corta cada respuesta en `max_rows` (1000 por defecto) sin avisar,
 * asi que una lista completa hay que pedirla por paginas. `crearConsulta` se
 * llama una vez por pagina y tiene que devolver una consulta NUEVA y ORDENADA
 * por una clave unica (sin un orden estable las paginas se pisan o se saltean
 * filas): ordenar por la columna que se muestra y desempatar por `id`.
 */
export async function traerTodo<T>(
  crearConsulta: () => {
    range: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: PostgrestError | null }>
  },
  tamano = 1000,
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await crearConsulta().range(desde, desde + tamano - 1)
    if (error) throw new Error(error.message)
    const pagina = (data ?? []) as T[]
    filas.push(...pagina)
    if (pagina.length < tamano) break
  }
  return filas
}
