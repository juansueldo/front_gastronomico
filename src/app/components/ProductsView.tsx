import { useMemo } from 'react';
import { BookOpenText, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { type DataTableColumn, DataTable } from './ui/data-table';
import { useProductsViewModel } from '../hooks/useProductsViewModel';
import type { ProductItem } from '../api/product';
import { ProductRecipeIngredientRow } from './products/ProductRecipeIngredientRow';
import { ProductDialog } from './products/ProductDialog';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function ProductsView() {
  const {
    products,
    categories,
    isDialogOpen,
    setIsDialogOpen,
    editingProductId,
    name,
    setName,
    description,
    setDescription,
    price,
    setPrice,
    imagePreviewUrl,
    selectedCategoryIds,
    recipesByProductId,
    isRecipeDialogOpen,
    setIsRecipeDialogOpen,
    recipeProduct,
    recipeUsesIngredients,
    setRecipeUsesIngredients,
    recipeIngredients,
    openRecipeDialog,
    addRecipeIngredientRow,
    removeRecipeIngredientRow,
    updateRecipeIngredient,
    handleSaveRecipe,
    openCreateDialog,
    openEditDialog,
    toggleCategory,
    removeCategorySelection,
    handleProductImageChange,
    clearSelectedProductImage,
    handleSaveProduct,
    handleDeleteProduct,
    setRecipeProduct,
    setRecipeIngredients,
  } = useProductsViewModel();
  const getCategoryNames = (categoryId: number) => {
    return categories
      .filter((category) => category.id == categoryId)
      .map((category) => category.name)
      .join(', ');
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
      accessor: (product) => getCategoryNames(product.categoryId ?? []) || 'Sin categorías',
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

      <ProductDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingProductId={editingProductId}
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        price={price}
        onPriceChange={setPrice}
        imagePreviewUrl={imagePreviewUrl}
        onProductImageChange={handleProductImageChange}
        onClearProductImage={clearSelectedProductImage}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={toggleCategory}
        onRemoveCategorySelection={removeCategorySelection}
        onSaveProduct={handleSaveProduct}
      />

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
                      <ProductRecipeIngredientRow
                        key={ingredient.id}
                        ingredient={ingredient}
                        onChange={updateRecipeIngredient}
                        onRemove={removeRecipeIngredientRow}
                      />
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
