import { ArrowLeft, KeyRound, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConsumoIA } from '@/components/admin/ConsumoIA'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { useEmpresas } from '@/hooks/useEmpresas'
import { useUsuarios } from '@/hooks/useUsuarios'
import type { Empresa, EmpresaUpdate, Usuario } from '@/lib/database.types'
import { formatFecha, formatRuc } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const ROL_LABEL: Record<Usuario['rol'], string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  usuario: 'Usuario',
}

export default function EmpresaDetalle() {
  const { id } = useParams<{ id: string }>()
  const { actualizar: actualizarEmpresa } = useEmpresas()
  const {
    data: usuarios,
    loading: cargandoUsuarios,
    error: errorUsuarios,
    refetch: refetchUsuarios,
    crear,
    editar,
    eliminar,
    cambiarPassword,
    setActivo,
  } = useUsuarios(id)

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [cargandoEmpresa, setCargandoEmpresa] = useState(true)

  const [modalUsuario, setModalUsuario] = useState(false)
  const [modalDetalleUsuario, setModalDetalleUsuario] = useState<Usuario | null>(null)
  const [modalEditarUsuario, setModalEditarUsuario] = useState<Usuario | null>(null)
  const [modalPassword, setModalPassword] = useState<Usuario | null>(null)
  const [modalEliminar, setModalEliminar] = useState<Usuario | null>(null)
  const [modalEditarEmpresa, setModalEditarEmpresa] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelado = false
    setCargandoEmpresa(true)
    supabase
      .from('empresas')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) {
          setEmpresa((data as Empresa) ?? null)
          setCargandoEmpresa(false)
        }
      })
    return () => {
      cancelado = true
    }
  }, [id])

  async function alternarActivoEmpresa() {
    if (!empresa) return
    const { error } = await actualizarEmpresa(empresa.id, { activo: !empresa.activo })
    if (error) {
      toast.error('No se pudo actualizar el estudio.')
      return
    }
    setEmpresa({ ...empresa, activo: !empresa.activo })
    toast.success(empresa.activo ? 'Estudio desactivado' : 'Estudio activado')
  }

  if (cargandoEmpresa) return <Cargando />
  if (!empresa) return <ErrorBox mensaje="No se encontro el estudio." />

  return (
    <div>
      <Link
        to="/admindrpcs"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Estudios
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">{empresa.nombre}</h1>
            <Badge tono={empresa.activo ? 'success' : 'neutral'}>
              {empresa.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            RUC {formatRuc(empresa.ruc)} · Creado {formatFecha(empresa.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalEditarEmpresa(true)}>
            <Pencil /> Editar
          </Button>
          <Button variant="outline" onClick={alternarActivoEmpresa}>
            {empresa.activo ? 'Desactivar estudio' : 'Activar estudio'}
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <ConsumoIA
          empresaId={empresa.id}
          limiteTokensMensual={empresa.limite_tokens_mensual}
          onCambiarLimite={async (limite) => {
            const { error: err } = await actualizarEmpresa(empresa.id, { limite_tokens_mensual: limite })
            if (!err) setEmpresa({ ...empresa, limite_tokens_mensual: limite })
            return { error: err }
          }}
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Usuarios</h2>
        <Button size="sm" onClick={() => setModalUsuario(true)}>
          <Plus /> Nuevo usuario
        </Button>
      </div>

      {cargandoUsuarios ? (
        <Cargando />
      ) : errorUsuarios ? (
        <ErrorBox mensaje={errorUsuarios} />
      ) : usuarios.length === 0 ? (
        <Vacio
          icono={UserRound}
          titulo="Este estudio no tiene usuarios"
          descripcion="Crea el primer usuario para que puedan entrar a la app."
        />
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
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setModalDetalleUsuario(u)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">{u.nombre}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{ROL_LABEL[u.rol]}</td>
                  <td className="px-4 py-2.5">
                    <Badge tono={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditarEmpresaModal
        abierto={modalEditarEmpresa}
        empresa={empresa}
        onCerrar={() => setModalEditarEmpresa(false)}
        onGuardado={(cambios) => {
          setEmpresa({ ...empresa, ...cambios })
          setModalEditarEmpresa(false)
        }}
        actualizar={actualizarEmpresa}
      />

      <NuevoUsuarioModal
        abierto={modalUsuario}
        empresaId={empresa.id}
        onCerrar={() => setModalUsuario(false)}
        onCreado={() => {
          setModalUsuario(false)
          refetchUsuarios()
        }}
        crear={crear}
      />

      <UsuarioDetalleModal
        usuario={modalDetalleUsuario}
        onCerrar={() => setModalDetalleUsuario(null)}
        onEditar={() => {
          setModalEditarUsuario(modalDetalleUsuario)
          setModalDetalleUsuario(null)
        }}
        onCambiarPassword={() => {
          setModalPassword(modalDetalleUsuario)
          setModalDetalleUsuario(null)
        }}
        onEliminar={() => {
          setModalEliminar(modalDetalleUsuario)
          setModalDetalleUsuario(null)
        }}
        onToggleActivo={async () => {
          if (!modalDetalleUsuario) return
          const { error } = await setActivo(modalDetalleUsuario.id, !modalDetalleUsuario.activo)
          if (error) {
            toast.error('No se pudo actualizar.')
            return
          }
          toast.success(modalDetalleUsuario.activo ? 'Usuario desactivado' : 'Usuario activado')
          setModalDetalleUsuario({ ...modalDetalleUsuario, activo: !modalDetalleUsuario.activo })
          refetchUsuarios()
        }}
      />

      <EditarUsuarioModal
        usuario={modalEditarUsuario}
        onCerrar={() => setModalEditarUsuario(null)}
        onGuardado={() => {
          setModalEditarUsuario(null)
          refetchUsuarios()
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
          const { error } = await eliminar(modalEliminar.id)
          if (error) toast.error(error)
          else {
            toast.success('Usuario eliminado')
            refetchUsuarios()
          }
          setModalEliminar(null)
        }}
      />
    </div>
  )
}

function EditarEmpresaModal({
  abierto,
  empresa,
  onCerrar,
  onGuardado,
  actualizar,
}: {
  abierto: boolean
  empresa: Empresa
  onCerrar: () => void
  onGuardado: (cambios: EmpresaUpdate) => void
  actualizar: ReturnType<typeof useEmpresas>['actualizar']
}) {
  const [nombre, setNombre] = useState('')
  const [ruc, setRuc] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(empresa.nombre)
    setRuc(empresa.ruc ?? '')
    setEmail(empresa.email ?? '')
    setTelefono(empresa.telefono ?? '')
    setDireccion(empresa.direccion ?? '')
    setError(null)
  }, [abierto, empresa])

  async function onGuardar() {
    if (!nombre.trim()) {
      setError('El nombre del estudio es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    const cambios: EmpresaUpdate = {
      nombre: nombre.trim(),
      ruc: ruc.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      direccion: direccion.trim() || null,
    }
    const { error: err } = await actualizar(empresa.id, cambios)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    toast.success('Estudio actualizado')
    onGuardado(cambios)
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Editar estudio"
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
        <Field label="Nombre del estudio *">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Field>
        <Field label="RUC">
          <Input value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="80012345-6" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Telefono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Field>
        </div>
        <Field label="Direccion">
          <Textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={2} />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
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
  const [rol, setRol] = useState<'admin' | 'usuario'>('usuario')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (abierto) {
      setNombre('')
      setEmail('')
      setPassword('')
      setRol('usuario')
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
      rol,
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
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field label="Email *" hint="No repitas tu propio email: cada cuenta necesita uno distinto.">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Contrasena *" hint="Minimo 8 caracteres">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Rol">
          <Select value={rol} onChange={(e) => setRol(e.target.value as 'admin' | 'usuario')}>
            <option value="usuario">Usuario</option>
            <option value="admin">Admin</option>
          </Select>
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
            <Badge tono={usuario.activo ? 'success' : 'neutral'}>
              {usuario.activo ? 'Activo' : 'Inactivo'}
            </Badge>
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
  const [rol, setRol] = useState<'admin' | 'usuario'>('usuario')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    setNombre(usuario.nombre)
    setEmail(usuario.email)
    setRol(usuario.rol === 'admin' ? 'admin' : 'usuario')
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
      rol,
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
        <Field label="Rol">
          <Select value={rol} onChange={(e) => setRol(e.target.value as 'admin' | 'usuario')}>
            <option value="usuario">Usuario</option>
            <option value="admin">Admin</option>
          </Select>
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
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}
