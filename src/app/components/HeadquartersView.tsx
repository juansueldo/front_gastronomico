import { useCallback, useMemo, useState } from 'react';
import { Building2, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import {
  createHeadquarter,
  listHeadquarters,
  updateHeadquarter,
  updateHeadquarterSchedules,
  type CreateHeadquarterRequest,
  type Headquarter,
  type HeadquarterScheduleInput,
} from '../features/headquarters';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/components/dialog';
import { Input } from '../shared/ui/components/input';
import { Switch } from '../shared/ui/components/switch';
import { type DataTableColumn, RemoteDataTable, createRowActionsColumn } from '../shared/ui/components/data-table';
import { HeadquartersForm } from './headquarters/HeadquartersForm';

const DAY_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

type ScheduleDraft = {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

type RawHeadquarterSchedule = Partial<{
  dayOfWeek: string;
  day_of_week: string;
  openTime: string;
  open_time: string;
  closeTime: string;
  close_time: string;
  isClosed: boolean;
  is_closed: boolean;
}>;

const buildDefaultScheduleDraft = (): ScheduleDraft[] => DAY_OPTIONS.map((day) => ({
  dayOfWeek: day.key,
  openTime: '09:00',
  closeTime: '18:00',
  isClosed: false,
}));

const normalizeHeadquarterSchedules = (headquarter: Headquarter): ScheduleDraft[] => {
  const rawSchedules = Array.isArray((headquarter as Headquarter & { schedules?: unknown }).schedules)
    ? ((headquarter as Headquarter & { schedules: RawHeadquarterSchedule[] }).schedules)
    : [];

  const schedulesByDay = new Map(
    rawSchedules
      .map((schedule) => {
        const dayOfWeek = String(schedule.dayOfWeek ?? schedule.day_of_week ?? '').trim().toLowerCase();
        if (!dayOfWeek) {
          return null;
        }

        return [dayOfWeek, {
          dayOfWeek,
          openTime: String(schedule.openTime ?? schedule.open_time ?? '09:00').slice(0, 5),
          closeTime: String(schedule.closeTime ?? schedule.close_time ?? '18:00').slice(0, 5),
          isClosed: Boolean(schedule.isClosed ?? schedule.is_closed ?? false),
        } satisfies ScheduleDraft] as const;
      })
      .filter((entry): entry is readonly [string, ScheduleDraft] => entry !== null),
  );

  return DAY_OPTIONS.map((day) => schedulesByDay.get(day.key) ?? {
    dayOfWeek: day.key,
    openTime: '09:00',
    closeTime: '18:00',
    isClosed: false,
  });
};

export function HeadquartersView() {
  const [form, setForm] = useState<CreateHeadquarterRequest>({ name: '', phone: '', location: '', latitude: null, longitude: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHeadquarterId, setEditingHeadquarterId] = useState<string | null>(null);
  const [isSchedulesDialogOpen, setIsSchedulesDialogOpen] = useState(false);
  const [scheduleHeadquarter, setScheduleHeadquarter] = useState<Headquarter | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft[]>(buildDefaultScheduleDraft());
  const [isSavingSchedules, setIsSavingSchedules] = useState(false);
  const [scheduleStepIndex, setScheduleStepIndex] = useState(0);

  const loadHeadquarters = useCallback(({ page, pageSize, search, sort }: {
    page: number;
    pageSize: number;
    search: string;
    sort: { key: string; direction: 'asc' | 'desc' } | null;
  }) => {
    return listHeadquarters({ page, pageSize, search, sort });
  }, []);

  const resetForm = () => {
    setError(null);
    setEditingHeadquarterId(null);
    setForm({ name: '', phone: '', location: '', latitude: null, longitude: null });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (headquarter: Headquarter) => {
    setError(null);
    setEditingHeadquarterId(headquarter.id);
    setForm({
      name: headquarter.name,
      phone: headquarter.phone ?? '',
      location: headquarter.location ?? '',
      latitude: Number.isFinite(Number(headquarter.latitude)) ? Number(headquarter.latitude) : null,
      longitude: Number.isFinite(Number(headquarter.longitude)) ? Number(headquarter.longitude) : null,
    });
    setIsDialogOpen(true);
  };

  const openSchedulesDialog = (headquarter: Headquarter) => {
    setScheduleHeadquarter(headquarter);
    setScheduleDraft(normalizeHeadquarterSchedules(headquarter));
    setScheduleStepIndex(0);
    setIsSchedulesDialogOpen(true);
  };

  const columns = useMemo<DataTableColumn<Headquarter>[]>(() => [
    {
      key: 'name',
      header: 'Sede',
      accessor: (headquarter) => headquarter.name,
      sortable: true,
      className: 'text-white',
      cell: (headquarter) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-orange-400" />
            <span className="truncate font-medium text-white">{headquarter.name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telefono',
      accessor: (headquarter) => headquarter.phone ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (headquarter) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-500" />
          <span>{headquarter.phone ?? 'Sin telefono'}</span>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Ubicacion',
      accessor: (headquarter) => headquarter.location ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (headquarter) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span className="whitespace-normal break-words">{headquarter.location ?? 'Sin ubicacion'}</span>
        </div>
      ),
    },
    createRowActionsColumn<Headquarter>({
      editAction: {
        label: 'Editar',
        onClick: openEditDialog,
      },
      deleteAction: {
        label: 'Eliminar',
        onClick: (headquarter) => {
          toast.info(`Pendiente conectar eliminacion para ${headquarter.name}.`);
        },
      },
      extraActions: [
        {
          label: 'Configurar horarios',
          onClick: openSchedulesDialog,
        },
      ],
    }),
  ], []);

  const handleFieldChange = (field: keyof CreateHeadquarterRequest, value: string | number | null) => {
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

  const handleSaveHeadquarter = async () => {
    setSaving(true);
    setError(null);

    try {
      const normalizedLatitude = Number(form.latitude);
      const normalizedLongitude = Number(form.longitude);
      const hasValidatedAddress = Number.isFinite(normalizedLatitude) && Number.isFinite(normalizedLongitude);

      if (form.location?.trim() && !hasValidatedAddress) {
        throw new Error('Selecciona una dirección válida desde las sugerencias.');
      }

      const payload = {
        name: form.name.trim(),
        phone: form.phone?.trim() || undefined,
        location: form.location?.trim() || undefined,
        latitude: hasValidatedAddress ? normalizedLatitude : null,
        longitude: hasValidatedAddress ? normalizedLongitude : null,
      };

      if (editingHeadquarterId) {
        await updateHeadquarter(editingHeadquarterId, payload);
        toast.success('Sede actualizada correctamente');
      } else {
        await createHeadquarter(payload);
        toast.success('Sede creada correctamente');
      }

      resetForm();
      setIsDialogOpen(false);
      setReloadKey((current) => current + 1);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'No se pudo guardar la sede';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleFieldChange = (
    dayOfWeek: string,
    field: keyof Omit<ScheduleDraft, 'dayOfWeek'>,
    value: string | boolean,
  ) => {
    setScheduleDraft((current) => current.map((entry) => (
      entry.dayOfWeek === dayOfWeek
        ? {
            ...entry,
            [field]: value,
          }
        : entry
    )));
  };

  const handleSaveSchedules = async () => {
    if (!scheduleHeadquarter) {
      return;
    }

    const invalidSchedule = scheduleDraft.find((item) => !item.isClosed && (!item.openTime || !item.closeTime));
    if (invalidSchedule) {
      toast.error('Completa horario de apertura y cierre para los dias habilitados');
      return;
    }

    setIsSavingSchedules(true);

    try {
      const payload: HeadquarterScheduleInput[] = scheduleDraft.map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        openTime: schedule.openTime,
        closeTime: schedule.closeTime,
        isClosed: schedule.isClosed,
      }));

      await updateHeadquarterSchedules(scheduleHeadquarter.id, payload);
      toast.success('Horarios actualizados');
      setIsSchedulesDialogOpen(false);
      setScheduleHeadquarter(null);
      setScheduleDraft(buildDefaultScheduleDraft());
      setScheduleStepIndex(0);
      setReloadKey((current) => current + 1);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'No se pudieron guardar los horarios');
    } finally {
      setIsSavingSchedules(false);
    }
  };

  const currentScheduleStep = DAY_OPTIONS[scheduleStepIndex] ?? DAY_OPTIONS[0];
  const currentDayDraft = scheduleDraft.find((item) => item.dayOfWeek === currentScheduleStep.key);
  const currentDayIsClosed = currentDayDraft?.isClosed ?? false;
  const isLastScheduleStep = scheduleStepIndex >= (DAY_OPTIONS.length - 1);

  const goToNextScheduleStep = () => {
    setScheduleStepIndex((current) => Math.min(current + 1, DAY_OPTIONS.length - 1));
  };

  const goToPreviousScheduleStep = () => {
    setScheduleStepIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-white md:text-2xl">Sedes</h1>
            <p className="text-sm text-gray-400">Listado paginado con carga dinamica desde la API.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-secondary text-white">
              Server-side data table
            </Badge>
            <Button size="sm" onClick={openCreateDialog}>
              Nueva sede
            </Button>
          </div>
        </div>

        <div className="card p-4 bg-card">
          <RemoteDataTable
            columns={columns}
            getRowId={(headquarter) => headquarter.id}
            emptyMessage="No hay sedes registradas"
            searchPlaceholder="Buscar por nombre, telefono o ubicacion"
            defaultPageSize={10}
            pageSizeOptions={[10, 20, 50]}
            reloadKey={reloadKey}
            loadData={loadHeadquarters}
          />
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-[620px] gap-0 overflow-visible p-0">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <Building2 size={18} />
            </div>
            <DialogTitle>{editingHeadquarterId ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
            <DialogDescription>
              {editingHeadquarterId
                ? 'Actualiza los datos de la sede seleccionada.'
                : 'Crea una sede y selecciona una dirección válida.'}
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <HeadquartersForm
              form={form}
              loading={saving}
              error={error}
              submitLabel={editingHeadquarterId ? 'Guardar cambios' : 'Crear sede'}
              onChange={handleFieldChange}
              onSubmit={handleSaveHeadquarter}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSchedulesDialogOpen}
        onOpenChange={(open) => {
          setIsSchedulesDialogOpen(open);
          if (!open) {
            setScheduleHeadquarter(null);
            setScheduleDraft(buildDefaultScheduleDraft());
            setScheduleStepIndex(0);
          }
        }}
      >
        <DialogContent className="card max-h-[90vh] overflow-y-auto bg-card text-white sm:max-w-xl lg:min-w-0">
          <DialogHeader>
            <DialogTitle>Horarios de {scheduleHeadquarter?.name ?? 'sede'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Paso {scheduleStepIndex + 1} de {DAY_OPTIONS.length}
              </p>
              <div className="grid grid-cols-7 gap-1">
                {DAY_OPTIONS.map((day, index) => (
                  <div
                    key={day.key}
                    className={`h-1.5 rounded-full ${index <= scheduleStepIndex ? 'bg-orange-500' : 'bg-gray-700'}`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-md border border-orange-700 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{currentScheduleStep.label}</p>
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <span>Cerrado</span>
                  <Switch
                    checked={currentDayIsClosed}
                    onCheckedChange={(checked) => handleScheduleFieldChange(currentScheduleStep.key, 'isClosed', checked)}
                  />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs text-gray-400">Apertura</p>
                  <Input
                    type="time"
                    value={currentDayDraft?.openTime ?? '09:00'}
                    disabled={currentDayIsClosed}
                    onChange={(event) => handleScheduleFieldChange(currentScheduleStep.key, 'openTime', event.target.value)}
                    className="border-orange-700"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-400">Cierre</p>
                  <Input
                    type="time"
                    value={currentDayDraft?.closeTime ?? '18:00'}
                    disabled={currentDayIsClosed}
                    onChange={(event) => handleScheduleFieldChange(currentScheduleStep.key, 'closeTime', event.target.value)}
                    className="border-orange-700"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={goToPreviousScheduleStep}
                disabled={scheduleStepIndex === 0 || isSavingSchedules}
                className="border-orange-700 bg-transparent text-white hover:bg-gray-700"
              >
                Anterior
              </Button>
              {isLastScheduleStep ? (
                <Button
                  type="button"
                  onClick={() => void handleSaveSchedules()}
                  disabled={isSavingSchedules || !scheduleHeadquarter}
                  className="w-full"
                >
                  {isSavingSchedules ? 'Guardando horarios...' : 'Guardar horarios'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={goToNextScheduleStep}
                  disabled={isSavingSchedules}
                  className="w-full"
                >
                  Siguiente
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
