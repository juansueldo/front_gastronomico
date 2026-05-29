import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CircleSlash, DollarSign, IdCard, Mail, Phone, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  createWaiter,
  deleteWaiter,
  listWaiters,
  updateWaiter,
  updateWaiterStatus,
  type CreateWaiterRequest,
  type UpdateWaiterRequest,
  type Waiter,
} from '../features/waiters';
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
import { DeleteConfirmDialog } from '../shared/ui/components/delete-confirm-dialog';
import { listHeadquarters, type Headquarter } from '../features/headquarters';

const WIDE_DIALOG_CONTENT_CLASS =
  'max-h-[90vh] w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] gap-0 overflow-visible p-0 sm:w-[62vw] sm:!max-w-[62vw]';
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';

type WaiterFormState = {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  identification: string;
  salary: string;
  hireDate: string;
  headquarterId: string;
};

const emptyForm: WaiterFormState = {
  firstname: '',
  lastname: '',
  email: '',
  phone: '',
  identification: '',
  salary: '',
  hireDate: '',
  headquarterId: '',
};

function getWaiterDisplayName(waiter: Waiter) {
  return `${waiter.firstname ?? ''} ${waiter.lastname ?? ''}`.trim() || 'Mozo sin nombre';
}

function getWaiterInitials(waiter: Waiter) {
  return getWaiterDisplayName(waiter)
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'MZ';
}

function isWaiterActive(waiter: Waiter) {
  const statusName = waiter.statusName?.trim().toLowerCase();
  if (statusName) return !['inactivo', 'inactive', 'baja'].includes(statusName);
  return waiter.statusId !== 2;
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return 'Sin sueldo';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function WaitersView() {
  const [form, setForm] = useState<WaiterFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWaiterId, setEditingWaiterId] = useState<string | null>(null);
  const [waiterToDelete, setWaiterToDelete] = useState<Waiter | null>(null);
  const [isDeletingWaiter, setIsDeletingWaiter] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [isLoadingHeadquarters, setIsLoadingHeadquarters] = useState(false);

  const loadWaiters = useCallback(({ page, pageSize, search, sort }: {
    page: number;
    pageSize: number;
    search: string;
    sort: { key: string; direction: 'asc' | 'desc' } | null;
  }) => listWaiters({ page, pageSize, search, sort }), []);

  const resetForm = () => {
    setError(null);
    setEditingWaiterId(null);
    setForm(emptyForm);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (waiter: Waiter) => {
    setError(null);
    setEditingWaiterId(waiter.id);
    setForm({
      firstname: waiter.firstname ?? '',
      lastname: waiter.lastname ?? '',
      email: waiter.email ?? '',
      phone: waiter.phone ?? '',
      identification: waiter.identification ?? '',
      salary: waiter.salary === null || waiter.salary === undefined ? '' : String(waiter.salary),
      hireDate: waiter.hireDate ? waiter.hireDate.slice(0, 10) : '',
      headquarterId: waiter.headquarterId ? String(waiter.headquarterId) : '',
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

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) resetForm();
  };

  const handleFieldChange = (field: keyof WaiterFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const confirmDeleteWaiter = async () => {
    if (!waiterToDelete) return;
    setIsDeletingWaiter(true);
    try {
      await deleteWaiter(waiterToDelete.id);
      toast.success('Mozo eliminado');
      setReloadKey((current) => current + 1);
      setWaiterToDelete(null);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'No se pudo eliminar el mozo';
      toast.error(message);
    } finally {
      setIsDeletingWaiter(false);
    }
  };

  const handleToggleStatus = async (waiter: Waiter) => {
    setStatusUpdatingId(waiter.id);
    try {
      await updateWaiterStatus(waiter.id, isWaiterActive(waiter) ? 2 : 1);
      toast.success(isWaiterActive(waiter) ? 'Mozo desactivado' : 'Mozo activado');
      setReloadKey((current) => current + 1);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'No se pudo actualizar el estado del mozo';
      toast.error(message);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const columns = useMemo<DataTableColumn<Waiter>[]>(() => [
    {
      key: 'firstname',
      header: 'Mozo',
      accessor: (waiter) => getWaiterDisplayName(waiter),
      sortable: true,
      className: 'text-white',
      cell: (waiter) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-700/60 bg-orange-500 text-xs font-semibold text-white">
            {getWaiterInitials(waiter)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{getWaiterDisplayName(waiter)}</p>
            <p className="truncate text-xs text-gray-400">{waiter.identification ? `Doc. ${waiter.identification}` : 'Sin documento'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contacto',
      accessor: (waiter) => `${waiter.email ?? ''} ${waiter.phone ?? ''}`,
      sortable: true,
      className: 'text-gray-300',
      cell: (waiter) => (
        <div className="grid gap-1 text-sm">
          <span className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-500" />
            {waiter.email ?? 'Sin email'}
          </span>
          <span className="flex items-center gap-2 text-xs text-gray-400">
            <Phone className="h-3.5 w-3.5 text-gray-500" />
            {waiter.phone ?? 'Sin telefono'}
          </span>
        </div>
      ),
    },
    {
      key: 'headquarterName',
      header: 'Sede',
      accessor: (waiter) => waiter.headquarterName ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (waiter) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{waiter.headquarterName ?? 'Sin sede'}</p>
          {waiter.headquarterLocation ? (
            <p className="truncate text-xs text-gray-400">{waiter.headquarterLocation}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'hireDate',
      header: 'Ingreso',
      accessor: (waiter) => waiter.hireDate ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (waiter) => (
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gray-500" />
          {formatDate(waiter.hireDate)}
        </span>
      ),
    },
    {
      key: 'salary',
      header: 'Sueldo',
      accessor: (waiter) => waiter.salary ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (waiter) => (
        <span className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-gray-500" />
          {formatCurrency(waiter.salary)}
        </span>
      ),
    },
    {
      key: 'statusName',
      header: 'Estado',
      accessor: (waiter) => waiter.statusName ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (waiter) => (
        <Badge variant={isWaiterActive(waiter) ? 'default' : 'secondary'} className={isWaiterActive(waiter) ? 'bg-emerald-600 text-white' : 'bg-label-secondary text-white'}>
          {waiter.statusName ?? (isWaiterActive(waiter) ? 'Activo' : 'Inactivo')}
        </Badge>
      ),
    },
    createRowActionsColumn<Waiter>({
      editAction: {
        label: 'Editar',
        onClick: openEditDialog,
      },
      deleteAction: {
        label: 'Eliminar',
        onClick: setWaiterToDelete,
      },
      extraActions: [
        {
          label: 'Activar / desactivar',
          icon: CircleSlash,
          disabled: (waiter) => statusUpdatingId === waiter.id,
          onClick: (waiter) => void handleToggleStatus(waiter),
        },
      ],
    }),
  ], [statusUpdatingId]);

  const handleSaveWaiter = async () => {
    if (saving) return;

    const firstname = form.firstname.trim();
    const lastname = form.lastname.trim();
    const salaryText = form.salary.trim();
    const parsedSalary = salaryText ? Number(salaryText.replace(',', '.')) : null;
    const parsedHeadquarterId = Number(form.headquarterId);
    const resolvedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
      ? parsedHeadquarterId
      : null;

    if (!firstname) {
      setError('Ingresá el nombre del mozo');
      return;
    }

    if (!lastname) {
      setError('Ingresá el apellido del mozo');
      return;
    }

    if (salaryText && (!Number.isFinite(parsedSalary) || parsedSalary < 0)) {
      setError('Ingresá un sueldo válido');
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreateWaiterRequest | UpdateWaiterRequest = {
      firstname,
      lastname,
      email: form.email.trim(),
      phone: form.phone.trim(),
      identification: form.identification.trim(),
      salary: parsedSalary,
      hireDate: form.hireDate || '',
      headquarterId: resolvedHeadquarterId,
    };

    try {
      if (editingWaiterId) {
        await updateWaiter(editingWaiterId, payload);
        toast.success('Mozo actualizado correctamente');
      } else {
        await createWaiter(payload as CreateWaiterRequest);
        toast.success('Mozo creado correctamente');
      }

      resetForm();
      setIsDialogOpen(false);
      setReloadKey((current) => current + 1);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'No se pudo guardar el mozo';
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
            <h1 className="text-xl font-semibold text-white md:text-2xl">Mozos</h1>
            <p className="text-sm text-gray-400">Gestiona el personal de atención asociado a tu tienda.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-secondary text-white">
              Administración de mozos
            </Badge>
            <Button size="sm" onClick={openCreateDialog}>
              Nuevo mozo
            </Button>
          </div>
        </div>

        <div className="card bg-card p-4">
          <RemoteDataTable
            columns={columns}
            getRowId={(waiter) => waiter.id}
            emptyMessage="No hay mozos registrados"
            searchPlaceholder="Buscar por nombre, documento, email o telefono"
            defaultPageSize={10}
            pageSizeOptions={[10, 20, 50]}
            reloadKey={reloadKey}
            loadData={loadWaiters}
          />
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className={WIDE_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <UserRoundCheck size={18} />
            </div>
            <DialogTitle>{editingWaiterId ? 'Editar mozo' : 'Nuevo mozo'}</DialogTitle>
            <DialogDescription>
              {editingWaiterId ? 'Actualiza los datos del mozo.' : 'Crea un mozo para operar mesas y pedidos.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(90vh-150px)] space-y-3 overflow-y-auto px-5 py-4">
            {error ? (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="Nombre *"
                value={form.firstname}
                onChange={(event) => handleFieldChange('firstname', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
              <Input
                placeholder="Apellido *"
                value={form.lastname}
                onChange={(event) => handleFieldChange('lastname', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
              <Input
                placeholder="Telefono"
                value={form.phone}
                onChange={(event) => handleFieldChange('phone', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Select
                value={form.headquarterId}
                onValueChange={(value) => handleFieldChange('headquarterId', value)}
              >
                <SelectTrigger className={FORM_CONTROL_CLASS}>
                  <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Sede'} />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {headquarters.map((headquarter) => (
                    <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                      {headquarter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative">
                <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
                <Input
                  placeholder="Documento"
                  value={form.identification}
                  onChange={(event) => handleFieldChange('identification', event.target.value)}
                  className={`${FORM_CONTROL_CLASS} pl-9`}
                />
              </div>
              <Input
                placeholder="Sueldo"
                inputMode="decimal"
                value={form.salary}
                onChange={(event) => handleFieldChange('salary', event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
              <Input
                type="date"
                value={form.hireDate}
                onChange={(event) => handleFieldChange('hireDate', event.target.value)}
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
            <Button disabled={saving} onClick={() => void handleSaveWaiter()}>
              {saving ? 'Guardando...' : editingWaiterId ? 'Guardar cambios' : 'Crear mozo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(waiterToDelete)}
        onOpenChange={(open) => {
          if (!open) setWaiterToDelete(null);
        }}
        itemLabel="Mozo"
        itemName={waiterToDelete ? getWaiterDisplayName(waiterToDelete) : ''}
        itemIcon={<UserRoundCheck size={24} className="text-[var(--primary)]" />}
        loading={isDeletingWaiter}
        onConfirm={confirmDeleteWaiter}
      />
    </div>
  );
}
