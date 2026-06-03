import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Bike, ClipboardCopy, KeyRound, Pencil, Plus, Trash2, UserRoundCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ApiError } from '../core/http/errors';
import {
  createDeliveryDriver,
  deleteDeliveryDriver,
  listDeliveryDrivers,
  regenerateDeliveryDriverInvite,
  updateDeliveryDriver,
  type CreateDriverInput,
  type DeliveryDriver,
  type DriverStatus,
  type VehicleType,
} from '../features/delivery-logistics';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import {
  type DataTableColumn,
  type RemoteDataTableQuery,
  RemoteDataTable,
  createRowActionsColumn,
} from '../shared/ui/components/data-table';
import { DeleteConfirmDialog } from '../shared/ui/components/delete-confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/components/dialog';
import { Input } from '../shared/ui/components/input';
import { Label } from '../shared/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/components/select';
import { Textarea } from '../shared/ui/components/textarea';

const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';
const DIALOG_CONTENT_CLASS = 'w-[calc(100vw-2rem)] max-w-[640px] gap-0 overflow-visible p-0';

const vehicleLabels: Record<VehicleType, string> = {
  motorcycle: 'Moto',
  bicycle: 'Bicicleta',
  car: 'Auto',
  other: 'Otro',
};

const statusLabels: Record<DriverStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  busy: 'En reparto',
};

const statusBadgeClasses: Record<DriverStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  busy: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
};

type DriverFormState = {
  name: string;
  phone: string;
  vehicleType: VehicleType;
  plate: string;
  status: DriverStatus;
  notes: string;
};

const emptyForm: DriverFormState = {
  name: '',
  phone: '',
  vehicleType: 'motorcycle',
  plate: '',
  status: 'active',
  notes: '',
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return fallback;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'RP';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function buildDriverPayload(form: DriverFormState): CreateDriverInput {
  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    vehicleType: form.vehicleType,
    plate: form.plate.trim(),
    status: form.status,
    notes: form.notes.trim(),
  };
}

function paginateDrivers(drivers: DeliveryDriver[], query: RemoteDataTableQuery) {
  const search = query.search.trim().toLowerCase();
  const filtered = search
    ? drivers.filter((driver) => [
      driver.id,
      driver.name,
      driver.phone,
      vehicleLabels[driver.vehicleType],
      driver.plate,
      statusLabels[driver.status],
      driver.notes,
    ].some((value) => String(value ?? '').toLowerCase().includes(search)))
    : drivers;

  const sorted = query.sort
    ? [...filtered].sort((left, right) => {
      const leftValue = String((left as Record<string, unknown>)[query.sort!.key] ?? '').toLowerCase();
      const rightValue = String((right as Record<string, unknown>)[query.sort!.key] ?? '').toLowerCase();
      const factor = query.sort!.direction === 'asc' ? 1 : -1;
      return leftValue.localeCompare(rightValue) * factor;
    })
    : filtered;

  const start = (query.page - 1) * query.pageSize;
  return {
    rows: sorted.slice(start, start + query.pageSize),
    total: sorted.length,
  };
}

export function DeliveryDriversView() {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<DeliveryDriver | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<{
    driver: DeliveryDriver;
    inviteCode: string;
    inviteCodeExpiresAt?: string | null;
  } | null>(null);
  const [form, setForm] = useState<DriverFormState>(emptyForm);

  const loadDrivers = useCallback(async (query: RemoteDataTableQuery) => {
    const drivers = await listDeliveryDrivers();
    return paginateDrivers(drivers, query);
  }, []);

  const openCreateDialog = () => {
    setEditingDriver(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (driver: DeliveryDriver) => {
    setEditingDriver(driver);
    setForm({
      name: driver.name ?? '',
      phone: driver.phone ?? '',
      vehicleType: driver.vehicleType ?? 'motorcycle',
      plate: driver.plate ?? '',
      status: driver.status ?? 'active',
      notes: driver.notes ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleSaveDriver = async () => {
    if (!form.name.trim()) {
      toast.error('Ingresá el nombre del repartidor');
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildDriverPayload(form);
      if (editingDriver) {
        await updateDeliveryDriver(editingDriver.id, payload);
        toast.success('Repartidor actualizado');
      } else {
        await createDeliveryDriver(payload);
        toast.success('Repartidor creado');
      }

      setIsDialogOpen(false);
      setEditingDriver(null);
      setForm(emptyForm);
      setReloadKey((current) => current + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, editingDriver ? 'No se pudo actualizar el repartidor' : 'No se pudo crear el repartidor'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDriver = async () => {
    if (!driverToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDeliveryDriver(driverToDelete.id);
      toast.success('Repartidor eliminado');
      setDriverToDelete(null);
      setReloadKey((current) => current + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el repartidor'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateInvite = async (driver: DeliveryDriver) => {
    try {
      const invite = await regenerateDeliveryDriverInvite(driver.id);
      setGeneratedInvite(invite);
      toast.success('PIN generado para la app');
      setReloadKey((current) => current + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo generar el PIN'));
    }
  };

  const handleCopyInvite = async () => {
    if (!generatedInvite) return;
    const text = `Repartidor: ${generatedInvite.driver.name}\nPIN: ${generatedInvite.inviteCode}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Datos de activación copiados');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const columns = useMemo<DataTableColumn<DeliveryDriver>[]>(() => [
    {
      key: 'name',
      header: 'Repartidor',
      accessor: (driver) => driver.name,
      sortable: true,
      cell: (driver) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/15 text-sm font-bold text-[var(--primary)]">
            {getInitials(driver.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--app-strong)]">{driver.name}</p>
            <p className="truncate text-xs text-[var(--app-muted)]">#{driver.id ?? '-'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Teléfono',
      accessor: (driver) => driver.phone ?? '',
      sortable: true,
      cell: (driver) => driver.phone || '-',
    },
    {
      key: 'vehicleType',
      header: 'Vehículo',
      accessor: (driver) => vehicleLabels[driver.vehicleType] ?? driver.vehicleType,
      sortable: true,
      cell: (driver) => (
        <span className="inline-flex items-center gap-2 text-[var(--app-strong)]">
          <Bike className="h-4 w-4 text-[var(--primary)]" />
          {vehicleLabels[driver.vehicleType] ?? driver.vehicleType}
        </span>
      ),
    },
    {
      key: 'plate',
      header: 'Patente',
      accessor: (driver) => driver.plate ?? '',
      sortable: true,
      cell: (driver) => driver.plate || '-',
    },
    {
      key: 'status',
      header: 'Estado',
      accessor: (driver) => statusLabels[driver.status] ?? driver.status,
      sortable: true,
      cell: (driver) => (
        <Badge className={statusBadgeClasses[driver.status] ?? statusBadgeClasses.inactive}>
          {statusLabels[driver.status] ?? driver.status}
        </Badge>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'App',
      accessor: (driver) => driver.lastLoginAt ?? '',
      sortable: true,
      cell: (driver) => (
        <div className="text-sm">
          <p className="font-semibold text-[var(--app-strong)]">
            {driver.lastLoginAt ? 'Activada' : 'Sin activar'}
          </p>
          <p className="text-xs text-[var(--app-muted)]">
            {driver.lastLoginAt
              ? formatDateTime(driver.lastLoginAt)
              : driver.hasInviteCode || driver.inviteCodeExpiresAt
                ? 'PIN activo'
                : 'Generá un PIN'}
          </p>
        </div>
      ),
    },
    {
      key: 'notes',
      header: 'Notas',
      accessor: (driver) => driver.notes ?? '',
      cell: (driver) => (
        <span className="line-clamp-2 text-sm text-[var(--app-muted)]">{driver.notes || '-'}</span>
      ),
    },
    createRowActionsColumn<DeliveryDriver>({
      extraActions: [
        {
          label: 'Generar PIN app',
          icon: KeyRound,
          onClick: (driver) => void handleGenerateInvite(driver),
        },
        {
          label: 'Editar',
          icon: Pencil,
          onClick: openEditDialog,
        },
        {
          label: 'Eliminar',
          icon: Trash2,
          onClick: setDriverToDelete,
          variant: 'destructive',
        },
      ],
    }),
  ], []);

  return (
    <div className="min-h-full p-4 md:p-6">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate('/delivery-logistics')}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--app-muted)] transition hover:text-[var(--primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a logística
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--app-strong)]">
            <UserRoundCheck className="h-6 w-6 text-[var(--primary)]" />
            Repartidores
          </h1>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Administrá los perfiles disponibles para recorridos y comandas de delivery.
          </p>
        </div>

        <Button type="button" className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Nuevo repartidor
        </Button>
      </header>

      <div className="card bg-card p-4">
        <RemoteDataTable
          columns={columns}
          loadData={loadDrivers}
          reloadKey={reloadKey}
          getRowId={(driver) => String(driver.id)}
          emptyMessage="Todavía no hay repartidores registrados."
          searchPlaceholder="Buscar por nombre, teléfono, vehículo o patente"
          defaultPageSize={10}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open && !isSaving) {
            setEditingDriver(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className={DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <Bike size={18} />
            </div>
            <DialogTitle>{editingDriver ? 'Editar repartidor' : 'Nuevo repartidor'}</DialogTitle>
            <DialogDescription>
              {editingDriver ? 'Actualizá los datos operativos del repartidor.' : 'Creá un perfil para asignarle recorridos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ej: Juan Pérez"
                className={`mt-2 ${FORM_CONTROL_CLASS}`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Ej: 11 2345-6789"
                  className={`mt-2 ${FORM_CONTROL_CLASS}`}
                />
              </div>
              <div>
                <Label>Patente</Label>
                <Input
                  value={form.plate}
                  onChange={(event) => setForm((current) => ({ ...current, plate: event.target.value }))}
                  placeholder="Ej: A123BCD"
                  className={`mt-2 ${FORM_CONTROL_CLASS}`}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Vehículo</Label>
                <Select value={form.vehicleType} onValueChange={(value) => setForm((current) => ({ ...current, vehicleType: value as VehicleType }))}>
                  <SelectTrigger className={`mt-2 ${FORM_CONTROL_CLASS}`}>
                    <SelectValue placeholder="Seleccionar vehículo" />
                  </SelectTrigger>
                  <SelectContent className={SELECT_CONTENT_CLASS}>
                    {Object.entries(vehicleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as DriverStatus }))}>
                  <SelectTrigger className={`mt-2 ${FORM_CONTROL_CLASS}`}>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent className={SELECT_CONTENT_CLASS}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Turno, zona preferida, observaciones internas..."
                className="mt-2 min-h-24 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveDriver()} disabled={isSaving}>
              {isSaving ? 'Guardando...' : editingDriver ? 'Guardar cambios' : 'Crear repartidor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(driverToDelete)}
        onOpenChange={(open) => {
          if (!open) setDriverToDelete(null);
        }}
        itemLabel="Repartidor"
        itemName={driverToDelete?.name ?? ''}
        itemIcon={driverToDelete ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-bold text-[var(--primary)]">
            {getInitials(driverToDelete.name)}
          </span>
        ) : null}
        loading={isDeleting}
        onConfirm={handleDeleteDriver}
      />

      <Dialog open={Boolean(generatedInvite)} onOpenChange={(open) => {
        if (!open) setGeneratedInvite(null);
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[460px] gap-0 p-0">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <KeyRound size={18} />
            </div>
            <DialogTitle>PIN de app generado</DialogTitle>
            <DialogDescription>
              Compartí este PIN con el repartidor. El PIN se muestra solo ahora y no vence.
            </DialogDescription>
          </DialogHeader>
          {generatedInvite ? (
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
                <p className="text-xs font-semibold uppercase text-[var(--app-muted)]">Repartidor</p>
                <p className="mt-1 font-semibold">{generatedInvite.driver.name}</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase text-[var(--app-muted)]">PIN</p>
                  <p className="mt-1 text-2xl font-bold tracking-normal">{generatedInvite.inviteCode}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--app-muted)]">
                No vence. Para reemplazarlo, generá un PIN nuevo.
              </p>
            </div>
          ) : null}
          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
              onClick={() => void handleCopyInvite()}
            >
              <ClipboardCopy className="h-4 w-4" />
              Copiar
            </Button>
            <Button type="button" onClick={() => setGeneratedInvite(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
