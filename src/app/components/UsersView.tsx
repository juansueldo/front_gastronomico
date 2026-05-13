import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Shield, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createUser, deleteUser, listUsers, updateUser, type AppUser, type CreateUserRequest, type UpdateUserRequest } from '../api/user';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { type DataTableColumn, RemoteDataTable, createRowActionsColumn } from './ui/data-table';
import { listHeadquarters, type Headquarter } from '../api/headquarter';

const roleOptions = ['admin', 'manager', 'supervisor', 'user', 'agent'];

type UserFormState = {
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  roleId?: number;
  headquarterId: string;
  password: string;
};

const emptyForm: UserFormState = {
  username: '',
  firstname: '',
  lastname: '',
  email: '',
  role: 'user',
  headquarterId: '',
  password: '',
};

function getUserDisplayName(user: AppUser) {
  const fullName = `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim();
  return fullName || user.username;
}

export function UsersView() {
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [roleIdByName, setRoleIdByName] = useState<Record<string, number>>({});
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [isLoadingHeadquarters, setIsLoadingHeadquarters] = useState(false);

  const loadUsers = useCallback(({ page, pageSize, search, sort }: {
    page: number;
    pageSize: number;
    search: string;
    sort: { key: string; direction: 'asc' | 'desc' } | null;
  }) => {
    return listUsers({ page, pageSize, search, sort }).then((result) => {
      setRoleIdByName((current) => {
        const next = { ...current };
        result.rows.forEach((user) => {
          if (user.role && user.roleId) {
            next[user.role] = user.roleId;
          }
        });
        return next;
      });
      return result;
    });
  }, []);

  const resetForm = () => {
    setError(null);
    setEditingUserId(null);
    setForm(emptyForm);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: AppUser) => {
    setError(null);
    setEditingUserId(user.id);
    setForm({
      username: user.username,
      firstname: user.firstname ?? '',
      lastname: user.lastname ?? '',
      email: user.email ?? '',
      role: user.role ?? 'user',
      roleId: user.roleId,
      headquarterId: user.headquarterId ? String(user.headquarterId) : '',
      password: '',
    });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    const loadHeadquarters = async () => {
      setIsLoadingHeadquarters(true);
      try {
        const result = await listHeadquarters({ page: 1, pageSize: 100 });
        setHeadquarters(result.rows ?? []);
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : 'No se pudieron cargar las sedes';
        toast.error(message);
      } finally {
        setIsLoadingHeadquarters(false);
      }
    };

    void loadHeadquarters();
  }, []);

  const availableRoleOptions = useMemo(() => {
    const candidateRoles = [
      ...roleOptions,
      ...Object.keys(roleIdByName),
      form.role,
    ]
      .map((role) => String(role ?? '').trim().toLowerCase())
      .filter((role) => role.length > 0);

    return Array.from(new Set(candidateRoles));
  }, [form.role, roleIdByName]);

  const columns = useMemo<DataTableColumn<AppUser>[]>(() => [
    {
      key: 'username',
      header: 'Usuario',
      accessor: (user) => user.username,
      sortable: true,
      className: 'text-white',
      cell: (user) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-orange-400" />
            <span className="truncate font-medium text-white">{getUserDisplayName(user)}</span>
          </div>
          <p className="truncate text-xs text-gray-400">@{user.username}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (user) => user.email ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (user) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-500" />
          <span>{user.email ?? 'Sin email'}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      accessor: (user) => user.role ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (user) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-500" />
          <span>{user.role ?? 'Sin rol'}</span>
        </div>
      ),
    },
    {
      key: 'headquarterName',
      header: 'Sede',
      accessor: (user) => user.headquarterName ?? (user.headquarterId ? `Sede #${user.headquarterId}` : ''),
      sortable: true,
      className: 'text-gray-300',
      cell: (user) => (
        <span>{user.headquarterName ?? (user.headquarterId ? `Sede #${user.headquarterId}` : 'Sin sede')}</span>
      ),
    },
    createRowActionsColumn<AppUser>({
      editAction: {
        label: 'Editar',
        onClick: openEditDialog,
      },
      deleteAction: {
        label: 'Eliminar',
        onClick: async (user) => {
          const confirmed = window.confirm(`¿Eliminar el usuario "${user.username}"?`);
          if (!confirmed) {
            return;
          }

          try {
            await deleteUser(user.id);
            toast.success('Usuario eliminado');
            setReloadKey((current) => current + 1);
          } catch (nextError) {
            const message = nextError instanceof Error ? nextError.message : 'No se pudo eliminar el usuario';
            toast.error(message);
          }
        },
      },
      extraActions: [
        {
          label: 'Ver detalle',
          onClick: (user) => {
            toast.info(`Usuario: ${getUserDisplayName(user)} (${user.role ?? 'sin rol'})`);
          },
        },
      ],
    }),
  ], []);

  const handleFieldChange = (field: keyof UserFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);

    if (!open) {
      resetForm();
    }
  };

  const handleSaveUser = async () => {
    const username = form.username.trim();
    const firstname = form.firstname.trim();
    const lastname = form.lastname.trim();
    const email = form.email.trim();
    const role = form.role.trim().toLowerCase();
    const resolvedRoleId = form.roleId ?? roleIdByName[role];
    const parsedHeadquarterId = Number(form.headquarterId);
    const resolvedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
      ? parsedHeadquarterId
      : null;
    const password = form.password.trim();

    if (!username) {
      setError('Ingresá un nombre de usuario');
      return;
    }

    if (!editingUserId && !password) {
      setError('Ingresá una contraseña para crear el usuario');
      return;
    }

    if (!resolvedHeadquarterId) {
      setError('Seleccioná una sede para el usuario');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingUserId) {
        const payload: UpdateUserRequest = {
          username,
          firstname: firstname || undefined,
          lastname: lastname || undefined,
          email: email || undefined,
          role: role || undefined,
          roleId: resolvedRoleId,
          headquarterId: resolvedHeadquarterId,
        };

        if (password) {
          payload.password = password;
        }

        await updateUser(editingUserId, payload);
        toast.success('Usuario actualizado correctamente');
      } else {
        const payload: CreateUserRequest = {
          username,
          password,
          firstname: firstname || undefined,
          lastname: lastname || undefined,
          email: email || undefined,
          role: role || undefined,
          roleId: resolvedRoleId,
          headquarterId: resolvedHeadquarterId,
        };

        await createUser(payload);
        toast.success('Usuario creado correctamente');
      }

      resetForm();
      setIsDialogOpen(false);
      setReloadKey((current) => current + 1);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'No se pudo guardar el usuario';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-white md:text-2xl">Usuarios</h1>
            <p className="text-sm text-gray-400">Gestiona los usuarios del sistema y sus roles.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-secondary text-white">
              Administración de usuarios
            </Badge>
            <Button size="sm" onClick={openCreateDialog}>
              Nuevo usuario
            </Button>
          </div>
        </div>

        <div className="card bg-card p-4">
          <RemoteDataTable
            columns={columns}
            getRowId={(user) => user.id}
            emptyMessage="No hay usuarios registrados"
            searchPlaceholder="Buscar por usuario, nombre, email o rol"
            defaultPageSize={10}
            pageSizeOptions={[10, 20, 50]}
            reloadKey={reloadKey}
            loadData={loadUsers}
          />
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="card bg-card text-white">
          <DialogHeader>
            <DialogTitle>{editingUserId ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {error ? (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="Usuario *"
                value={form.username}
                onChange={(event) => handleFieldChange('username', event.target.value)}
              />
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="Nombre"
                value={form.firstname}
                onChange={(event) => handleFieldChange('firstname', event.target.value)}
              />
              <Input
                placeholder="Apellido"
                value={form.lastname}
                onChange={(event) => handleFieldChange('lastname', event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                value={form.headquarterId}
                onValueChange={(value) => handleFieldChange('headquarterId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Sede *'} />
                </SelectTrigger>
                <SelectContent>
                  {headquarters.map((headquarter) => (
                    <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                      {headquarter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={form.role}
                onValueChange={(value) => {
                  const normalizedRole = value.trim().toLowerCase();
                  setForm((current) => ({
                    ...current,
                    role: normalizedRole,
                    roleId: roleIdByName[normalizedRole],
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoleOptions.map((roleOption) => (
                    <SelectItem key={roleOption} value={roleOption}>
                      {roleOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

                <Input
                  placeholder={editingUserId ? 'Nueva contraseña (opcional)' : 'Contraseña *'}
                  type="password"
                value={form.password}
                onChange={(event) => handleFieldChange('password', event.target.value)}
              />
            </div>

            <Button className="w-full" disabled={saving} onClick={() => void handleSaveUser()}>
              {saving ? 'Guardando...' : editingUserId ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
