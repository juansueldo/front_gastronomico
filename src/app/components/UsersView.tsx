import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Shield, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { createUser, deleteUser, listUsers, updateUser, type AppUser, type CreateUserRequest, type UpdateUserRequest } from '../features/users';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/components/dialog';
import { Input } from '../shared/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/components/select';
import { type DataTableColumn, RemoteDataTable, createRowActionsColumn } from '../shared/ui/components/data-table';
import { listHeadquarters, type Headquarter } from '../features/headquarters';
import { Avatar, AvatarFallback, AvatarImage } from '../shared/ui/components/avatar';
import { DeleteConfirmDialog } from '../shared/ui/components/delete-confirm-dialog';

const roleOptions = ['admin', 'manager', 'supervisor', 'user', 'agent'];
const WIDE_DIALOG_CONTENT_CLASS =
  'max-h-[90vh] w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] gap-0 overflow-visible p-0 sm:w-[70vw] sm:!max-w-[70vw]';
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';

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

function getUserInitials(user: AppUser) {
  const source = getUserDisplayName(user);
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'US';
}

function getUserAvatarUrl(user: AppUser) {
  return user.profileImageUrl ?? user.profile_image_url ?? null;
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
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

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

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await deleteUser(userToDelete.id);
      toast.success('Usuario eliminado');
      setReloadKey((current) => current + 1);
      setUserToDelete(null);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'No se pudo eliminar el usuario';
      toast.error(message);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const columns = useMemo<DataTableColumn<AppUser>[]>(() => [
    {
      key: 'username',
      header: 'Usuario',
      accessor: (user) => user.username,
      sortable: true,
      className: 'text-white',
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0 border border-orange-700/60">
            {getUserAvatarUrl(user) ? (
              <AvatarImage src={getUserAvatarUrl(user) ?? ''} alt={getUserDisplayName(user)} />
            ) : null}
            <AvatarFallback className="bg-orange-500 text-xs font-semibold text-white">
              {getUserInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{getUserDisplayName(user)}</p>
            <p className="truncate text-xs text-gray-400">@{user.username}</p>
          </div>
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
        onClick: setUserToDelete,
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
    if (saving) {
      return;
    }

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
    <div className="h-full overflow-y-auto">
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
        <DialogContent className={WIDE_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <UserRound size={18} />
            </div>
            <DialogTitle>{editingUserId ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
            <DialogDescription>
              {editingUserId ? 'Actualiza los datos y permisos del usuario.' : 'Crea un usuario y asignale una sede y rol.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(90vh-150px)] space-y-3 overflow-y-auto px-5 py-4">
            {error ? (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="Usuario *"
                value={form.username}
                onChange={(event) => handleFieldChange('username', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="Nombre"
                value={form.firstname}
                onChange={(event) => handleFieldChange('firstname', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
              <Input
                placeholder="Apellido"
                value={form.lastname}
                onChange={(event) => handleFieldChange('lastname', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                value={form.headquarterId}
                onValueChange={(value) => handleFieldChange('headquarterId', value)}
              >
                <SelectTrigger className={FORM_CONTROL_CLASS}>
                  <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Sede *'} />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
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
                <SelectTrigger className={FORM_CONTROL_CLASS}>
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
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
                className={FORM_CONTROL_CLASS}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button disabled={saving} onClick={() => void handleSaveUser()}>
              {saving ? 'Guardando...' : editingUserId ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
        itemLabel="Usuario"
        itemName={userToDelete ? getUserDisplayName(userToDelete) : ''}
        itemIcon={userToDelete && getUserAvatarUrl(userToDelete) ? (
          <img
            src={getUserAvatarUrl(userToDelete) ?? ''}
            alt={getUserDisplayName(userToDelete)}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <UserRound size={24} className="text-[var(--primary)]" />
        )}
        loading={isDeletingUser}
        onConfirm={confirmDeleteUser}
      />
    </div>
  );
}
