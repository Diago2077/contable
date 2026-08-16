import { KeyRound, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Field, Input } from '@/components/ui/field'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { useAuth } from '@/hooks/useAuth'
import { useUsuarios } from '@/hooks/useUsuarios'
import type { Usuario } from '@/lib/database.types'
import { formatFecha, normalizar } from '@/lib/format'

const ROL_LABEL: Record<Usuario['rol'], string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  usuario: 'Usuario',
}

export default function Usuarios() {
  const { perfil, empresa } = useAuth()
  const navigate = useNavigate()

  // Ver quien tiene acceso al estudio es cosa de quien lo administra: un
  // usuario raso ni entra a esta pantalla (la RLS tampoco le deja leer la
  // lista, esto solo evita que se quede mirando una pantalla vacia/rota).
  useEffect(() => {
    if (perfil && perfil.rol === 'usuario') navigate('/', { replace: true })
  }, [perfil, navigate])

  const { data, loading, error, refetch, crear, editar, eliminar, cambiarPassword, setActivo } = useUsuarios(
    empresa?.id,
  )
  const puedeGestionar = perfil?.rol === 'admin'
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return data
    return data.filter((u) => normalizar(u.nombre).includes(q) || normalizar(u.email).includes(q))
  }, [data, busqueda])

  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalDetalle, setModalDetalle] = useState<Usuario | null>(null)
  const [modalEditar, setModalEditar] = useState<Usuario | null>(null)
  const [modalPassword, setModalPassword] = useState<Usuario | null>(null)
  const [modalEliminar, setModalEliminar] = useState<Usuario | null>(null)

  if (perfil?.rol === 'usuario') return null

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {puedeGestionar
              ? `Quienes tienen acceso a ${empresa?.nombre ?? 'este estudio'}.`
              : `Quienes tienen acceso a ${empresa?.nombre ?? 'este estudio'}. Las altas y bajas las gestiona el administrador.`}
          </p>
        </div>
        {puedeGestionar && (
          <Button onClick={() => setModalNuevo(true)}>
            <Plus /> Nuevo usuario
          </Button>
        )}
      </div>

      {data.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o email…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <Cargando />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio icono={UserRound} titulo="Sin usuarios" />
      ) : filtrados.length === 0 ? (
        <Vacio icono={UserRound} titulo="Sin resultados" descripcion="Probá con otra busqueda." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                // Un admin solo puede administrar usuarios 'usuario': a otro
                // admin (o a si mismo) lo ve, pero la fila no abre el detalle.
                const clickeable = puedeGestionar && u.rol === 'usuario'
                return (
                  <tr
                    key={u.id}
                    onClick={clickeable ? () => setModalDetalle(u) : undefined}
                    className={
                      clickeable
                        ? 'cursor-pointer border-b border-border last:border-0 hover:bg-accent/40'
                        : 'border-b border-border last:border-0'
                    }
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{u.nombre}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{ROL_LABEL[u.rol]}</td>
                    <td className="px-4 py-2.5">
                      <Badge tono={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {puedeGestionar && empresa && (
        <>
          <NuevoUsuarioModal
            abierto={modalNuevo}
            empresaId={empresa.id}
            onCerrar={() => setModalNuevo(false)}
            onCreado={() => {
              setModalNuevo(false)
              refetch()
            }}
            crear={crear}
          />

          <UsuarioDetalleModal
            usuario={modalDetalle}
            onCerrar={() => setModalDetalle(null)}
            onEditar={() => {
              setModalEditar(modalDetalle)
              setModalDetalle(null)
            }}
            onCambiarPassword={() => {
              setModalPassword(modalDetalle)
              setModalDetalle(null)
            }}
            onEliminar={() => {
              setModalEliminar(modalDetalle)
              setModalDetalle(null)
            }}
            onToggleActivo={async () => {
              if (!modalDetalle) return
              const { error: err } = await setActivo(modalDetalle.id, !modalDetalle.activo)
              if (err) {
                toast.error('No se pudo actualizar.')
                return
              }
              toast.success(modalDetalle.activo ? 'Usuario desactivado' : 'Usuario activado')
              setModalDetalle({ ...modalDetalle, activo: !modalDetalle.activo })
              refetch()
            }}
          />

          <EditarUsuarioModal
            usuario={modalEditar}
            onCerrar={() => setModalEditar(null)}
            onGuardado={() => {
              setModalEditar(null)
              refetch()
            }}
            editar={editar}
          />

          <CambiarPasswordModal
            usuario={modalPassword}
            onCerrar={() => setModalPassword(null)}
            cambiarPassword={cambiarPassword}
          />

          <ConfirmModal
            abierto={modalEliminar !== null}
            titulo="Eliminar usuario"
            mensaje={
              <>
                Se va a eliminar a <strong>{modalEliminar?.nombre}</strong> ({modalEliminar?.email}).
                Esta accion no se puede deshacer.
              </>
            }
            onCancelar={() => setModalEliminar(null)}
            onConfirmar={async () => {
              if (!modalEliminar) return
              const { error: err } = await eliminar(modalEliminar.id)
              if (err) toast.error(err)
              else {
                toast.success('Usuario eliminado')
                refetch()
              }
              setModalEliminar(null)
            }}
          />
        </>
      )}
    </div>
  )
}

function NuevoUsuarioModal({
  abierto,
  empresaId,
  onCerrar,
  onCreado,
  crear,
}: {
  abierto: boolean
  empresaId: string
  onCerrar: () => void
  onCreado: () => void
  crear: ReturnType<typeof useUsuarios>['crear']
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (abierto) {
      setNombre('')
      setEmail('')
      setPassword('')
      setError(null)
    }
  }, [abierto])

  async function onGuardar() {
    if (!nombre.trim() || !email.trim() || !password) {
      setError('Completa todos los campos.')
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err } = await crear({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      email: email.trim(),
      password,
      rol: 'usuario',
    })
    setGuardando(false)
    if (err) setError(err)
    else {
      toast.success('Usuario creado')
      onCreado()
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Nuevo usuario"
      onCerrar={onCerrar}
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre *">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" autoFocus />
        </Field>
        <Field label="Email *" hint="No repitas tu propio email: cada cuenta necesita uno distinto.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Contrasena *" hint="Minimo 8 caracteres">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

function UsuarioDetalleModal({
  usuario,
  onCerrar,
  onEditar,
  onCambiarPassword,
  onEliminar,
  onToggleActivo,
}: {
  usuario: Usuario | null
  onCerrar: () => void
  onEditar: () => void
  onCambiarPassword: () => void
  onEliminar: () => void
  onToggleActivo: () => void
}) {
  if (!usuario) return null

  return (
    <Modal
      abierto={usuario !== null}
      titulo="Detalle de usuario"
      onCerrar={onCerrar}
      ancho="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onEliminar}>
            <Trash2 className="text-destructive" /> Eliminar
          </Button>
          <Button variant="outline" onClick={onCambiarPassword}>
            <KeyRound /> Contrasena
          </Button>
          <Button onClick={onEditar}>
            <Pencil /> Editar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{usuario.nombre}</h2>
            <p className="text-sm text-muted-foreground">{usuario.email}</p>
          </div>
          <button onClick={onToggleActivo}>
            <Badge tono={usuario.activo ? 'success' : 'neutral'}>{usuario.activo ? 'Activo' : 'Inactivo'}</Badge>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Rol</p>
            <p className="text-foreground">{ROL_LABEL[usuario.rol]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Alta</p>
            <p className="text-foreground">{formatFecha(usuario.created_at)}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Tocá el estado para {usuario.activo ? 'desactivarlo' : 'activarlo'}.
        </p>
      </div>
    </Modal>
  )
}

function EditarUsuarioModal({
  usuario,
  onCerrar,
  onGuardado,
  editar,
}: {
  usuario: Usuario | null
  onCerrar: () => void
  onGuardado: () => void
  editar: ReturnType<typeof useUsuarios>['editar']
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    setNombre(usuario.nombre)
    setEmail(usuario.email)
    setError(null)
  }, [usuario])

  async function onGuardar() {
    if (!usuario) return
    if (!nombre.trim() || !email.trim()) {
      setError('Completa todos los campos.')
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err } = await editar({
      id: usuario.id,
      nombre: nombre.trim(),
      email: email.trim(),
      rol: 'usuario',
    })
    setGuardando(false)
    if (err) setError(err)
    else {
      toast.success('Usuario actualizado')
      onGuardado()
    }
  }

  return (
    <Modal
      abierto={usuario !== null}
      titulo={`Editar usuario — ${usuario?.nombre ?? ''}`}
      onCerrar={onCerrar}
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre *">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Field>
        <Field label="Email *" hint="Es el email con el que inicia sesion: cambiarlo cambia su login.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

function CambiarPasswordModal({
  usuario,
  onCerrar,
  cambiarPassword,
}: {
  usuario: Usuario | null
  onCerrar: () => void
  cambiarPassword: ReturnType<typeof useUsuarios>['cambiarPassword']
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setPassword('')
    setError(null)
  }, [usuario])

  async function onGuardar() {
    if (!usuario) return
    if (password.length < 8) {
      setError('Minimo 8 caracteres.')
      return
    }
    setGuardando(true)
    const { error: err } = await cambiarPassword(usuario.id, password)
    setGuardando(false)
    if (err) setError(err)
    else {
      toast.success('Contrasena actualizada')
      onCerrar()
    }
  }

  return (
    <Modal
      abierto={usuario !== null}
      titulo={`Cambiar contrasena — ${usuario?.nombre ?? ''}`}
      onCerrar={onCerrar}
      ancho="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Cambiar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nueva contrasena" hint="Minimo 8 caracteres">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}
