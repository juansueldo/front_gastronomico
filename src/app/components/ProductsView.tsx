import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import {
  listProductCategories,
  type ProductCategory,
} from '../catalogApi';
import { type DataTableColumn, DataTable } from './ui/data-table';
import {
  productApi,
} from '../api';
import type { ProductItem, ProductRecipeConfig } from '../api/product';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function ProductsView() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [recipesByProductId, setRecipesByProductId] = useState<Record<string, ProductRecipeConfig>>({});
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState<ProductItem | null>(null);
  const [recipeUsesIngredients, setRecipeUsesIngredients] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ id: string; name: string; quantity: string; unit: string }>>([]);

  const loadCatalog = async () => {
    const [backendProducts, backendCategoriesResult] = await Promise.all([
      productApi.listProductsLegacy(),
      listProductCategories({ page: 1, pageSize: 200 }),
    ]);

    setProducts(backendProducts);
    setCategories(backendCategoriesResult.rows);
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

  const openRecipeDialog = async (product: ProductItem) => {
    const localRecipe = recipesByProductId[product.id];

    setRecipeProduct(product);
    setRecipeUsesIngredients(localRecipe?.usesRecipe ?? false);
    setRecipeIngredients(
      localRecipe?.ingredients.map((ingredient) => ({
        id: ingredient.id ?? crypto.randomUUID(),
        name: ingredient.name,
        quantity: String(ingredient.quantity),
        unit: ingredient.unit,
      })) ?? [],
    );
    setIsRecipeDialogOpen(true);

    try {
      const backendRecipe = await productApi.getProductRecipe(product.id);

      if (!backendRecipe) {
        return;
      }

      setRecipesByProductId((prev) => ({
        ...prev,
        [product.id]: backendRecipe,
      }));
      setRecipeUsesIngredients(backendRecipe.usesRecipe);
      setRecipeIngredients(
        backendRecipe.ingredients.map((ingredient) => ({
          id: ingredient.id ?? crypto.randomUUID(),
          name: ingredient.name,
          quantity: String(ingredient.quantity),
          unit: ingredient.unit,
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la receta');
    }
  };

  const addRecipeIngredientRow = () => {
    setRecipeIngredients((prev) => ([
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        quantity: '',
        unit: 'unidad',
      },
    ]));
  };

  const removeRecipeIngredientRow = (ingredientId: string) => {
    setRecipeIngredients((prev) => prev.filter((ingredient) => ingredient.id !== ingredientId));
  };

  const updateRecipeIngredient = (ingredientId: string, field: 'name' | 'quantity' | 'unit', value: string) => {
    setRecipeIngredients((prev) => prev.map((ingredient) => (
      ingredient.id === ingredientId
        ? { ...ingredient, [field]: value }
        : ingredient
    )));
  };

  const handleSaveRecipe = async () => {
    if (!recipeProduct) {
      return;
    }

    const normalizedIngredients = recipeIngredients
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity: Number(ingredient.quantity.replace(',', '.')),
        unit: ingredient.unit.trim(),
      }))
      .filter((ingredient) => ingredient.name.length > 0 || ingredient.unit.length > 0 || ingredient.quantity > 0);

    const hasInvalidIngredient = normalizedIngredients.some((ingredient) => (
      !ingredient.name
      || !Number.isFinite(ingredient.quantity)
      || ingredient.quantity <= 0
      || !ingredient.unit
    ));

    if (hasInvalidIngredient) {
      toast.error('Completá nombre, cantidad y unidad en cada ingrediente');
      return;
    }

    if (recipeUsesIngredients && normalizedIngredients.length === 0) {
      toast.error('Agregá al menos un ingrediente para la receta');
      return;
    }

    let savedRecipe: ProductRecipeConfig;

    try {
      savedRecipe = await productApi.saveProductRecipe({
        productId: recipeProduct.id,
        usesRecipe: recipeUsesIngredients,
        ingredients: normalizedIngredients,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la receta');
      return;
    }

    setRecipesByProductId((prev) => ({
      ...prev,
      [recipeProduct.id]: savedRecipe,
    }));

    setIsRecipeDialogOpen(false);
    toast.success('Receta actualizada');
  };

  const openCreateDialog = () => {
    setEditingProductId(null);
    setName('');
    setDescription('');
    setPrice('');
    setSelectedCategoryIds([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: ProductItem) => {
    setEditingProductId(product.id);
    setName(product.name);
    setDescription(product.description ?? '');
    setPrice(String(product.price));
    setSelectedCategoryIds(product.categoryIds ?? []);
    setIsDialogOpen(true);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) => (
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    ));
  };

  const handleSaveProduct = async () => {
    const trimmedName = name.trim();
    const parsedPrice = Number(price.replace(',', '.'));

    if (!trimmedName) {
      toast.error('Ingresá el nombre del producto');
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Ingresá un precio válido');
      return;
    }

    if (selectedCategoryIds.length === 0) {
      toast.error('Seleccioná al menos una categoría');
      return;
    }

    try {
      if (editingProductId) {
        await productApi.updateProduct(editingProductId, {
          name: trimmedName,
          description: description.trim() || undefined,
          price: parsedPrice,
          categoryIds: selectedCategoryIds,
        });
        toast.success('Producto actualizado');
      } else {
        await productApi.createProduct({
          name: trimmedName,
          description: description.trim() || undefined,
          price: parsedPrice,
          categoryIds: selectedCategoryIds,
        });
        toast.success('Producto creado');
      }

      await loadCatalog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el producto');
      return;
    }

    setIsDialogOpen(false);
    setEditingProductId(null);
  };

  const handleDeleteProduct = async (product: ProductItem) => {
    const confirmed = window.confirm(`¿Eliminar el producto \"${product.name}\"?`);

    if (!confirmed) {
      return;
    }

    try {
      await productApi.deleteProduct(product.id);
      await loadCatalog();
      toast.success('Producto eliminado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el producto');
    }
  };

  const getCategoryNames = (categoryIds: string[]) => {
    return categories
      .filter((category) => categoryIds.includes(category.id))
      .map((category) => category.name)
      .join(', ');
  };

  const removeCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) => prev.filter((id) => id !== categoryId));
  };

  const productColumns = useMemo<DataTableColumn<ProductItem>[]>(() => [
    {
      key: 'name',
      header: 'Producto',
      accessor: (product) => product.name,
      sortable: true,
      className: 'text-white font-medium',
      cell: (product) => (
        <div className="min-w-0">
          <p className="text-sm text-white font-medium truncate">{product.name}</p>
          {product.description ? (
            <p className="text-xs text-gray-400 mt-1 break-words">{product.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'categories',
      header: 'Categorías',
      accessor: (product) => getCategoryNames(product.categoryIds ?? []) || 'Sin categorías',
      sortable: true,
      className: 'text-gray-300',
    },
    {
      key: 'price',
      header: 'Precio',
      accessor: (product) => product.price,
      sortable: true,
      className: 'text-gray-300',
      cell: (product) => currencyFormatter.format(product.price),
    },
    {
      key: 'stockMode',
      header: 'Stock',
      accessor: (product) => recipesByProductId[product.id]?.usesRecipe ? 'Por receta' : 'Stock directo',
      sortable: true,
      className: 'text-gray-300',
      cell: (product) => (
        <Badge variant="secondary" className={recipesByProductId[product.id]?.usesRecipe ? 'bg-label-info text-white' : 'bg-label-warning text-black'}>
          {recipesByProductId[product.id]?.usesRecipe ? 'Por receta' : 'Stock directo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      accessor: () => '',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (product) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" className="bg-transparent border-orange-600 text-white hover:bg-gray-700" onClick={() => { void openRecipeDialog(product); }}>
            <BookOpenText className="h-4 w-4" />
          </Button>
          <Button size="sm" className="bg-transparent border-orange-600 text-white hover:bg-gray-700" onClick={() => openEditDialog(product)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" className="bg-transparent border-orange-600 text-white hover:bg-gray-700" onClick={() => handleDeleteProduct(product)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], [categories, recipesByProductId]);

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl md:text-2xl font-semibold text-white">Productos</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-secondary text-white">
              {products.length} productos
            </Badge>
            <Button size="sm" onClick={openCreateDialog}>
              Nuevo producto
            </Button>
          </div>
        </div>

        <div className="card p-4 bg-card">
          <DataTable
            data={products}
            columns={productColumns}
            getRowId={(product) => product.id}
            emptyMessage="Sin productos cargados"
            searchPlaceholder="Buscar producto, categoría o precio"
            defaultPageSize={10}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-orange-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingProductId ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
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
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Precio"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />

            <div className="space-y-3 rounded-md border border-orange-700 bg-body p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-300">Categorías</p>
                {categories.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" variant="outline" className="border-orange-600 bg-transparent text-white hover:bg-gray-700">
                        Seleccionar categorías
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto border-orange-700 bg-card text-white">
                      {categories.map((category) => (
                        <DropdownMenuCheckboxItem
                          key={category.id}
                          checked={selectedCategoryIds.includes(category.id)}
                          onCheckedChange={() => toggleCategory(category.id)}
                          className="cursor-pointer"
                        >
                          {category.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>

              {categories.length === 0 ? (
                <p className="text-xs text-gray-500">Primero creá categorías</p>
              ) : selectedCategoryIds.length === 0 ? (
                <p className="text-xs text-gray-500">Seleccioná al menos una categoría</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedCategoryIds.map((categoryId) => {
                    const category = categories.find((item) => item.id === categoryId);

                    if (!category) {
                      return null;
                    }

                    return (
                      <Badge
                        key={category.id}
                        variant="secondary"
                        className="cursor-pointer bg-label-secondary text-white"
                        onClick={() => removeCategorySelection(category.id)}
                      >
                        {category.name}
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2 border-t border-orange-700/50 pt-3">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <Checkbox
                      checked={selectedCategoryIds.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                    <span>{category.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={handleSaveProduct}>
              {editingProductId ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRecipeDialogOpen}
        onOpenChange={(open) => {
          setIsRecipeDialogOpen(open);
          if (!open) {
            setRecipeProduct(null);
            setRecipeIngredients([]);
            setRecipeUsesIngredients(false);
          }
        }}
      >
        <DialogContent className="bg-card border-orange-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receta de {recipeProduct?.name ?? 'producto'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <Checkbox
                checked={recipeUsesIngredients}
                onCheckedChange={(checked) => setRecipeUsesIngredients(Boolean(checked))}
              />
              <span>Este producto usa receta (descontar ingredientes)</span>
            </label>

            {!recipeUsesIngredients ? (
              <div className="rounded-md border border-orange-700 bg-body p-3 text-sm text-gray-300">
                Este producto se controla por stock directo (sin receta de ingredientes).
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-orange-700 bg-body p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">Ingredientes por unidad de producto</p>
                  <Button type="button" size="sm" variant="secondary" onClick={addRecipeIngredientRow}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar ingrediente
                  </Button>
                </div>

                {recipeIngredients.length === 0 ? (
                  <p className="text-xs text-gray-500">No hay ingredientes cargados.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {recipeIngredients.map((ingredient) => (
                      <div key={ingredient.id} className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_auto] gap-2 items-center">
                        <Input
                          placeholder="Ingrediente"
                          value={ingredient.name}
                          onChange={(event) => updateRecipeIngredient(ingredient.id, 'name', event.target.value)}
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Cantidad"
                          value={ingredient.quantity}
                          onChange={(event) => updateRecipeIngredient(ingredient.id, 'quantity', event.target.value)}
                        />
                        <Select value={ingredient.unit} onValueChange={(value) => updateRecipeIngredient(ingredient.id, 'unit', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Unidad" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unidad">Unidad</SelectItem>
                            <SelectItem value="g">Gramos</SelectItem>
                            <SelectItem value="kg">Kilogramos</SelectItem>
                            <SelectItem value="ml">Mililitros</SelectItem>
                            <SelectItem value="l">Litros</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removeRecipeIngredientRow(ingredient.id)}
                        >
                          Quitar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button className="w-full" onClick={handleSaveRecipe}>
              Guardar receta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
