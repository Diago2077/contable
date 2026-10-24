import { useCallback, useEffect, useState } from 'react'
import type { Contribuyente, ContribuyenteInsert, ContribuyenteUpdate } from '@/lib/database.types'
import { traerTodo } from '@/lib/db'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: Contribuyente[]
  loading: boolean
  error: string | null
}

/**
 * Trae todos los contribuyentes de la empresa (la RLS ya filtra). El listado
 * es chico por estudio -- se busca y filtra en cliente en vez de pegarle a
 * la base en cada tecla.
 */
export function useContribuyentes() {
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    setEstado((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await traerTodo<Contribuyente>(() =>
        supabase.from('contribuyentes').select('*').order('razon_social', { ascending: true }).order('id'),
      )
      setEstado({ data, loading: false, error: null })
    } catch {
      setEstado({ data: [], loading: false, error: 'No se pudieron cargar los contribuyentes.' })
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function crear(payload: ContribuyenteInsert) {
    const { data, error } = await supabase
      .from('contribuyentes')
      .insert(payload)
      .select()
      .single()
    if (error) {
      const duplicado = error.code === '23505'
      return {
        data: null,
        error: duplicado ? 'Ya existe un contribuyente con ese RUC.' : 'No se pudo guardar.',
      }
    }
    return { data: data as Contribuyente, error: null }
  }

  async function actualizar(id: string, payload: ContribuyenteUpdate) {
    const { error } = await supabase.from('contribuyentes').update(payload).eq('id', id)
    if (error) {
      const duplicado = error.code === '23505'
      return { error: duplicado ? 'Ya existe un contribuyente con ese RUC.' : 'No se pudo guardar.' }
    }
    return { error: null }
  }

  return { ...estado, refetch, crear, actualizar }
}

export function useContribuyente(id: string | undefined) {
  const [data, setData] = useState<Contribuyente | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data: fila } = await supabase
      .from('contribuyentes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    setData((fila as Contribuyente) ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}
