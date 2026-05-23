import { useMemo, useState } from 'react';
import { BookOpenText, ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { type DataTableColumn, DataTable } from './ui/data-table';
import { useProductsViewModel } from '../hooks/useProductsViewModel';
import type { ProductItem } from '../api/product';
import { ProductRecipeIngredientRow } from './products/ProductRecipeIngredientRow';
import { ProductDialog } from './products/ProductDialog';
import { DeleteConfirmDialog } from './ui/delete-confirm-dialog';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const getProductImageUrl = (product: ProductItem) => (
  product.imageUrl ?? product.image_url ?? product.image ?? null
);

export function ProductsView() {
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
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
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-orange-700/60 bg-body">
            {getProductImageUrl(product) ? (
              <img
                src={getProductImageUrl(product) ?? ''}
                alt={product.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <ImageIcon className="h-5 w-5 text-gray-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{product.name}</p>
            {product.description ? (
              <p className="mt-1 break-words text-xs text-gray-400">{product.description}</p>
            ) : null}
          </div>
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
          <Button size="sm" className="bg-transparent border-orange-600 text-white hover:bg-gray-700" onClick={() => setProductToDelete(product)}>
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
        <DialogContent className="max-w-[min(920px,calc(100vw-2rem))] p-0 overflow-visible">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <BookOpenText size={18} />
            </div>
            <DialogTitle>Receta de {recipeProduct?.name ?? 'producto'}</DialogTitle>
            <DialogDescription>
              Configura si este producto descuenta stock directo o ingredientes al cobrarse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <label className="flex items-center gap-2 text-sm text-[var(--app-strong)] cursor-pointer">
              <Checkbox
                checked={recipeUsesIngredients}
                onCheckedChange={(checked) => setRecipeUsesIngredients(Boolean(checked))}
              />
              <span className="font-semibold">Este producto usa receta (descontar ingredientes)</span>
            </label>

            {!recipeUsesIngredients ? (
              <div className="rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3 text-sm text-[var(--app-muted)]">
                Este producto se controla por stock directo (sin receta de ingredientes).
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-[var(--primary)] bg-[var(--app-panel-subtle)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--app-strong)]">Ingredientes por unidad de producto</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={addRecipeIngredientRow}
                    className="gap-1.5 border border-[var(--app-line)] bg-[var(--app-soft)] text-[var(--app-strong)] hover:bg-[var(--app-panel)]"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar ingrediente
                  </Button>
                </div>

                {recipeIngredients.length === 0 ? (
                  <p className="rounded-md border border-dashed border-[var(--app-line)] px-3 py-5 text-center text-xs text-[var(--app-muted)]">
                    No hay ingredientes cargados.
                  </p>
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
          </div>

          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRecipeDialogOpen(false)}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleSaveRecipe}>
              <BookOpenText size={15} />
              Guardar receta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(productToDelete)}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
        itemLabel="Producto"
        itemName={productToDelete?.name ?? ''}
        itemIcon={productToDelete && getProductImageUrl(productToDelete) ? (
          <img
            src={getProductImageUrl(productToDelete) ?? ''}
            alt={productToDelete.name}
            className="h-8 w-8 rounded-md object-cover"
          />
        ) : (
          <ImageIcon size={24} className="text-[var(--primary)]" />
        )}
        loading={isDeletingProduct}
        onConfirm={async () => {
          if (!productToDelete) return;
          setIsDeletingProduct(true);
          try {
            await handleDeleteProduct(productToDelete);
            setProductToDelete(null);
          } finally {
            setIsDeletingProduct(false);
          }
        }}
      />
    </div>
  );
}
