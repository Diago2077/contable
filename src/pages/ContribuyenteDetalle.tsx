import { ArrowLeft, Pencil, Receipt, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ContribuyenteFormModal } from '@/components/contribuyentes/ContribuyenteFormModal'
import { PlanCuentasTab } from '@/components/contribuyentes/PlanCuentasTab'
import { FacturasTab } from '@/components/facturas/FacturasTab'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox } from '@/components/ui/estado'
import { useContribuyente, useContribuyentes } from '@/hooks/useContribuyentes'
import { formatRuc } from '@/lib/format'
import { cn } from '@/lib/utils'

type Tab = 'facturas' | 'plan-cuentas'

export default function ContribuyenteDetalle() {
  const { id } = useParams<{ id: string }>()
  const { data: contribuyente, loading, refetch } = useContribuyente(id)
  const { actualizar } = useContribuyentes()
  const [tab, setTab] = useState<Tab>('facturas')
  const [modalEdicion, setModalEdicion] = useState(false)

  async function alternarActivo() {
    if (!contribuyente) return
    const { error: err } = await actualizar(contribuyente.id, { activo: !contribuyente.activo })
    if (err) {
      toast.error(err)
      return
    }
    toast.success(contribuyente.activo ? 'Contribuyente desactivado' : 'Contribuyente activado')
    refetch()
  }

  if (loading) return <Cargando />
  if (!contribuyente) return <ErrorBox mensaje="No se encontro el contribuyente." />

  return (
    <div>
      <Link
        to="/contribuyentes"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Contribuyentes
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">{contribuyente.razon_social}</h1>
            <Badge tono={contribuyente.activo ? 'success' : 'neutral'}>
              {contribuyente.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            RUC {formatRuc(contribuyente.ruc)}
            {contribuyente.regimen && ` · ${contribuyente.regimen}`}
            {contribuyente.ciudad && ` · ${contribuyente.ciudad}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalEdicion(true)}>
            <Pencil /> Editar
          </Button>
          <Button variant="outline" onClick={alternarActivo}>
            {contribuyente.activo ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        <TabButton activo={tab === 'facturas'} onClick={() => setTab('facturas')} icono={Receipt}>
          Facturas
        </TabButton>
        <TabButton activo={tab === 'plan-cuentas'} onClick={() => setTab('plan-cuentas')} icono={Wallet}>
          Plan de cuentas
        </TabButton>
      </div>

      {tab === 'facturas' && <FacturasTab contribuyenteId={contribuyente.id} razonSocial={contribuyente.razon_social} />}

      {tab === 'plan-cuentas' && (
        <PlanCuentasTab contribuyenteId={contribuyente.id} empresaId={contribuyente.empresa_id} />
      )}

      <ContribuyenteFormModal
        abierto={modalEdicion}
        contribuyente={contribuyente}
        onCerrar={() => setModalEdicion(false)}
        onGuardado={() => {
          setModalEdicion(false)
          refetch()
        }}
      />
    </div>
  )
}

function TabButton({
  activo,
  onClick,
  icono: Icono,
  children,
}: {
  activo: boolean
  onClick: () => void
  icono: typeof Receipt
  children: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
        activo
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      <Icono className="size-4" />
      {children}
    </button>
  )
}
