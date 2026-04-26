import { useCallback, useMemo, useState } from 'react';
import { Building2, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { createHeadquarter, listHeadquarters, updateHeadquarter, type CreateHeadquarterRequest, type Headquarter } from '../api/headquarter';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { type DataTableColumn, RemoteDataTable, createRowActionsColumn } from './ui/data-table';
import { HeadquartersForm } from './headquarters/HeadquartersForm';

export function HeadquartersView() {
  const [form, setForm] = useState<CreateHeadquarterRequest>({ name: '', phone: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHeadquarterId, setEditingHeadquarterId] = useState<string | null>(null);

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
    setForm({ name: '', phone: '', location: '' });
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
    });
    setIsDialogOpen(true);
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
          label: 'Ver detalle',
          onClick: (headquarter) => {
            toast.info(`Sede: ${headquarter.name}`);
          },
        },
      ],
    }),
  ], []);

  const handleFieldChange = (field: keyof CreateHeadquarterRequest, value: string) => {
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
      const payload = {
        name: form.name.trim(),
        phone: form.phone?.trim() || undefined,
        location: form.location?.trim() || undefined,
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
        <DialogContent className="border-orange-700 bg-card text-white">
          <DialogHeader>
            <DialogTitle>{editingHeadquarterId ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
          </DialogHeader>
          <HeadquartersForm
            form={form}
            loading={saving}
            error={error}
            title={editingHeadquarterId ? 'Editar sede' : 'Nueva sede'}
            submitLabel={editingHeadquarterId ? 'Guardar cambios' : 'Crear sede'}
            description={
              editingHeadquarterId
                ? 'Actualiza los datos de la sede seleccionada.'
                : 'Crea una sede y refresca la tabla automaticamente.'
            }
            onChange={handleFieldChange}
            onSubmit={handleSaveHeadquarter}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
