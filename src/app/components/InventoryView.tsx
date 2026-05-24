import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, PackageCheck, Plus, ShoppingCart, Wrench } from 'lucide-react';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/components/dialog';
import { toast } from 'sonner';
import { fetchProductCategories, productApi, type ProductCategory } from '../features/products';
import { DataTable, type DataTableColumn } from '../shared/ui/components/data-table';
import type { ProductItem, ProductRecipeConfig, ProductStockBalance } from '../features/products';

type AdjustTarget =
  | { type: 'ingredient'; key: string; name: string; unit: string }
  | { type: 'product'; productId: string; productName: string };

type ConsumeTarget = { type: 'product'; productId: string; productName: string };

interface IngredientInventoryRow {
  key: string;
  name: string;
  unit: string;
  usedByProducts: number;
  currentStock: number;
  minStock: number;
}

interface ConsumeOrderLine {
  id: string;
  productId: string;
  quantity: string;
}

interface DirectProductInventoryRow {
  productId: string;
  productName: string;
  categories: string;
  currentStock: number;
  minStock: number;
}

interface UnifiedInventoryRow {
  id: string;
  type: 'ingredient' | 'direct';
  name: string;
  detail: string;
  currentStock: number;
  minStock: number;
  price: number | null;
  usedByProducts: number | null;
  ingredient?: IngredientInventoryRow;
  directProduct?: DirectProductInventoryRow;
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function InventoryView() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [recipesByProductId, setRecipesByProductId] = useState<Record<string, ProductRecipeConfig>>({});
  const [ingredientRows, setIngredientRows] = useState<IngredientInventoryRow[]>([]);
  const [directProductStockMap, setDirectProductStockMap] = useState<Record<string, ProductStockBalance>>({});
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget | null>(null);
  const [isConsumeDialogOpen, setIsConsumeDialogOpen] = useState(false);
  const [consumeTarget, setConsumeTarget] = useState<ConsumeTarget | null>(null);
  const [consumeQuantityInput, setConsumeQuantityInput] = useState('1');
  const [isCreateIngredientDialogOpen, setIsCreateIngredientDialogOpen] = useState(false);
  const [ingredientNameInput, setIngredientNameInput] = useState('');
  const [ingredientUnitInput, setIngredientUnitInput] = useState('unidad');
  const [ingredientInitialStockInput, setIngredientInitialStockInput] = useState('0');
  const [ingredientMinStockInput, setIngredientMinStockInput] = useState('0');
  const [isConsumeOrderDialogOpen, setIsConsumeOrderDialogOpen] = useState(false);
  const [consumeOrderLines, setConsumeOrderLines] = useState<ConsumeOrderLine[]>([
    { id: crypto.randomUUID(), productId: '', quantity: '1' },
  ]);
  const [currentStockInput, setCurrentStockInput] = useState('0');
  const [minStockInput, setMinStockInput] = useState('0');

  const parseDecimalInput = (value: string) => Number(value.replace(',', '.'));
  const normalizeIngredientKey = (name: string, unit: string) => `${name.trim().toLowerCase()}::${unit.trim().toLowerCase()}`;

  const loadInventoryContext = async () => {
    const [
      backendProducts,
      backendCategories,
      recipes,
      stockBalances,
      directProductStock,
      ingredientCatalog,
    ] = await Promise.all([
      productApi.listProducts(),
      fetchProductCategories(),
      productApi.listProductRecipes(),
      productApi.listIngredientStock(),
      productApi.listProductStock(),
      productApi.listIngredients(),
    ]);

    const nextRecipesByProductId: Record<string, ProductRecipeConfig> = {};
    recipes.forEach((recipe) => {
      const productId = recipe.productId;
      if (recipe) {
        nextRecipesByProductId[productId] = recipe;
      }
    });

    const ingredientUsageMap = new Map<string, { name: string; unit: string; usedByProducts: Set<string> }>();
    backendProducts.forEach((product) => {
      const recipe = nextRecipesByProductId[product.id];

      if (!recipe || !recipe.usesRecipe) {
        return;
      }

      recipe.ingredients.forEach((ingredient) => {
        const ingredientKey = normalizeIngredientKey(ingredient.name, ingredient.unit);
        const currentUsage = ingredientUsageMap.get(ingredientKey);

        if (!currentUsage) {
          ingredientUsageMap.set(ingredientKey, {
            name: ingredient.name,
            unit: ingredient.unit,
            usedByProducts: new Set([product.id]),
          });
          return;
        }

        currentUsage.usedByProducts.add(product.id);
      });
    });

    const ingredientRowsByNormalizedKey = new Map<string, IngredientInventoryRow>();

    ingredientCatalog.forEach((ingredient) => {
      const normalizedKey = normalizeIngredientKey(ingredient.name, ingredient.unit);
      const usage = ingredientUsageMap.get(normalizedKey);

      ingredientRowsByNormalizedKey.set(normalizedKey, {
        key: ingredient.key || normalizedKey,
        name: ingredient.name,
        unit: ingredient.unit,
        usedByProducts: usage?.usedByProducts.size ?? 0,
        currentStock: ingredient.currentStock ?? 0,
        minStock: ingredient.minStock ?? 0,
      });
    });

    stockBalances.forEach((stock) => {
      const normalizedKey = normalizeIngredientKey(stock.name, stock.unit);
      const existing = ingredientRowsByNormalizedKey.get(normalizedKey);
      const usage = ingredientUsageMap.get(normalizedKey);

      ingredientRowsByNormalizedKey.set(normalizedKey, {
        key: stock.key || existing?.key || normalizedKey,
        name: stock.name || existing?.name || usage?.name || 'Ingrediente',
        unit: stock.unit || existing?.unit || usage?.unit || 'unidad',
        usedByProducts: usage?.usedByProducts.size ?? existing?.usedByProducts ?? 0,
        currentStock: stock.currentStock,
        minStock: stock.minStock,
      });
    });

    ingredientUsageMap.forEach((usage, normalizedKey) => {
      const existing = ingredientRowsByNormalizedKey.get(normalizedKey);

      if (existing) {
        ingredientRowsByNormalizedKey.set(normalizedKey, {
          ...existing,
          usedByProducts: usage.usedByProducts.size,
        });
        return;
      }

      ingredientRowsByNormalizedKey.set(normalizedKey, {
        key: normalizedKey,
        name: usage.name,
        unit: usage.unit,
        usedByProducts: usage.usedByProducts.size,
        currentStock: 0,
        minStock: 0,
      });
    });

    const nextIngredientRows: IngredientInventoryRow[] = Array.from(ingredientRowsByNormalizedKey.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const nextDirectProductStockMap: Record<string, ProductStockBalance> = {};
    directProductStock.forEach((stock) => {
      nextDirectProductStockMap[stock.productId] = stock;
    });

    setProducts(backendProducts);
    setCategories(backendCategories);
    setRecipesByProductId(nextRecipesByProductId);
    setIngredientRows(nextIngredientRows);
    setDirectProductStockMap(nextDirectProductStockMap);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await loadInventoryContext();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo cargar inventario');
      }
    };

    void loadInitialData();
  }, []);

  const getCategoryNames = (categoryIds: string[]) => {
    return categories
      .filter((category) => categoryIds.includes(category.id))
      .map((category) => category.name)
      .join(', ');
  };

  const directProductRows = useMemo<DirectProductInventoryRow[]>(() => {
    return products
      .filter((product) => !recipesByProductId[product.id]?.usesRecipe)
      .map((product) => {
        const stock = directProductStockMap[product.id];

        return {
          productId: product.id,
          productName: product.name,
          categories: getCategoryNames(product.categoryIds ?? []) || 'Sin categorías',
          currentStock: stock?.currentStock ?? 0,
          minStock: stock?.minStock ?? 0,
        };
      })
      .sort((a, b) => a.productName.localeCompare(b.productName, 'es'));
  }, [directProductStockMap, products, recipesByProductId, categories]);

  const unifiedInventoryRows = useMemo<UnifiedInventoryRow[]>(() => {
    const ingredientItems: UnifiedInventoryRow[] = ingredientRows.map((row) => ({
      id: `ingredient:${row.key}`,
      type: 'ingredient',
      name: row.name,
      detail: `Unidad: ${row.unit}`,
      currentStock: row.currentStock,
      minStock: row.minStock,
      price: null,
      usedByProducts: row.usedByProducts,
      ingredient: row,
    }));

    const directItems: UnifiedInventoryRow[] = directProductRows.map((row) => {
      const product = products.find((item) => item.id === row.productId);

      return {
        id: `direct:${row.productId}`,
        type: 'direct',
        name: row.productName,
        detail: row.categories,
        currentStock: row.currentStock,
        minStock: row.minStock,
        price: product?.price ?? 0,
        usedByProducts: null,
        directProduct: row,
      };
    });

    return [...ingredientItems, ...directItems]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [ingredientRows, directProductRows, products]);

  const lowIngredientCount = ingredientRows.filter((row) => row.currentStock <= row.minStock).length;
  const lowDirectProductCount = directProductRows.filter((row) => row.currentStock <= row.minStock).length;

  const openIngredientAdjustDialog = (row: IngredientInventoryRow) => {
    setAdjustTarget({
      type: 'ingredient',
      key: row.key,
      name: row.name,
      unit: row.unit,
    });
    setCurrentStockInput(String(row.currentStock));
    setMinStockInput(String(row.minStock));
    setIsAdjustDialogOpen(true);
  };

  const openProductAdjustDialog = (row: DirectProductInventoryRow) => {
    setAdjustTarget({
      type: 'product',
      productId: row.productId,
      productName: row.productName,
    });
    setCurrentStockInput(String(row.currentStock));
    setMinStockInput(String(row.minStock));
    setIsAdjustDialogOpen(true);
  };

  const saveStockAdjustment = async () => {
    if (!adjustTarget) {
      return;
    }

    const parsedCurrentStock = parseDecimalInput(currentStockInput);
    const parsedMinStock = parseDecimalInput(minStockInput);

    if (!Number.isFinite(parsedCurrentStock) || parsedCurrentStock < 0) {
      toast.error('Ingresá un stock actual válido');
      return;
    }

    if (!Number.isFinite(parsedMinStock) || parsedMinStock < 0) {
      toast.error('Ingresá un stock mínimo válido');
      return;
    }

    if (adjustTarget.type === 'ingredient') {
      try {
        await productApi.upsertIngredientStock({
          name: adjustTarget.name,
          unit: adjustTarget.unit,
          currentStock: parsedCurrentStock,
          minStock: parsedMinStock,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el stock del ingrediente');
        return;
      }

      toast.success('Stock de ingrediente actualizado');
    } else {
      try {
        await productApi.upsertProductStock({
          productId: adjustTarget.productId,
          currentStock: parsedCurrentStock,
          minStock: parsedMinStock,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el stock del producto');
        return;
      }

      toast.success('Stock de producto actualizado');
    }

    await loadInventoryContext();
    setIsAdjustDialogOpen(false);
  };

  const handleCreateIngredient = async () => {
    const trimmedName = ingredientNameInput.trim();
    const trimmedUnit = ingredientUnitInput.trim();
    const parsedCurrentStock = parseDecimalInput(ingredientInitialStockInput);
    const parsedMinStock = parseDecimalInput(ingredientMinStockInput);

    if (!trimmedName) {
      toast.error('Ingresá el nombre del ingrediente');
      return;
    }

    if (!trimmedUnit) {
      toast.error('Ingresá la unidad del ingrediente');
      return;
    }

    if (!Number.isFinite(parsedCurrentStock) || parsedCurrentStock < 0) {
      toast.error('Ingresá un stock inicial válido');
      return;
    }

    if (!Number.isFinite(parsedMinStock) || parsedMinStock < 0) {
      toast.error('Ingresá un stock mínimo válido');
      return;
    }

    try {
      await productApi.createIngredient({
        name: trimmedName,
        unit: trimmedUnit,
        currentStock: parsedCurrentStock,
        minStock: parsedMinStock,
      });
      toast.success('Ingrediente creado');
      setIsCreateIngredientDialogOpen(false);
      setIngredientNameInput('');
      setIngredientUnitInput('unidad');
      setIngredientInitialStockInput('0');
      setIngredientMinStockInput('0');
      await loadInventoryContext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el ingrediente');
    }
  };

  const openConsumeDialog = (target: ConsumeTarget) => {
    setConsumeTarget(target);
    setConsumeQuantityInput('1');
    setIsConsumeDialogOpen(true);
  };

  const handleConsumeInventory = async () => {
    if (!consumeTarget) {
      return;
    }

    const quantity = parseDecimalInput(consumeQuantityInput);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Ingresá una cantidad válida a consumir');
      return;
    }

    try {
      await productApi.consumeProductStock({
        productId: consumeTarget.productId,
        quantity,
      });

      toast.success('Consumo registrado');
      setIsConsumeDialogOpen(false);
      await loadInventoryContext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el consumo');
    }
  };

  const addConsumeOrderLine = () => {
    setConsumeOrderLines((prev) => ([
      ...prev,
      { id: crypto.randomUUID(), productId: '', quantity: '1' },
    ]));
  };

  const removeConsumeOrderLine = (lineId: string) => {
    setConsumeOrderLines((prev) => (
      prev.length <= 1 ? prev : prev.filter((line) => line.id !== lineId)
    ));
  };

  const updateConsumeOrderLine = (lineId: string, field: 'productId' | 'quantity', value: string) => {
    setConsumeOrderLines((prev) => prev.map((line) => (
      line.id === lineId
        ? { ...line, [field]: value }
        : line
    )));
  };

  const handleConsumeOrder = async () => {
    const items = consumeOrderLines
      .map((line) => ({
        productId: line.productId,
        quantity: parseDecimalInput(line.quantity),
      }))
      .filter((line) => line.productId.length > 0 && Number.isFinite(line.quantity) && line.quantity > 0);

    if (items.length === 0) {
      toast.error('Seleccioná al menos un producto con cantidad válida');
      return;
    }

    try {
      await productApi.consumeOrderInventory({ items });
      toast.success('Consumo por pedido aplicado');
      setIsConsumeOrderDialogOpen(false);
      setConsumeOrderLines([{ id: crypto.randomUUID(), productId: '', quantity: '1' }]);
      await loadInventoryContext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar el consumo por pedido');
    }
  };

  const unifiedColumns: DataTableColumn<UnifiedInventoryRow>[] = [
    {
      key: 'type',
      header: 'Tipo',
      accessor: (row) => row.type,
      sortable: true,
      className: 'text-gray-300',
      cell: (row) => (
        <Badge variant="secondary" className={row.type === 'ingredient' ? 'bg-label-info' : 'bg-label-warning'}>
          {row.type === 'ingredient' ? 'Ingrediente' : 'Stock directo'}
        </Badge>
      ),
    },
    {
      key: 'name',
      header: 'Item',
      accessor: (row) => row.name,
      sortable: true,
      className: 'text-white',
      cell: (row) => (
        <div>
          <p className="text-sm text-white">{row.name}</p>
          <p className="text-xs text-gray-400">{row.detail}</p>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Uso',
      accessor: (row) => row.usedByProducts ?? -1,
      sortable: true,
      className: 'text-gray-300',
      cell: (row) => row.type === 'ingredient' ? `${row.usedByProducts ?? 0} productos` : '-',
    },
    {
      key: 'currentStock',
      header: 'Stock actual',
      accessor: (row) => row.currentStock,
      sortable: true,
      className: 'text-gray-300',
    },
    {
      key: 'minStock',
      header: 'Stock mínimo',
      accessor: (row) => row.minStock,
      sortable: true,
      className: 'text-gray-300',
    },
    {
      key: 'price',
      header: 'Precio',
      accessor: (row) => row.price ?? -1,
      sortable: true,
      className: 'text-gray-300',
      cell: (row) => row.type === 'direct' ? currencyFormatter.format(row.price ?? 0) : '-',
    },
    {
      key: 'status',
      header: 'Estado',
      accessor: (row) => row.currentStock <= row.minStock ? 'Bajo' : 'OK',
      sortable: true,
      className: 'text-gray-300',
      cell: (row) => (
        <Badge variant="secondary" className={row.currentStock <= row.minStock ? 'bg-label-danger text-white' : 'bg-label-success text-white'}>
          {row.currentStock <= row.minStock ? 'Bajo' : 'OK'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      accessor: () => '',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (row) => {
        const directProduct = row.directProduct;

        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
              onClick={() => {
                if (row.type === 'ingredient' && row.ingredient) {
                  openIngredientAdjustDialog(row.ingredient);
                  return;
                }

                if (row.type === 'direct' && directProduct) {
                  openProductAdjustDialog(directProduct);
                }
              }}
            >
              Ajustar
            </Button>
            {row.type === 'direct' && directProduct ? (
              <Button
                size="sm"
                className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
                onClick={() => openConsumeDialog({ type: 'product', productId: directProduct.productId, productName: directProduct.productName })}
              >
                Consumir
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-white">Inventario</h1>
            <p className="text-sm text-gray-400">Controla stock de ingredientes y productos sin receta</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="primary-action h-10 rounded-lg px-4"
              onClick={() => setIsCreateIngredientDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Crear ingrediente
            </Button>
            <Button
              size="sm"
              className="ghost-action h-10 rounded-lg px-4"
              onClick={() => setIsConsumeOrderDialogOpen(true)}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Consumir pedido
            </Button>
            <Badge variant="secondary" className="bg-label-secondary text-white">
              <PackageCheck className="h-3.5 w-3.5 mr-1" />
              {ingredientRows.length + directProductRows.length} items
            </Badge>
            <Badge variant="secondary" className={lowIngredientCount + lowDirectProductCount > 0 ? 'bg-label-danger text-white' : 'bg-label-success text-white'}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              {lowIngredientCount + lowDirectProductCount} bajos
            </Badge>
          </div>
        </div>

        <div className="card bg-card p-4">
          <DataTable
            data={unifiedInventoryRows}
            columns={unifiedColumns}
            getRowId={(row) => row.id}
            emptyMessage="No hay items de inventario"
            searchPlaceholder="Buscar item"
            defaultPageSize={10}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      </div>

      <Dialog
        open={isAdjustDialogOpen}
        onOpenChange={(open) => {
          setIsAdjustDialogOpen(open);
          if (!open) {
            setAdjustTarget(null);
          }
        }}
      >
        <DialogContent className="bg-card border-orange-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Ajustar stock
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-orange-700 bg-body p-3 text-sm text-gray-300">
              {adjustTarget?.type === 'ingredient'
                ? `${adjustTarget.name} (${adjustTarget.unit})`
                : adjustTarget?.productName ?? 'Item'}
            </div>

            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Stock actual"
              value={currentStockInput}
              onChange={(event) => setCurrentStockInput(event.target.value)}
            />

            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Stock mínimo"
              value={minStockInput}
              onChange={(event) => setMinStockInput(event.target.value)}
            />

            <Button className="w-full" onClick={() => { void saveStockAdjustment(); }}>
              Guardar stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateIngredientDialogOpen}
        onOpenChange={(open) => {
          setIsCreateIngredientDialogOpen(open);
          if (!open) {
            setIngredientNameInput('');
            setIngredientUnitInput('unidad');
            setIngredientInitialStockInput('0');
            setIngredientMinStockInput('0');
          }
        }}
      >
        <DialogContent className="bg-card border-orange-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Crear ingrediente</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Nombre"
              value={ingredientNameInput}
              onChange={(event) => setIngredientNameInput(event.target.value)}
            />

            <Input
              placeholder="Unidad (kg, lt, unidad...)"
              value={ingredientUnitInput}
              onChange={(event) => setIngredientUnitInput(event.target.value)}
            />

            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Stock inicial"
              value={ingredientInitialStockInput}
              onChange={(event) => setIngredientInitialStockInput(event.target.value)}
            />

            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Stock mínimo"
              value={ingredientMinStockInput}
              onChange={(event) => setIngredientMinStockInput(event.target.value)}
            />

            <Button className="w-full" onClick={() => { void handleCreateIngredient(); }}>
              Crear ingrediente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isConsumeDialogOpen}
        onOpenChange={(open) => {
          setIsConsumeDialogOpen(open);
          if (!open) {
            setConsumeTarget(null);
            setConsumeQuantityInput('1');
          }
        }}
      >
        <DialogContent className="bg-card border-orange-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar consumo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-orange-700 bg-body p-3 text-sm text-gray-300">
              {consumeTarget?.productName ?? 'Producto'}
            </div>

            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Cantidad a consumir"
              value={consumeQuantityInput}
              onChange={(event) => setConsumeQuantityInput(event.target.value)}
            />

            <Button className="w-full" onClick={() => { void handleConsumeInventory(); }}>
              Confirmar consumo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isConsumeOrderDialogOpen}
        onOpenChange={(open) => {
          setIsConsumeOrderDialogOpen(open);
          if (!open) {
            setConsumeOrderLines([{ id: crypto.randomUUID(), productId: '', quantity: '1' }]);
          }
        }}
      >
        <DialogContent className="bg-card border-orange-700 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Consumir inventario por pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {consumeOrderLines.map((line) => (
              <div key={line.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_92px] gap-2">
                <select
                  className="h-10 rounded-md border border-orange-700 bg-body px-3 text-sm text-white"
                  value={line.productId}
                  onChange={(event) => updateConsumeOrderLine(line.id, 'productId', event.target.value)}
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cantidad"
                  value={line.quantity}
                  onChange={(event) => updateConsumeOrderLine(line.id, 'quantity', event.target.value)}
                />
                <Button
                  className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
                  onClick={() => removeConsumeOrderLine(line.id)}
                >
                  Quitar
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between gap-2">
              <Button
                className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
                onClick={addConsumeOrderLine}
              >
                Agregar línea
              </Button>
              <Button onClick={() => { void handleConsumeOrder(); }}>
                Aplicar consumo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
