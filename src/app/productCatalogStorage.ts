export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryIds: string[];
  active: boolean;
  createdAt: string;
}

interface AddCategoryInput {
  name: string;
  description?: string;
}

interface AddProductInput {
  name: string;
  description?: string;
  price: number;
  categoryIds: string[];
  active?: boolean;
}

const PRODUCT_CATEGORIES_STORAGE_KEY = 'mobile_tomatina.productCategories';
const PRODUCTS_STORAGE_KEY = 'mobile_tomatina.products';
export const PRODUCT_CATALOG_UPDATED_EVENT = 'mobile_tomatina.productCatalogUpdated';

const initialCategories: ProductCategory[] = [
  { id: 'cat-bebidas', name: 'Bebidas', description: 'Gaseosas, agua y jugos', createdAt: '2026-03-04T00:00:00.000Z' },
  { id: 'cat-principales', name: 'Platos principales', description: 'Comidas principales', createdAt: '2026-03-04T00:00:00.000Z' },
];

const initialProducts: ProductItem[] = [
  {
    id: 'prod-1',
    name: 'Milanesa napolitana',
    description: 'Con papas fritas',
    price: 12200,
    categoryIds: ['cat-principales'],
    active: true,
    createdAt: '2026-03-04T00:00:00.000Z',
  },
  {
    id: 'prod-2',
    name: 'Agua sin gas',
    price: 2200,
    categoryIds: ['cat-bebidas'],
    active: true,
    createdAt: '2026-03-04T00:00:00.000Z',
  },
];

let inMemoryCategories: ProductCategory[] = [...initialCategories];
let inMemoryProducts: ProductItem[] = [...initialProducts];

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const notifyCatalogUpdated = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(PRODUCT_CATALOG_UPDATED_EVENT));
};

const persistCategories = (categories: ProductCategory[]) => {
  inMemoryCategories = categories;

  if (canUseStorage()) {
    window.localStorage.setItem(PRODUCT_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  }
};

const persistProducts = (products: ProductItem[]) => {
  inMemoryProducts = products;

  if (canUseStorage()) {
    window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  }
};

const initCategories = () => {
  if (!canUseStorage()) {
    return inMemoryCategories;
  }

  const raw = window.localStorage.getItem(PRODUCT_CATEGORIES_STORAGE_KEY);

  if (!raw) {
    persistCategories(initialCategories);
    return initialCategories;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      persistCategories(initialCategories);
      return initialCategories;
    }

    inMemoryCategories = parsed as ProductCategory[];
    return inMemoryCategories;
  } catch {
    persistCategories(initialCategories);
    return initialCategories;
  }
};

const initProducts = () => {
  if (!canUseStorage()) {
    return inMemoryProducts;
  }

  const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);

  if (!raw) {
    persistProducts(initialProducts);
    return initialProducts;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      persistProducts(initialProducts);
      return initialProducts;
    }

    inMemoryProducts = parsed as ProductItem[];
    return inMemoryProducts;
  } catch {
    persistProducts(initialProducts);
    return initialProducts;
  }
};

export const getProductCategories = () => initCategories();
export const getProducts = () => initProducts();

export const addProductCategory = ({ name, description }: AddCategoryInput) => {
  const categories = getProductCategories();

  const nextCategory: ProductCategory = {
    id: `cat-${Date.now()}`,
    name,
    description,
    createdAt: new Date().toISOString(),
  };

  persistCategories([nextCategory, ...categories]);
  notifyCatalogUpdated();
  return nextCategory;
};

export const updateProductCategory = (categoryId: string, updater: (category: ProductCategory) => ProductCategory) => {
  const nextCategories = getProductCategories().map((category) => (
    category.id === categoryId ? updater(category) : category
  ));

  persistCategories(nextCategories);
  notifyCatalogUpdated();
};

export const removeProductCategory = (categoryId: string) => {
  const nextCategories = getProductCategories().filter((category) => category.id !== categoryId);
  const nextProducts = getProducts().map((product) => ({
    ...product,
    categoryIds: product.categoryIds.filter((id) => id !== categoryId),
  }));

  persistCategories(nextCategories);
  persistProducts(nextProducts);
  notifyCatalogUpdated();
};

export const addProduct = ({ name, description, price, categoryIds, active = true }: AddProductInput) => {
  const products = getProducts();

  const nextProduct: ProductItem = {
    id: `prod-${Date.now()}`,
    name,
    description,
    price,
    categoryIds,
    active,
    createdAt: new Date().toISOString(),
  };

  persistProducts([nextProduct, ...products]);
  notifyCatalogUpdated();
  return nextProduct;
};

export const updateProduct = (productId: string, updater: (product: ProductItem) => ProductItem) => {
  const nextProducts = getProducts().map((product) => (
    product.id === productId ? updater(product) : product
  ));

  persistProducts(nextProducts);
  notifyCatalogUpdated();
};

export const removeProduct = (productId: string) => {
  const nextProducts = getProducts().filter((product) => product.id !== productId);

  persistProducts(nextProducts);
  notifyCatalogUpdated();
};
