import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import {
  createPublicStoreOrder,
  fetchPublicStore,
  fetchPublicStoreProducts,
  type PublicStoreInfo,
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
  const [isLoading, setIsLoading] = useState(false);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const cartItems = products
    .map((product) => ({
      ...product,
      quantity: cartQuantities[product.id] ?? 0,
    }))
    .filter((product) => product.quantity > 0);

  const cartItemsCount = cartItems.reduce((accumulator, product) => accumulator + product.quantity, 0);
  const cartTotal = cartItems.reduce((accumulator, product) => accumulator + (product.price * product.quantity), 0);

  const loadStore = async () => {
    if (!slug) {
      return;
    }

    setIsLoading(true);

    try {
      const [storeData, productsData] = await Promise.all([
        fetchPublicStore(slug),
        fetchPublicStoreProducts(slug),
      ]);

      setStore(storeData);
      setProducts(productsData.filter((product) => product.available));
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

  return (
    <div className="min-h-screen bg-body text-white">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <header className="rounded-lg border border-gray-700 bg-card p-4 md:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">{store?.name ?? 'Tienda'}</h1>
              <p className="text-sm text-gray-400 mt-1">{store?.description ?? `Slug: ${slug}`}</p>
            </div>
            <Badge variant="secondary" className="bg-label-info text-white">
              {products.length} productos
            </Badge>
          </div>
        </header>

        {isLoading ? (
          <div className="rounded-lg border border-gray-700 bg-card p-4 text-sm text-gray-400">
            Cargando tienda...
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section className="lg:col-span-2 rounded-lg border border-gray-700 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">Catalogo</h2>
            </div>

            {products.length === 0 ? (
              <div className="rounded-lg border border-gray-700 bg-body p-4 text-sm text-gray-400">
                No hay productos disponibles.
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((product) => (
                  <div key={product.id} className="rounded-lg border border-gray-700 bg-body p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      {product.description ? (
                        <p className="text-xs text-gray-400 break-words">{product.description}</p>
                      ) : null}
                      <p className="text-xs text-gray-300 mt-1">{currencyFormatter.format(product.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => decrementProduct(product.id)}
                        disabled={(cartQuantities[product.id] ?? 0) === 0}
                      >
                        -
                      </Button>
                      <span className="w-6 text-center text-sm">{cartQuantities[product.id] ?? 0}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => incrementProduct(product.id)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-gray-700 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-gray-300">Tu compra</h2>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={clearCart}
                disabled={cartItemsCount === 0}
              >
                Limpiar
              </Button>
            </div>

            <p className="text-xs text-gray-400">
              {cartItemsCount} items · Total: {currencyFormatter.format(cartTotal)}
            </p>

            <div className="space-y-2 max-h-32 overflow-y-auto">
              {cartItems.length === 0 ? (
                <p className="text-xs text-gray-500">No agregaste productos aun</p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="text-xs text-gray-300 flex items-center justify-between gap-2">
                    <span className="truncate">{item.name} x{item.quantity}</span>
                    <span>{currencyFormatter.format(item.price * item.quantity)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-700">
              <Input
                placeholder="Tu nombre"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
              <Input
                placeholder="Tu telefono"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
              />
              <Select value={orderType} onValueChange={(value) => setOrderType(value as 'delivery' | 'pickup')}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de entrega" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="pickup">Retiro en tienda</SelectItem>
                </SelectContent>
              </Select>
              {orderType === 'delivery' ? (
                <Input
                  placeholder="Direccion de entrega"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                />
              ) : null}
              <Input
                placeholder="Notas (opcional)"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />

              <Button className="w-full" onClick={() => void handleCreateOrder()} disabled={isCreatingOrder}>
                {isCreatingOrder ? 'Procesando...' : 'Confirmar compra'}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
