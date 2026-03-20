import { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import {
  createProductCategory,
  deleteProductCategory,
  fetchProductCategories,
  fetchProducts,
  type ProductCategory,
  updateProductCategory,
} from '../catalogApi';
import { type DataTableColumn, DataTable } from './ui/data-table';

const CATEGORY_ICON_OPTIONS = [
  { value: '🍕', label: 'pizza' },
  { value: '🍔', label: 'hamburguesa' },
  { value: '🌭', label: 'pancho' },
  { value: '🍟', label: 'papas fritas' },
  { value: '🥪', label: 'sandwich' },
  { value: '🌮', label: 'taco' },
  { value: '🥟', label: 'empanada' },
  { value: '🍝', label: 'pasta' },
  { value: '🍲', label: 'guiso' },
  { value: '🥗', label: 'ensalada' },
  { value: '🍰', label: 'torta' },
  { value: '🧁', label: 'cupcake' },
  { value: '🍩', label: 'dona' },
  { value: '🍦', label: 'helado' },
  { value: '☕', label: 'cafe' },
  { value: '🧉', label: 'mate' },
  { value: '🥤', label: 'bebida' },
  { value: '🍺', label: 'cerveza' },
  { value: '🍷', label: 'vino' },
  { value: '🍹', label: 'coctel' },
] as const;

export function CategoriesView() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productsCountByCategory, setProductsCountByCategory] = useState<Record<string, number>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [iconQuery, setIconQuery] = useState('');

  const filteredIconOptions = CATEGORY_ICON_OPTIONS.filter((option) => (
    option.label.toLowerCase().includes(iconQuery.trim().toLowerCase())
  ));

  const loadCatalog = async () => {
    const [backendCategories, backendProducts] = await Promise.all([
      fetchProductCategories(),
      fetchProducts(),
    ]);

    setCategories(backendCategories);

    const nextCountByCategory: Record<string, number> = {};
    backendProducts.forEach((product) => {
      product.categoryIds.forEach((categoryId) => {
        nextCountByCategory[categoryId] = (nextCountByCategory[categoryId] ?? 0) + 1;
      });
    });
    setProductsCountByCategory(nextCountByCategory);
  };

  useEffect(() => {
    const loadInitialCatalog = async () => {
      try {
        await loadCatalog();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo cargar el catálogo');
      }
    };

    void loadInitialCatalog();
  }, []);

  const openCreateDialog = () => {
    setEditingCategoryId(null);
    setName('');
    setDescription('');
    setIcon('');
    setIconQuery('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: ProductCategory) => {
    setEditingCategoryId(category.id);
    setName(category.name);
    setDescription(category.description ?? '');
    setIcon(category.icon ?? '');
    setIconQuery('');
    setIsDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedIcon = icon.trim();

    if (!trimmedName) {
      toast.error('Ingresá el nombre de la categoría');
      return;
    }

    const duplicated = categories.some((category) => (
      category.id !== editingCategoryId
      &&
      category.name.toLowerCase() === trimmedName.toLowerCase()
    ));

    if (duplicated) {
      toast.error('Ya existe una categoría con ese nombre');
      return;
    }

    try {
      if (editingCategoryId) {
        await updateProductCategory(editingCategoryId, {
          name: trimmedName,
          description: trimmedDescription || undefined,
          icon: trimmedIcon || undefined,
        });
        toast.success('Categoría actualizada');
      } else {
        await createProductCategory({
          name: trimmedName,
          description: trimmedDescription || undefined,
          icon: trimmedIcon || undefined,
        });
        toast.success('Categoría creada');
      }

      await loadCatalog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la categoría');
      return;
    }

    setIsDialogOpen(false);
    setEditingCategoryId(null);
    setName('');
    setDescription('');
    setIcon('');
    setIconQuery('');
  };

  const handleDeleteCategory = async (category: ProductCategory) => {
    const confirmed = window.confirm(`¿Eliminar la categoría \"${category.name}\"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteProductCategory(category.id);
      await loadCatalog();
      toast.success('Categoría eliminada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la categoría');
    }
  };

  const categoryColumns: DataTableColumn<ProductCategory>[] = [
    {
      key: 'name',
      header: 'Categoría',
      accessor: (category) => category.name,
      sortable: true,
      className: 'text-white',
      cell: (category) => (
        <div className="min-w-0">
          <p className="text-sm text-white font-medium truncate">
            {category.icon ? `${category.icon} ` : ''}
            {category.name}
          </p>
          {category.description ? (
            <p className="text-xs text-gray-400 mt-1 break-words">{category.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'products',
      header: 'Productos asociados',
      accessor: (category) => productsCountByCategory[category.id] ?? 0,
      sortable: true,
      className: 'text-gray-300',
      cell: (category) => `${productsCountByCategory[category.id] ?? 0}`,
    },
    {
      key: 'actions',
      header: 'Acciones',
      accessor: () => '',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (category) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEditDialog(category)}>
            Editar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleDeleteCategory(category)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl md:text-2xl font-semibold text-white">Categorías de productos</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-secondary text-white">
              {categories.length} categorías
            </Badge>
            <Button size="sm" onClick={openCreateDialog}>
              Nueva categoría
            </Button>
          </div>
        </div>

        <DataTable
          data={categories}
          columns={categoryColumns}
          getRowId={(category) => category.id}
          emptyMessage="Sin categorías cargadas"
          searchPlaceholder="Buscar categoría, descripción o cantidad"
          defaultPageSize={10}
          pageSizeOptions={[10, 25, 50]}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingCategoryId ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2 rounded-md border border-gray-700 bg-body p-3">
              <p className="text-sm text-gray-300">Ícono (opcional)</p>
              <Input
                placeholder="Buscar ícono por nombre"
                value={iconQuery}
                onChange={(event) => setIconQuery(event.target.value)}
              />
              <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={icon === '' ? 'secondary' : 'outline'}
                  className="justify-start"
                  onClick={() => setIcon('')}
                >
                  Sin ícono
                </Button>
                {filteredIconOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant={icon === option.value ? 'secondary' : 'outline'}
                    className="justify-start"
                    onClick={() => setIcon(option.value)}
                  >
                    <span>{option.value}</span>
                    <span className="text-xs text-gray-300">{option.label}</span>
                  </Button>
                ))}
              </div>
              {filteredIconOptions.length === 0 ? (
                <p className="text-xs text-gray-500">No hay íconos que coincidan con la búsqueda</p>
              ) : null}
            </div>
            <Input
              placeholder="Nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="Descripción (opcional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Button className="w-full" onClick={handleSaveCategory}>
              {editingCategoryId ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
