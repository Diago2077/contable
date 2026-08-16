import { Building2, FileText, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

interface Modulo {
  to: string
  titulo: string
  descripcion: string
  icono: ComponentType<{ className?: string }>
  destacado?: boolean
}

export default function Inicio() {
  const { perfil, empresa, esSuperAdmin } = useAuth()
  const [conteos, setConteos] = useState<{ contribuyentes: number; facturas: number } | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      const [c, f] = await Promise.all([
        supabase.from('contribuyentes').select('*', { count: 'exact', head: true }),
        supabase.from('facturas').select('*', { count: 'exact', head: true }),
      ])
      if (cancelado) return
      setConteos({ contribuyentes: c.count ?? 0, facturas: f.count ?? 0 })
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [])

  const modulos: Modulo[] = [
    {
      to: '/contribuyentes',
      titulo: 'Contribuyentes',
      descripcion: 'Alta y gestion de los clientes del estudio. Desde aca se entra a sus facturas y a su plan de cuentas.',
      icono: FileText,
      destacado: true,
    },
  ]

  // Un usuario raso solo trabaja con contribuyentes/facturas: la gestion de
  // usuarios y los datos del estudio son cosa de quien lo administra.
  if (perfil?.rol !== 'usuario') {
    modulos.push(
      {
        to: '/usuarios',
        titulo: 'Usuarios',
        descripcion: 'Quienes tienen acceso al estudio.',
        icono: Users,
      },
      {
        to: '/empresa',
        titulo: 'Mi estudio',
        descripcion: 'Datos de la empresa.',
        icono: Building2,
      },
    )
  }

  if (esSuperAdmin) {
    modulos.push({
      to: '/admindrpcs',
      titulo: 'Administracion del sistema',
      descripcion: 'Alta de estudios contables y de sus usuarios.',
      icono: ShieldCheck,
    })
  }

  const primerNombre = perfil?.nombre?.split(' ')[0] ?? ''

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-foreground">
          Hola{primerNombre ? `, ${primerNombre}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {empresa
            ? empresa.nombre
            : esSuperAdmin
              ? 'Estas conectado como administrador del sistema.'
              : ''}
          {conteos && empresa && (
            <>
              {' · '}
              <span className="tabular">{conteos.contribuyentes}</span>{' '}
              {conteos.contribuyentes === 1 ? 'contribuyente' : 'contribuyentes'}
              {' · '}
              <span className="tabular">{conteos.facturas}</span>{' '}
              {conteos.facturas === 1 ? 'factura' : 'facturas'}
            </>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map(({ to, titulo, descripcion, icono: Icono, destacado }) => (
          <Link
            key={to}
            to={to}
            className={
              'group rounded-lg border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' +
              (destacado ? ' sm:col-span-2 lg:col-span-1' : '')
            }
          >
            <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icono className="size-4.5" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
