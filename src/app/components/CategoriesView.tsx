import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import {
  // Food & Drink
  Pizza, Coffee, Beer, Wine, Soup, Salad, Sandwich, Cookie,
  IceCream2, Cake, Candy, Apple, Banana, Carrot, Fish, Egg,
  FlameKindling, ChefHat, UtensilsCrossed, Utensils, CupSoda,
  Milk, Beef, Wheat, Croissant, BaggageClaim,
  ChevronDown, PlusCircle, Search,
  type LucideIcon,
} from 'lucide-react';
import {
  createProductCategory,
  deleteProductCategory,
  fetchProducts,
  listProductCategories,
  type ProductCategory,
  updateProductCategory,
} from '../catalogApi';
import { type DataTableColumn, RemoteDataTable, createRowActionsColumn } from './ui/data-table';
import { DeleteConfirmDialog } from './ui/delete-confirm-dialog';

// Mapa nombre → componente Lucide
const ICON_MAP: Record<string, LucideIcon> = {
  // Comida
  Pizza, Coffee, Beer, Wine, Soup, Salad, Sandwich, Cookie,
  IceCream2, Cake, Candy, Apple, Banana, Carrot, Fish, Egg,
  FlameKindling, ChefHat, UtensilsCrossed, Utensils, CupSoda,
  Milk, Beef, Wheat, Croissant, BaggageClaim,
};

// Labels en español para búsqueda
const ICON_LABELS: Record<string, string[]> = {
  Pizza: ['pizza', 'comida'],
  Coffee: ['cafe', 'coffee', 'bebida caliente'],
  Beer: ['cerveza', 'bebida'],
  Wine: ['vino', 'bebida'],
  Soup: ['sopa', 'caldo', 'guiso'],
  Salad: ['ensalada', 'vegetariano'],
  Sandwich: ['sandwich', 'bocadillo'],
  Cookie: ['galleta', 'postre'],
  IceCream2: ['helado', 'postre'],
  Cake: ['torta', 'pastel', 'postre'],
  Candy: ['dulce', 'caramelo'],
  Apple: ['manzana', 'fruta'],
  Banana: ['banana', 'fruta'],
  Carrot: ['zanahoria', 'verdura'],
  Fish: ['pescado', 'mariscos'],
  Egg: ['huevo', 'desayuno'],
  FlameKindling: ['fuego', 'caliente', 'picante'],
  ChefHat: ['chef', 'cocina'],
  UtensilsCrossed: ['cubiertos', 'restaurante'],
  Utensils: ['tenedor', 'cubiertos'],
  CupSoda: ['refresco', 'gaseosa', 'bebida'],
  Milk: ['leche', 'lacteo'],
  Beef: ['carne', 'ternera'],
  Wheat: ['trigo', 'harina', 'panaderia'],
  Croissant: ['croissant', 'medialuna', 'panaderia'],
  BaggageClaim: ['bolsa', 'para llevar'],
  Tag: ['etiqueta', 'tag', 'categoria'],
  Tags: ['etiquetas', 'tags', 'categorias'],
  Layers: ['capas', 'niveles'],
  Grid3x3: ['grilla', 'menu'],
  LayoutGrid: ['layout', 'cuadricula'],
  Star: ['estrella', 'favorito', 'destacado'],
  Bookmark: ['marcador', 'guardado'],
  Heart: ['corazon', 'favorito'],
  ThumbsUp: ['like', 'recomendado'],
  Flame: ['fuego', 'popular', 'picante'],
  Zap: ['rapido', 'electrico'],
  Trophy: ['trofeo', 'premio'],
  Crown: ['corona', 'premium'],
  Sparkles: ['brillante', 'especial', 'novedad'],
  Leaf: ['hoja', 'vegano', 'natural'],
  Trees: ['arbol', 'organico'],
  Flower2: ['flor', 'primavera'],
  Package: ['paquete', 'producto'],
  Box: ['caja', 'producto'],
  ShoppingCart: ['carrito', 'compra'],
  ShoppingBag: ['bolsa', 'compra'],
  Store: ['tienda', 'local'],
  Gift: ['regalo', 'promo'],
  Percent: ['descuento', 'oferta', 'promo'],

};

/** Renderiza un ícono Lucide a partir de su nombre guardado */
export function renderCategoryIcon(iconName: string | null | undefined, props?: { size?: number; className?: string }) {
  if (!iconName) return null;
  const IconComponent = ICON_MAP[iconName];
  if (!IconComponent) return null;
  return <IconComponent size={props?.size ?? 16} className={props?.className} />;
}

export function CategoriesView() {
  const [productsCountByCategory, setProductsCountByCategory] = useState<Record<string, number>>({});
  const [totalCategories, setTotalCategories] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(''); // ahora guarda el nombre, ej: "Pizza"
  const [iconQuery, setIconQuery] = useState('');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const filteredIconEntries = Object.entries(ICON_MAP).filter(([iconName]) => {
    const q = iconQuery.trim().toLowerCase();
    if (!q) return true;
    const labels = ICON_LABELS[iconName] ?? [];
    return (
      iconName.toLowerCase().includes(q) ||
      labels.some((label) => label.includes(q))
    );
  });

  const loadCatalogData = async () => {
    const backendProducts = await fetchProducts();
    const nextCountByCategory: Record<string, number> = {};
    backendProducts.forEach((product) => {
      product.categoryIds.forEach((categoryId) => {
        nextCountByCategory[categoryId] = (nextCountByCategory[categoryId] ?? 0) + 1;
      });
    });
    setProductsCountByCategory(nextCountByCategory);
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadCatalogData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo cargar el catálogo');
      }
    })();
  }, []);

  const openCreateDialog = () => {
    setEditingCategoryId(null);
    setName('');
    setDescription('');
    setIcon('');
    setIconQuery('');
    setIsIconPickerOpen(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: ProductCategory) => {
    setEditingCategoryId(category.id);
    setName(category.name);
    setDescription(category.description ?? '');
    setIcon(category.icon ?? '');
    setIconQuery('');
    setIsIconPickerOpen(false);
    setIsDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      toast.error('Ingresá el nombre de la categoría');
      return;
    }

    try {
      const payload = {
        name: trimmedName,
        description: trimmedDescription || undefined,
        icon: icon || undefined, // guarda "Pizza", "Coffee", etc.
      };

      if (editingCategoryId) {
        await updateProductCategory(editingCategoryId, payload);
        toast.success('Categoría actualizada');
      } else {
        await createProductCategory(payload);
        toast.success('Categoría creada');
      }

      setReloadKey((current) => current + 1);
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
    setIsIconPickerOpen(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setIsIconPickerOpen(false);
      setIconQuery('');
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    try {
      await deleteProductCategory(categoryToDelete.id);
      setReloadKey((current) => current + 1);
      toast.success('Categoría eliminada');
      setCategoryToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la categoría');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const loadCategories = useCallback(async ({
    page,
    pageSize,
    search,
    sort,
  }: {
    page: number;
    pageSize: number;
    search: string;
    sort: { key: string; direction: 'asc' | 'desc' } | null;
  }) => {
    const result = await listProductCategories({ page, pageSize, search, sort });
    setTotalCategories(result.total);
    return result;
  }, []);

  const categoryColumns = useMemo<DataTableColumn<ProductCategory>[]>(() => [
    {
      key: 'name',
      header: 'Categoría',
      accessor: (category) => category.name,
      sortable: true,
      className: 'text-white',
      cell: (category) => (
        <div className="min-w-0 flex items-center gap-2">
          {renderCategoryIcon(category.icon, { size: 18, className: 'text-gray-300 shrink-0' })}
          <div>
            <p className="text-sm text-white font-medium truncate">{category.name}</p>
            {category.description ? (
              <p className="text-xs text-gray-400 mt-1 break-words">{category.description}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Descripción',
      accessor: (category) => category.description ?? '',
      sortable: true,
      className: 'text-gray-300',
      cell: (category) => (
        <span className="whitespace-normal break-words">
          {category.description ?? 'Sin descripción'}
        </span>
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
    createRowActionsColumn<ProductCategory>({
      editAction: {
        label: 'Editar',
        onClick: openEditDialog,
      },
      deleteAction: {
        label: 'Eliminar',
        onClick: setCategoryToDelete,
      },
      extraActions: [
        {
          label: 'Ver icono',
          onClick: (category) => {
            toast.info(category.icon ? `Ícono actual: ${category.icon}` : 'La categoría no tiene ícono');
          },
        },
        {
          label: 'Copiar nombre',
          onClick: async (category) => {
            try {
              await navigator.clipboard.writeText(category.name);
              toast.success('Nombre copiado');
            } catch {
              toast.error('No se pudo copiar el nombre');
            }
          },
        },
      ],
    }),
  ], [productsCountByCategory]);

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl md:text-2xl font-semibold text-white">Categorías de productos</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-secondary text-white">
              {totalCategories} categorías
            </Badge>
            <Button size="sm" onClick={openCreateDialog}>
              Nueva categoría
            </Button>
          </div>
        </div>
        <div className='card p-4 bg-card'>
        <RemoteDataTable
          columns={categoryColumns}
          getRowId={(category) => category.id}
          emptyMessage="Sin categorías cargadas"
          searchPlaceholder="Buscar categoría, descripción o cantidad"
          defaultPageSize={10}
          pageSizeOptions={[10, 25, 50]}
          reloadKey={reloadKey}
          loadData={loadCategories}
        />

        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-[560px] p-0 overflow-visible">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <ChefHat size={18} />
            </div>
            <DialogTitle>
              {editingCategoryId ? 'Editar categoría' : 'Nueva categoría'}
            </DialogTitle>
            <DialogDescription>
              Organiza tus productos creando una nueva categoría
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[var(--app-strong)]">Ícono (opcional)</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsIconPickerOpen((current) => !current)}
                  className={`flex h-10 w-full items-center justify-between gap-3 rounded-md border bg-[var(--app-panel-subtle)] px-3 text-left text-sm transition ${
                    isIconPickerOpen
                      ? 'border-[var(--primary)] shadow-[0_0_0_1px_var(--primary)]'
                      : 'border-[var(--app-line)] hover:border-[var(--primary)]/70'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2 text-[var(--app-muted)]">
                    {icon ? renderCategoryIcon(icon, { size: 16, className: 'text-[var(--primary)] shrink-0' }) : (
                      <ChefHat size={16} className="shrink-0 text-[var(--app-muted)]" />
                    )}
                    <span className={icon ? 'truncate text-[var(--app-strong)]' : 'truncate'}>
                      {icon || 'Selecciona un ícono para la categoría'}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-[var(--app-muted)] transition-transform ${isIconPickerOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isIconPickerOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[60] overflow-hidden rounded-md border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_18px_48px_rgb(0_0_0_/_34%)]">
                    <div className="m-2 flex h-9 items-center gap-2 rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-3">
                      <Search size={14} className="shrink-0 text-[var(--app-muted)]" />
                      <input
                        autoFocus
                        value={iconQuery}
                        onChange={(event) => setIconQuery(event.target.value)}
                        placeholder="Buscar ícono (ej: café, pizza, oferta...)"
                        className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--app-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-0 focus:shadow-none"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto px-1 pb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIcon('');
                          setIsIconPickerOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                          icon === ''
                            ? 'bg-[var(--app-soft)] text-[var(--primary)]'
                            : 'text-[var(--app-muted)] hover:bg-[var(--app-soft)] hover:text-[var(--app-strong)]'
                        }`}
                      >
                        <span className="flex h-5 w-5 items-center justify-center text-xs">-</span>
                        Sin ícono
                      </button>

                      {filteredIconEntries.map(([iconName, IconComponent]) => (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => {
                            setIcon(iconName);
                            setIsIconPickerOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                            icon === iconName
                              ? 'bg-[var(--app-soft)] text-[var(--primary)]'
                              : 'text-[var(--app-muted)] hover:bg-[var(--app-soft)] hover:text-[var(--app-strong)]'
                          }`}
                        >
                          <IconComponent size={16} className="shrink-0" />
                          <span>{iconName}</span>
                        </button>
                      ))}

                      {filteredIconEntries.length === 0 && (
                        <p className="px-3 py-4 text-center text-xs text-[var(--app-muted)]">
                          No hay íconos que coincidan
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[var(--app-strong)]">Nombre *</span>
              <Input
                placeholder="Ej: Bebidas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[var(--app-strong)]">Descripción (opcional)</span>
              <textarea
                placeholder="Ej: Bebidas frías y calientes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="min-h-20 w-full resize-none rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-3 py-2 text-sm text-[var(--app-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus:shadow-[0_0_0_1px_var(--primary)]"
              />
            </label>
          </div>

          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveCategory} className="gap-2">
              <PlusCircle size={15} />
              {editingCategoryId ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(categoryToDelete)}
        onOpenChange={(open) => {
          if (!open) setCategoryToDelete(null);
        }}
        itemLabel="Categoría"
        itemName={categoryToDelete?.name ?? ''}
        itemIcon={categoryToDelete?.icon
          ? renderCategoryIcon(categoryToDelete.icon, { size: 24, className: 'text-[var(--primary)]' })
          : <ChefHat size={24} className="text-[var(--primary)]" />}
        loading={isDeletingCategory}
        onConfirm={confirmDeleteCategory}
      />
    </div>
  );
}
