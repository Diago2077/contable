import { useCallback, useEffect, useState } from 'react'
import type { PlanCuenta, PlanCuentaInsert, PlanCuentaUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

interface Estado {
  data: PlanCuenta[]
  loading: boolean
  error: string | null
}

export function usePlanCuentas(contribuyenteId: string | undefined) {
  const [estado, setEstado] = useState<Estado>({ data: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!contribuyenteId) return
    setEstado((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('plan_cuentas')
      .select('*')
      .eq('contribuyente_id', contribuyenteId)
      .order('cuenta', { ascending: true })

    setEstado({
      data: (data as PlanCuenta[]) ?? [],
      loading: false,
      error: error ? 'No se pudo cargar el plan de cuentas.' : null,
    })
  }, [contribuyenteId])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function crear(payload: PlanCuentaInsert) {
    const { data, error } = await supabase.from('plan_cuentas').insert(payload).select().single()
    if (error) {
      const duplicado = error.code === '23505'
      return { data: null, error: duplicado ? 'Ya existe una cuenta con ese numero.' : 'No se pudo guardar.' }
    }
    return { data: data as PlanCuenta, error: null }
  }

  /** Inserta varias de una, salteando cuentas que ya existan (para importar CSV). */
  async function crearVarias(filas: PlanCuentaInsert[]) {
    if (filas.length === 0) return { insertadas: 0, error: null }
    const { error, count } = await supabase
      .from('plan_cuentas')
      .insert(filas, { count: 'exact' })
    if (error) {
      return { insertadas: 0, error: 'No se pudieron importar las cuentas. Revisa que no haya numeros de cuenta repetidos.' }
    }
    return { insertadas: count ?? filas.length, error: null }
  }

  async function actualizar(id: string, payload: PlanCuentaUpdate) {
    const { error } = await supabase.from('plan_cuentas').update(payload).eq('id', id)
    if (error) {
      const duplicado = error.code === '23505'
      return { error: duplicado ? 'Ya existe una cuenta con ese numero.' : 'No se pudo guardar.' }
    }
    return { error: null }
  }

  async function eliminar(id: string) {
    const { error } = await supabase.from('plan_cuentas').delete().eq('id', id)
    if (error) {
      // El fk de facturas.plan_cuenta_id es "on delete set null", asi que
      // esto en la practica no deberia pasar salvo un problema de permisos
      return { error: 'No se pudo eliminar la cuenta.' }
    }
    return { error: null }
  }

  return { ...estado, refetch, crear, crearVarias, actualizar, eliminar }
}
