import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  listProductCategories,
  productApi,
  type ProductCategory,
  type ProductItem,
  type ProductRecipeConfig,
} from '../services/products.service';

type RecipeIngredientDraft = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
};

const normalizeInventoryUnit = (unit: string | null | undefined) => {
  const normalized = String(unit ?? 'unidad').trim().toLowerCase();
  if (normalized === 'g') return 'gr';
  if (normalized === 'l') return 'lt';
  if (['unidad', 'kg', 'gr', 'lt', 'ml'].includes(normalized)) return normalized;
  return 'unidad';
};

const readFileAsDataUrl = (file: File): Promise<string> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('No se pudo leer la imagen seleccionada'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('No se pudo leer la imagen seleccionada'));
    };

    reader.readAsDataURL(file);
  })
);

const normalizeProductCategoryIds = (product: ProductItem): string[] => {
  const row = product as ProductItem & {
    category_ids?: Array<string | number>;
    categoryId?: string | number;
    categoryIds?: Array<string | number>;
  };

  const collected: Array<string | number> = [];

  if (Array.isArray(row.categoryIds)) {
    collected.push(...row.categoryIds);
  }

  if (Array.isArray(row.category_ids)) {
    collected.push(...row.category_ids);
  }

  if (row.categoryId !== undefined && row.categoryId !== null && row.categoryId !== '') {
    collected.push(row.categoryId);
  }

  return [...new Set(collected.map((value) => String(value).trim()).filter(Boolean))];
};

export function useProductsViewModel() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [recipesByProductId, setRecipesByProductId] = useState<Record<string, ProductRecipeConfig>>({});
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState<ProductItem | null>(null);
  const [recipeUsesIngredients, setRecipeUsesIngredients] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientDraft[]>([]);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  const loadCatalog = async () => {
    const [backendProducts, backendCategoriesResult, backendRecipes] = await Promise.all([
      productApi.listProductsLegacy(),
      listProductCategories({ page: 1, pageSize: 200 }),
      productApi.listProductRecipes(),
    ]);

    setProducts(backendProducts);
    setCategories(backendCategoriesResult.rows);
    setRecipesByProductId(() => {
      const nextRecipesByProductId: Record<string, ProductRecipeConfig> = {};

      backendProducts.forEach((product) => {
        if (product.usesRecipe || product.type === 'recipe') {
          nextRecipesByProductId[String(product.id)] = {
            productId: String(product.id),
            usesRecipe: true,
            ingredients: [],
          };
        }
      });

      backendRecipes.forEach((recipe) => {
        nextRecipesByProductId[String(recipe.productId)] = {
          ...recipe,
          usesRecipe: recipe.usesRecipe,
        };
      });

      return nextRecipesByProductId;
    });
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
        unit: normalizeInventoryUnit(ingredient.unit),
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
          unit: normalizeInventoryUnit(ingredient.unit),
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
    if (isSavingRecipe) {
      return;
    }

    if (!recipeProduct) {
      return;
    }

    const normalizedIngredients = recipeIngredients
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity: Number(ingredient.quantity.replace(',', '.')),
        unit: normalizeInventoryUnit(ingredient.unit),
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
      setIsSavingRecipe(true);
      savedRecipe = await productApi.saveProductRecipe({
        productId: recipeProduct.id,
        usesRecipe: recipeUsesIngredients,
        ingredients: normalizedIngredients,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la receta');
      return;
    } finally {
      setIsSavingRecipe(false);
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
    setImageBase64(null);
    setImagePreviewUrl(null);
    setSelectedCategoryIds([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: ProductItem) => {
    const productWithImage = product as ProductItem & { imageUrl?: string; image_url?: string };

    setEditingProductId(product.id);
    setName(product.name);
    setDescription(product.description ?? '');
    setPrice(String(product.price));
    setImageBase64(null);
    setImagePreviewUrl(productWithImage.image ?? productWithImage.imageUrl ?? productWithImage.image_url ?? null);
    setSelectedCategoryIds(normalizeProductCategoryIds(product));
    setIsDialogOpen(true);
  };

  const handleProductImageChange = async (file: File | null) => {
    if (!file) {
      setImageBase64(null);
      setImagePreviewUrl(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Seleccioná un archivo de imagen válido');
      return;
    }

    try {
      const base64Image = await readFileAsDataUrl(file);
      setImageBase64(base64Image);
      setImagePreviewUrl(base64Image);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo procesar la imagen');
    }
  };

  const clearSelectedProductImage = () => {
    setImageBase64(null);
    setImagePreviewUrl(null);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) => (
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    ));
  };

  const removeCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) => prev.filter((id) => id !== categoryId));
  };

  const handleSaveProduct = async () => {
    if (isSavingProduct) {
      return;
    }

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
      setIsSavingProduct(true);
      if (editingProductId) {
        await productApi.updateProduct(editingProductId, {
          name: trimmedName,
          description: description.trim() || undefined,
          price: parsedPrice,
          image: imageBase64 ?? undefined,
          categoryIds: selectedCategoryIds,
          categoryId: selectedCategoryIds[0],
        });
        toast.success('Producto actualizado');
      } else {
        await productApi.createProduct({
          name: trimmedName,
          description: description.trim() || undefined,
          price: parsedPrice,
          image: imageBase64 ?? undefined,
          categoryIds: selectedCategoryIds,
          categoryId: selectedCategoryIds[0],
        });
        toast.success('Producto creado');
      }

      await loadCatalog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el producto');
      return;
    } finally {
      setIsSavingProduct(false);
    }

    setIsDialogOpen(false);
    setEditingProductId(null);
  };

  const handleDeleteProduct = async (product: ProductItem) => {
    try {
      await productApi.deleteProduct(product.id);
      await loadCatalog();
      toast.success('Producto eliminado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el producto');
    }
  };

  return {
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
    isSavingProduct,
    isSavingRecipe,
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
    setRecipeProduct,       // agregar
  setRecipeIngredients,
  };
}
