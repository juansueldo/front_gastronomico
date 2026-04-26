import { useCallback, useEffect, useMemo, useState } from 'react';
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
  // Food & Drink
  Pizza, Coffee, Beer, Wine, Soup, Salad, Sandwich, Cookie,
  IceCream2, Cake, Candy, Apple, Banana, Carrot, Fish, Egg,
  FlameKindling, ChefHat, UtensilsCrossed, Utensils, CupSoda,
  Milk, Beef, Wheat, Croissant, BaggageClaim,
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
  const [reloadKey, setReloadKey] = useState(0);

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
  };

  const handleDeleteCategory = async (category: ProductCategory) => {
    const confirmed = window.confirm(`¿Eliminar la categoría "${category.name}"?`);
    if (!confirmed) return;

    try {
      await deleteProductCategory(category.id);
      setReloadKey((current) => current + 1);
      toast.success('Categoría eliminada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la categoría');
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
        onClick: handleDeleteCategory,
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-orange-700 text-white">
          <DialogHeader>
            <DialogTitle>
              {editingCategoryId ? 'Editar categoría' : 'Nueva categoría'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Selector de ícono */}
            <div className="space-y-2 rounded-md border border-orange-700 bg-body p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300">Ícono (opcional)</p>
                {icon && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    {renderCategoryIcon(icon, { size: 14 })}
                    <span>{icon}</span>
                  </div>
                )}
              </div>
              <Input
                placeholder="Buscar ícono (ej: cafe, pizza, oferta…)"
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto">
                <div className="grid grid-cols-6 gap-1.5">
                  {/* Opción "Sin ícono" */}
                  <button
                    type="button"
                    title="Sin ícono"
                    onClick={() => setIcon('')}
                    className={`
                      flex flex-col items-center justify-center gap-1 rounded-md p-2 text-xs transition-colors
                      ${icon === ''
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}
                    `}
                  >
                    <span className="text-base leading-none">—</span>
                    <span className="truncate w-full text-center leading-tight">ninguno</span>
                  </button>

                  {filteredIconEntries.map(([iconName, IconComponent]) => (
                    <button
                      key={iconName}
                      type="button"
                      title={iconName}
                      onClick={() => setIcon(iconName)}
                      className={`
                        flex flex-col items-center justify-center gap-1 rounded-md p-2 text-xs transition-colors
                        ${icon === iconName
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}
                      `}
                    >
                      <IconComponent size={18} className="shrink-0" />
                      <span className="truncate w-full text-center leading-tight">{iconName}</span>
                    </button>
                  ))}
                </div>

                {filteredIconEntries.length === 0 && (
                  <p className="text-xs text-gray-500 py-2 text-center">
                    No hay íconos que coincidan
                  </p>
                )}
              </div>
            </div>

            <Input
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
