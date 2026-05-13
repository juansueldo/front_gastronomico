import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Clock3, Instagram, Mail, MapPin, MessageCircle, Phone, Search, Store } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import {
  createPublicStoreOrder,
  fetchPublicStoreCatalog,
  fetchPublicStore,
  type PublicStoreInfo,
  type PublicStoreHeadquarter,
  type PublicStoreProduct,
} from '../storefrontApi';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function PublicStorefrontView() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [store, setStore] = useState<PublicStoreInfo | null>(null);
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [headquarters, setHeadquarters] = useState<PublicStoreHeadquarter[]>([]);
  const [categoriesById, setCategoriesById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [storeDefaultHeadquarterId, setStoreDefaultHeadquarterId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const categoryEntries = useMemo(
    () => Object.entries(categoriesById).sort(([, leftName], [, rightName]) => leftName.localeCompare(rightName, 'es')),
    [categoriesById],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const categoryMatch = selectedCategoryId === 'all' || product.categoryIds.includes(selectedCategoryId);

      if (!categoryMatch) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const categoryLabel = product.categoryIds
        .map((categoryId) => categoriesById[categoryId] ?? '')
        .join(' ')
        .toLowerCase();

      return (
        product.name.toLowerCase().includes(normalizedSearch)
        || String(product.description ?? '').toLowerCase().includes(normalizedSearch)
        || categoryLabel.includes(normalizedSearch)
      );
    });
  }, [products, selectedCategoryId, searchTerm, categoriesById]);

  const cartItems = products
    .map((product) => ({
      ...product,
      quantity: cartQuantities[product.id] ?? 0,
    }))
    .filter((product) => product.quantity > 0);

  const cartItemsCount = cartItems.reduce((accumulator, product) => accumulator + product.quantity, 0);
  const cartTotal = cartItems.reduce((accumulator, product) => accumulator + (product.price * product.quantity), 0);

  const pickupHeadquarter = headquarters.find((headquarter) => headquarter.id === selectedHeadquarterId);
  const fallbackHeadquarter = headquarters.find((headquarter) => headquarter.id === storeDefaultHeadquarterId) ?? headquarters[0];

  const loadStore = async () => {
    if (!slug) {
      return;
    }

    setIsLoading(true);

    try {
      const [storeData, productsData] = await Promise.all([
        fetchPublicStore(slug),
        fetchPublicStoreCatalog(slug),
      ]);

      setStore(storeData);
      const nextProducts = productsData.products.filter((product) => product.available);
      setProducts(nextProducts);

      const mergedHeadquartersMap = new Map<string, PublicStoreHeadquarter>();

      [...(storeData.pickupHeadquarters ?? []), ...productsData.headquarters].forEach((headquarter) => {
        if (!mergedHeadquartersMap.has(headquarter.id)) {
          mergedHeadquartersMap.set(headquarter.id, headquarter);
        }
      });

      const mergedHeadquarters = Array.from(mergedHeadquartersMap.values());
      setHeadquarters(mergedHeadquarters);

      const nextDefaultHeadquarterId = (
        storeData.defaultHeadquarterId
        ?? productsData.defaultHeadquarterId
        ?? mergedHeadquarters[0]?.id
        ?? ''
      );

      setStoreDefaultHeadquarterId(nextDefaultHeadquarterId);
      setSelectedHeadquarterId((current) => {
        if (current && mergedHeadquarters.some((headquarter) => headquarter.id === current)) {
          return current;
        }

        return nextDefaultHeadquarterId;
      });

      const categoryMap: Record<string, string> = {};
      productsData.categories.forEach((category) => {
        categoryMap[category.id] = category.name;
      });

      nextProducts.forEach((product) => {
        product.categoryIds.forEach((categoryId) => {
          if (!categoryMap[categoryId]) {
            categoryMap[categoryId] = `Categoria ${categoryId}`;
          }
        });
      });

      setCategoriesById(categoryMap);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la tienda');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStore();
  }, [slug]);

  const incrementProduct = (productId: string) => {
    setCartQuantities((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? 0) + 1,
    }));
  };

  const decrementProduct = (productId: string) => {
    setCartQuantities((prev) => {
      const currentQuantity = prev[productId] ?? 0;

      if (currentQuantity <= 1) {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [productId]: currentQuantity - 1,
      };
    });
  };

  const clearCart = () => {
    setCartQuantities({});
  };

  const handleCreateOrder = async () => {
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const trimmedAddress = deliveryAddress.trim();
    const trimmedNotes = notes.trim();

    if (!slug) {
      toast.error('No se encontro el slug de la tienda');
      return;
    }

    if (!trimmedName) {
      toast.error('Ingresa tu nombre');
      return;
    }

    if (!trimmedPhone) {
      toast.error('Ingresa tu telefono');
      return;
    }

    if (orderType === 'delivery' && !trimmedAddress) {
      toast.error('Ingresa la direccion para delivery');
      return;
    }

    if (cartItemsCount === 0) {
      toast.error('Agrega al menos un producto al carrito');
      return;
    }

    if (orderType === 'pickup') {
      if (headquarters.length === 0) {
        toast.error('No hay sedes disponibles para retiro');
        return;
      }

      if (!selectedHeadquarterId) {
        toast.error('Selecciona la sede para retirar tu pedido');
        return;
      }
    }

    setIsCreatingOrder(true);

    try {
      const productIds = cartItems.flatMap((product) => (
        Array.from({ length: product.quantity }, () => product.id)
      ));
      const items = cartItems.map((product) => (
        product.quantity > 1 ? `${product.name} x${product.quantity}` : product.name
      ));

      await createPublicStoreOrder(slug, {
        customerName: trimmedName,
        phone: trimmedPhone,
        type: orderType,
        address: orderType === 'delivery' ? trimmedAddress : undefined,
        notes: trimmedNotes || undefined,
        total: cartTotal,
        productIds,
        items,
        headquarterId: orderType === 'pickup' ? selectedHeadquarterId : undefined,
      });

      toast.success('Compra creada con exito');
      clearCart();
      setNotes('');
      if (orderType === 'delivery') {
        setDeliveryAddress('');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la compra');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const logoText = (store?.name ?? slug ?? 'T')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#e6e6e6] text-[#2f2f2f]">
      <section className="relative overflow-hidden bg-[#6f6f72] pb-24 text-white">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_15px_15px,rgba(255,255,255,0.26)_2px,transparent_2px),radial-gradient(circle_at_45px_45px,rgba(255,255,255,0.15)_2px,transparent_2px)] bg-[length:60px_60px]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-8 md:px-6 md:pt-10">
          <div className="grid gap-6 md:grid-cols-[1.5fr_1fr_1fr]">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 shrink-0 rounded-full bg-black/80 shadow-xl ring-2 ring-white/20 flex items-center justify-center">
                <span className="text-xl font-semibold tracking-widest text-amber-300">{logoText}</span>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight">{store?.name ?? 'Tienda'}</h1>
                <p className="mt-1 text-sm text-white/80">{store?.description ?? `Slug: ${slug}`}</p>
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-300/30 px-3 py-1 text-xs font-medium text-emerald-100">
                  <Clock3 className="h-3.5 w-3.5" />
                  Disponible
                </p>
              </div>
            </div>

            <div className="space-y-2 border-white/20 md:border-l md:pl-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Contacto</p>
              <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4" /> {fallbackHeadquarter?.phone ?? 'Sin telefono'}</p>
              <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" /> {`${slug}@tienda.com`}</p>
              <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" /> {fallbackHeadquarter?.location ?? 'Retiro en sede'}</p>
            </div>

            <div className="space-y-2 border-white/20 md:border-l md:pl-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Canales</p>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-white text-[#ff5a2f] shadow flex items-center justify-center">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="h-11 w-11 rounded-full bg-white text-[#ff5a2f] shadow flex items-center justify-center">
                  <Instagram className="h-5 w-5" />
                </div>
                <div className="h-11 w-11 rounded-full bg-white text-[#ff5a2f] shadow flex items-center justify-center">
                  <Store className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs text-white/80">Atencion por redes y retiro en tienda.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-12 max-w-6xl px-4 pb-10 md:px-6">
        <section className="mx-auto mb-5 max-w-2xl rounded-2xl border border-black/10 bg-[#f8f8f8] p-4 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setOrderType('delivery')}
              className={`h-11 rounded-xl text-base transition ${orderType === 'delivery' ? 'bg-[#3f4044] text-white' : 'bg-transparent text-[#454545] hover:bg-[#ececec]'}`}
            >
              Delivery
            </Button>
            <Button
              type="button"
              onClick={() => setOrderType('pickup')}
              className={`h-11 rounded-xl text-base transition ${orderType === 'pickup' ? 'bg-[#3f4044] text-white' : 'bg-transparent text-[#454545] hover:bg-[#ececec]'}`}
            >
              Para retirar
            </Button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-[#dddddd] bg-white px-3 py-2 text-sm text-[#5f5f5f]">
              Horario de entrega:
              <p className="font-semibold text-[#313131]">Lo antes posible</p>
            </div>
            {orderType === 'pickup' ? (
              <Select
                value={selectedHeadquarterId}
                onValueChange={setSelectedHeadquarterId}
                disabled={headquarters.length === 0}
              >
                <SelectTrigger className="h-full border-[#dddddd] bg-white">
                  <SelectValue placeholder={headquarters.length === 0 ? 'Sin sedes disponibles' : 'Sede de retiro'} />
                </SelectTrigger>
                <SelectContent>
                  {headquarters.map((headquarter) => (
                    <SelectItem key={headquarter.id} value={headquarter.id}>
                      {headquarter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Direccion para delivery"
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                className="h-full border-[#dddddd] bg-white"
              />
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-[#f1f1f1] p-4 shadow-xl md:p-7">
          {isLoading ? (
            <div className="rounded-xl border border-[#dddddd] bg-white p-4 text-sm text-[#666666]">
              Cargando tienda...
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-2xl border border-[#dfdfdf] bg-white p-4 md:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6a6a6a]" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-11 border-[#d2d2d2] bg-[#f9f9f9] pl-10 text-[#333333] placeholder:text-[#7b7b7b]"
                  placeholder="Buscar por productos"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-b border-[#ececec] pb-4">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('all')}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold uppercase transition ${
                    selectedCategoryId === 'all'
                      ? 'border-[#ff5a2f] bg-[#ff5a2f] text-white'
                      : 'border-[#dedede] bg-white text-[#4f4f4f] hover:border-[#ff8d72] hover:text-[#ff5a2f]'
                  }`}
                >
                  Todas
                </button>
                {categoryEntries.map(([categoryId, categoryName]) => (
                  <button
                    key={categoryId}
                    type="button"
                    onClick={() => setSelectedCategoryId(categoryId)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold uppercase transition ${
                      selectedCategoryId === categoryId
                        ? 'border-[#ff5a2f] bg-[#ff5a2f] text-white'
                        : 'border-[#dedede] bg-white text-[#4f4f4f] hover:border-[#ff8d72] hover:text-[#ff5a2f]'
                    }`}
                  >
                    {categoryName}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <h2 className="text-xl font-black uppercase tracking-wide text-[#2f2f2f]">
                  {selectedCategoryId === 'all' ? 'Catalogo' : (categoriesById[selectedCategoryId] ?? 'Categoria')}
                </h2>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="mt-4 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#777777]">
                  No hay productos disponibles para este filtro.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {filteredProducts.map((product) => (
                    <article key={product.id} className="rounded-xl border border-[#e4e4e4] bg-[#fbfbfb] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <p className="text-base font-bold text-[#303030]">{product.name}</p>
                      {product.description ? (
                        <p className="mt-1 min-h-10 text-xs text-[#656565]">{product.description}</p>
                      ) : (
                        <p className="mt-1 min-h-10 text-xs text-[#9a9a9a]">Sin descripcion</p>
                      )}
                      <p className="mt-2 text-sm font-semibold text-[#3d3d3d]">{currencyFormatter.format(product.price)}</p>

                      {product.categoryIds.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {product.categoryIds.map((categoryId) => (
                            <span key={`${product.id}-${categoryId}`} className="rounded-full bg-[#ffe5dd] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#ff5a2f]">
                              {categoriesById[categoryId] ?? `Categoria ${categoryId}`}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => decrementProduct(product.id)}
                          disabled={(cartQuantities[product.id] ?? 0) === 0}
                          className="h-8 w-8 rounded-full border border-[#d4d4d4] bg-white text-lg leading-none text-[#4b4b4b] transition hover:border-[#ff5a2f] hover:text-[#ff5a2f] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-[#404040]">{cartQuantities[product.id] ?? 0}</span>
                        <button
                          type="button"
                          onClick={() => incrementProduct(product.id)}
                          className="h-8 w-8 rounded-full border border-[#ff5a2f] bg-[#ff5a2f] text-lg leading-none text-white transition hover:bg-[#e94d26]"
                        >
                          +
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className="h-fit rounded-2xl border border-[#dedede] bg-white p-4 md:sticky md:top-4">
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-extrabold leading-none text-[#303030]">Mi pedido</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#5b5b5b]"
                  onClick={clearCart}
                  disabled={cartItemsCount === 0}
                >
                  Limpiar
                </Button>
              </div>
              <div className="mt-4 h-px bg-[#e9e9e9]" />

              <div className="mt-3 rounded-lg bg-[#fafafa] p-3 text-sm text-[#565656]">
                {cartItemsCount} items
                <p className="text-base font-bold text-[#313131]">Total: {currencyFormatter.format(cartTotal)}</p>
                {orderType === 'pickup' && (pickupHeadquarter || fallbackHeadquarter) ? (
                  <p className="mt-1 text-xs text-[#666666]">
                    Retiro en: {(pickupHeadquarter ?? fallbackHeadquarter)?.name}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
                {cartItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#dddddd] p-4 text-center text-xs text-[#8a8a8a]">
                    Tu carrito esta vacio.
                  </p>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#ededed] px-2 py-1.5 text-sm">
                      <span className="truncate text-[#4a4a4a]">{item.name} x{item.quantity}</span>
                      <span className="font-semibold text-[#2f2f2f]">{currencyFormatter.format(item.price * item.quantity)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 space-y-2">
                <Input
                  placeholder="Tu nombre"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="border-[#d8d8d8] bg-[#fafafa]"
                />
                <Input
                  placeholder="Tu telefono"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className="border-[#d8d8d8] bg-[#fafafa]"
                />
                {orderType === 'pickup' ? (
                  <Select
                    value={selectedHeadquarterId}
                    onValueChange={setSelectedHeadquarterId}
                    disabled={headquarters.length === 0}
                  >
                    <SelectTrigger className="border-[#d8d8d8] bg-[#fafafa]">
                      <SelectValue placeholder={headquarters.length === 0 ? 'Sin sedes disponibles' : 'Sede de retiro'} />
                    </SelectTrigger>
                    <SelectContent>
                      {headquarters.map((headquarter) => (
                        <SelectItem key={headquarter.id} value={headquarter.id}>
                          {headquarter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  placeholder="Notas (opcional)"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="border-[#d8d8d8] bg-[#fafafa]"
                />

                <Button
                  className="h-11 w-full bg-[#ff5a2f] text-white hover:bg-[#ed4f25]"
                  onClick={() => void handleCreateOrder()}
                  disabled={isCreatingOrder || isLoading}
                >
                  {isCreatingOrder ? 'Procesando...' : 'Confirmar compra'}
                </Button>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
