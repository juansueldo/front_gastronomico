import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { getLoggedUser } from '../../authStorage';
import {
  ApiError,
  checkDeliveryZonePoint,
  createOrder as createBackendOrder,
  type CreateOrderRequest,
  type ProductCategory,
  type ProductItem,
} from '../../api';
import { endpoints } from '../../api/endpoints';
import { listHeadquarters, type Headquarter } from '../../api/headquarter';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type OrderType = 'delivery' | 'dine-in';
type Step = 'phone' | 'customer' | 'type' | 'address' | 'products' | 'confirm';

interface CustomerData {
  id?: number;
  name: string;
  phone: string;
  savedAddress?: SavedAddress;
  orderHistory?: OrderHistoryItem[];
}

interface SavedAddress {
  street: string;
  number: string;
  locality: string;
  crossStreets?: string;
  latitude?: number;
  longitude?: number;
  formatted: string;
}

interface OrderHistoryItem {
  id: string;
  date: string;
  total: string;
  items: string[];
}

interface Locality {
  id: string;
  name: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
  };
}

interface GeocodedPoint {
  latitude: number;
  longitude: number;
  formatted: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  availableProducts: ProductItem[];
  availableCategories: ProductCategory[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const ORDER_HEADQUARTER_STORAGE_KEY = 'cash:selected-headquarter-id';

const getStoredHeadquarterId = () => {
  try {
    return localStorage.getItem(ORDER_HEADQUARTER_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

function getNormalizedProductCategoryIds(product: ProductItem): string[] {
  const row = product as ProductItem & {
    categoryId?: string | number;
    category_id?: string | number;
    category_ids?: Array<string | number>;
    categories?: Array<{ id?: string | number; categoryId?: string | number }>;
  };

  const collected: Array<string | number> = [];

  if (Array.isArray(row.categoryIds)) collected.push(...row.categoryIds);
  if (Array.isArray(row.category_ids)) collected.push(...row.category_ids);
  if (row.categoryId !== undefined && row.categoryId !== null) collected.push(row.categoryId);
  if (row.category_id !== undefined && row.category_id !== null) collected.push(row.category_id);

  if (Array.isArray(row.categories)) {
    row.categories.forEach((category) => {
      const categoryRef = category?.id ?? category?.categoryId;
      if (categoryRef !== undefined && categoryRef !== null) {
        collected.push(categoryRef);
      }
    });
  }

  return [...new Set(collected.map((value) => String(value).trim()).filter(Boolean))];
}

async function geocodeStructuredAddress(
  street: string,
  number: string,
  locality: string,
): Promise<GeocodedPoint | null> {
  const query = `${street} ${number}, ${locality}, Argentina`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult[];
    if (!data.length) return null;

    const lat = Number(data[0].lat);
    const lon = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { latitude: lat, longitude: lon, formatted: data[0].display_name };
  } catch {
    return null;
  }
}

async function fetchCrossStreetSuggestions(
  street: string,
  locality: string,
): Promise<string[]> {
  // Buscamos intersecciones con Nominatim usando el nombre de la calle
  const query = `${street}, ${locality}, Argentina`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(query)}&addressdetails=1`;

  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];

    // Extraemos nombres de calles cercanas del campo display_name
    const streets = data
      .map((r) => {
        const parts = r.display_name.split(',');
        return parts[0]?.trim() ?? '';
      })
      .filter((s) => s && s !== street)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 5);

    return streets;
  } catch {
    return [];
  }
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`h-1.5 w-6 rounded-full transition-all duration-300 ${
              i <= idx ? 'bg-orange-500' : 'bg-gray-700'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 mb-1">{children}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-white mb-3">{children}</p>;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CreateOrderDialog({ open, onClose, onCreated, availableProducts, availableCategories }: Props) {
  // Paso actual
  const [step, setStep] = useState<Step>('phone');

  // Paso 1 — Teléfono
  const [phone, setPhone] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerFound, setCustomerFound] = useState<CustomerData | null>(null);
  const [customerNotFound, setCustomerNotFound] = useState(false);

  // Paso 2 — Datos del cliente (si es nuevo)
  const [newCustomerName, setNewCustomerName] = useState('');

  // Paso 3 — Tipo de orden
  const [orderType, setOrderType] = useState<OrderType>('delivery');

  // Paso 4 — Dirección estructurada
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
  const [selectedLocality, setSelectedLocality] = useState('');
  const [streetName, setStreetName] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [crossStreets, setCrossStreets] = useState('');
  const [crossStreetSuggestions, setCrossStreetSuggestions] = useState<string[]>([]);
  const [isLoadingCrossStreets, setIsLoadingCrossStreets] = useState(false);
  const [showCrossStreetSuggestions, setShowCrossStreetSuggestions] = useState(false);
  const [geocodedPoint, setGeocodedPoint] = useState<GeocodedPoint | null>(null);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [addressZoneStatus, setAddressZoneStatus] = useState<'idle' | 'valid' | 'outside' | 'error'>('idle');

  // Paso 5 — Productos
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Misc
  const [newOrderUserId, setNewOrderUserId] = useState('');
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState(() => getStoredHeadquarterId());
  const [isLoadingHeadquarters, setIsLoadingHeadquarters] = useState(false);
  const [newOrderTableId, setNewOrderTableId] = useState('');
  const [newOrderWaiterId, setNewOrderWaiterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const crossStreetDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const STEPS: Step[] = ['phone', 'customer', 'type', 'address', 'products', 'confirm'];
  const STEPS_DINE_IN: Step[] = ['phone', 'customer', 'type', 'products', 'confirm'];

  const activeSteps = orderType === 'delivery' ? STEPS : STEPS_DINE_IN;

  // ── Efectos ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const loggedUser = getLoggedUser();
    if (loggedUser?.id) setNewOrderUserId(String(loggedUser.id));
    const userHeadquarterId = Number(loggedUser?.headquarterId);
    if (Number.isInteger(userHeadquarterId) && userHeadquarterId > 0) {
      setSelectedHeadquarterId(String(userHeadquarterId));
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadHeadquarters = async () => {
      setIsLoadingHeadquarters(true);
      try {
        const result = await listHeadquarters({ page: 1, pageSize: 100 });
        const rows = result.rows ?? [];
        setHeadquarters(rows);

        if (rows.length === 0) {
          setSelectedHeadquarterId('');
          return;
        }

        const userHeadquarterId = Number(getLoggedUser()?.headquarterId);
        const userHeadquarterAsText = Number.isInteger(userHeadquarterId) && userHeadquarterId > 0
          ? String(userHeadquarterId)
          : '';
        const storedHeadquarterId = getStoredHeadquarterId();
        const currentIsValid = selectedHeadquarterId && rows.some((item) => String(item.id) === selectedHeadquarterId);
        const userIsValid = userHeadquarterAsText && rows.some((item) => String(item.id) === userHeadquarterAsText);
        const storedIsValid = storedHeadquarterId && rows.some((item) => String(item.id) === storedHeadquarterId);

        const initialHeadquarterId = currentIsValid
          ? selectedHeadquarterId
          : userIsValid
            ? userHeadquarterAsText
            : storedIsValid
              ? storedHeadquarterId
              : String(rows[0].id);

        setSelectedHeadquarterId(initialHeadquarterId);
      } catch {
        toast.error('No se pudieron cargar las sedes');
      } finally {
        setIsLoadingHeadquarters(false);
      }
    };

    void loadHeadquarters();
  }, [open]);

  useEffect(() => {
    try {
      if (selectedHeadquarterId) {
        localStorage.setItem(ORDER_HEADQUARTER_STORAGE_KEY, selectedHeadquarterId);
      }
    } catch {
      // noop
    }
  }, [selectedHeadquarterId]);

  // Cargar localidades cuando llegamos al paso address
  useEffect(() => {
    if (step !== 'address') return;
    setIsLoadingLocalities(true);

    endpoints
      .fetchLocalities?.()
      .then((data: Locality[]) => setLocalities(data ?? []))
      .catch(() => toast.error('No se pudieron cargar las localidades'))
      .finally(() => setIsLoadingLocalities(false));
  }, [step]);

  // Autocompletar entre calles cuando cambia la calle principal
  useEffect(() => {
    if (!streetName || !selectedLocality) {
      setCrossStreetSuggestions([]);
      return;
    }

    if (crossStreetDebounceRef.current) clearTimeout(crossStreetDebounceRef.current);

    crossStreetDebounceRef.current = setTimeout(async () => {
      setIsLoadingCrossStreets(true);
      const localityName = localities.find((l) => l.id === selectedLocality)?.name ?? selectedLocality;
      const suggestions = await fetchCrossStreetSuggestions(streetName, localityName);
      setCrossStreetSuggestions(suggestions);
      setIsLoadingCrossStreets(false);
    }, 600);
  }, [streetName, selectedLocality, localities]);

  // Geocodificar cuando cambian calle, altura o localidad
  useEffect(() => {
    if (!streetName || !streetNumber || !selectedLocality) {
      setGeocodedPoint(null);
      setAddressZoneStatus('idle');
      return;
    }

    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);

    geocodeDebounceRef.current = setTimeout(async () => {
      setIsGeocodingAddress(true);
      const localityName = localities.find((l) => l.id === selectedLocality)?.name ?? selectedLocality;
      const point = await geocodeStructuredAddress(streetName, streetNumber, localityName);

      if (!point) {
        setGeocodedPoint(null);
        setAddressZoneStatus('error');
        setIsGeocodingAddress(false);
        return;
      }

      setGeocodedPoint(point);

      try {
        const check = await checkDeliveryZonePoint({
          latitude: point.latitude,
          longitude: point.longitude,
        });

        setAddressZoneStatus(check.hasZone && !check.inside ? 'outside' : 'valid');
      } catch {
        setAddressZoneStatus('error');
      }

      setIsGeocodingAddress(false);
    }, 800);
  }, [streetName, streetNumber, selectedLocality, localities]);

  // ── Búsqueda de cliente por teléfono ─────────────────────────────────────────

  const searchCustomer = async () => {
    const trimmed = phone.trim();
    if (!trimmed) return;

    setIsSearchingCustomer(true);
    setCustomerFound(null);
    setCustomerNotFound(false);

    try {
      const result = await endpoints.fetchCustomerByPhone?.(trimmed);

      if (result) {
        setCustomerFound(result);
        // Precargar dirección si el cliente la tiene guardada
        if (result.savedAddress) {
          setStreetName(result.savedAddress.street ?? '');
          setStreetNumber(result.savedAddress.number ?? '');
          setSelectedLocality(result.savedAddress.locality ?? '');
          setCrossStreets(result.savedAddress.crossStreets ?? '');
        }
        setStep('type');
      } else {
        setCustomerNotFound(true);
        setStep('customer');
      }
    } catch {
      setCustomerNotFound(true);
      setStep('customer');
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // ── Navegación ────────────────────────────────────────────────────────────────

  const goNext = () => {
    const idx = activeSteps.indexOf(step);
    if (idx < activeSteps.length - 1) setStep(activeSteps[idx + 1]);
  };

  const goBack = () => {
    const idx = activeSteps.indexOf(step);
    if (idx > 0) setStep(activeSteps[idx - 1]);
  };

  // ── Productos ─────────────────────────────────────────────────────────────────

  const increment = (id: string) =>
    setSelectedQuantities((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));

  const decrement = (id: string) =>
    setSelectedQuantities((prev) => {
      const q = prev[id] ?? 0;
      if (q <= 1) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: q - 1 };
    });

  const selectedItems = availableProducts
    .map((p) => ({ ...p, quantity: selectedQuantities[p.id] ?? 0 }))
    .filter((p) => p.quantity > 0);

  const totalAmount = selectedItems.reduce((acc, p) => acc + p.price * p.quantity, 0);

  const filteredProducts = availableProducts.filter((p) => {
    const q = productFilter.trim().toLowerCase();
    const matchName = !q || p.name.toLowerCase().includes(q);
    const productCategoryIds = getNormalizedProductCategoryIds(p);
    const matchCat = categoryFilter === 'all' || productCategoryIds.includes(categoryFilter);
    return matchName && matchCat;
  });

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const userId = Number(newOrderUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error('User ID inválido');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Seleccioná al menos un producto');
      return;
    }

    const parsedHeadquarterId = Number(selectedHeadquarterId);
    const resolvedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
      ? parsedHeadquarterId
      : null;

    if (orderType === 'dine-in' && !resolvedHeadquarterId) {
      toast.error('Seleccioná una sede para el pedido de salón');
      return;
    }

    const loggedUser = getLoggedUser();
    const storeId = Number(loggedUser?.storeId);

    const localityName = localities.find((l) => l.id === selectedLocality)?.name ?? selectedLocality;
    const formattedAddress = orderType === 'delivery'
      ? `${streetName} ${streetNumber}${crossStreets ? ` e/ ${crossStreets}` : ''}, ${localityName}`
      : undefined;

    const payload: CreateOrderRequest = {
      storeId,
      headquarterId: resolvedHeadquarterId ?? undefined,
      customerId: customerFound?.id,
      customerName: !customerFound?.id ? newCustomerName.trim() : undefined,
      customerPhone: !customerFound?.id ? phone.trim() : undefined,
      userId,
      type: orderType,
      items: selectedItems.map((p) => ({ productId: p.id, quantity: p.quantity })),
      delivery_address: formattedAddress,
      delivery_latitude: geocodedPoint?.latitude,
      delivery_longitude: geocodedPoint?.longitude,
      tableId: orderType === 'dine-in' && newOrderTableId ? Number(newOrderTableId) : undefined,
      waiterId: newOrderWaiterId ? Number(newOrderWaiterId) : undefined,
    };

    setIsSubmitting(true);
    try {
      await createBackendOrder(payload);
      toast.success('Orden creada correctamente');
      handleClose();
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo crear la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reset & Close ─────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep('phone');
    setPhone('');
    setCustomerFound(null);
    setCustomerNotFound(false);
    setNewCustomerName('');
    setOrderType('delivery');
    setSelectedLocality('');
    setStreetName('');
    setStreetNumber('');
    setCrossStreets('');
    setGeocodedPoint(null);
    setAddressZoneStatus('idle');
    setSelectedQuantities({});
    setProductFilter('');
    setCategoryFilter('all');
    setNewOrderTableId('');
    setNewOrderWaiterId('');
    onClose();
  };

  // ── Render por paso ───────────────────────────────────────────────────────────

  const renderPhone = () => (
    <div className="space-y-4">
      <SectionTitle>¿Cuál es el teléfono del cliente?</SectionTitle>
      <div>
        <FieldLabel>Teléfono</FieldLabel>
        <Input
          placeholder="Ej: 1123456789"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void searchCustomer()}
          autoFocus
          type="tel"
        />
      </div>
      <Button
        className="w-full"
        onClick={() => void searchCustomer()}
        disabled={!phone.trim() || isSearchingCustomer}
      >
        {isSearchingCustomer ? 'Buscando...' : 'Buscar cliente →'}
      </Button>
    </div>
  );

  const renderCustomer = () => (
    <div className="space-y-4">
      <SectionTitle>Cliente nuevo</SectionTitle>
      <p className="text-xs text-gray-400">
        No encontramos a nadie con el teléfono <span className="text-white">{phone}</span>. Ingresá su nombre para registrarlo.
      </p>
      <div>
        <FieldLabel>Nombre completo</FieldLabel>
        <Input
          placeholder="Ej: Juan Pérez"
          value={newCustomerName}
          onChange={(e) => setNewCustomerName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={goBack}>← Atrás</Button>
        <Button
          className="flex-1"
          onClick={goNext}
          disabled={!newCustomerName.trim()}
        >
          Continuar →
        </Button>
      </div>
    </div>
  );

  const renderCustomerFound = () => {
    const c = customerFound!;
    const displayName = (c.name ?? '').trim() || 'Cliente';
    const avatarInitial = displayName.charAt(0).toUpperCase();
    const displayPhone = (c.phone ?? '').trim() || phone;
    return (
      <div className="space-y-3 rounded-lg border border-orange-700/50 bg-orange-950/20 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-sm font-bold">
            {avatarInitial}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{displayName}</p>
            <p className="text-xs text-gray-400">{displayPhone}</p>
          </div>
          <Badge className="ml-auto bg-emerald-600 text-white text-xs">Existente</Badge>
        </div>

        {c.savedAddress && (
          <div className="text-xs text-gray-400">
            <span className="text-gray-500">Última dirección: </span>
            <span className="text-gray-300">{c.savedAddress.formatted}</span>
          </div>
        )}

        {c.orderHistory && c.orderHistory.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Historial reciente</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {c.orderHistory.slice(0, 3).map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{h.date}</span>
                  <span className="text-gray-300">{h.items.slice(0, 2).join(', ')}</span>
                  <span className="text-white">{h.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderType = () => (
    <div className="space-y-4">
      {customerFound && renderCustomerFound()}

      <SectionTitle>Tipo de orden</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {(['delivery', 'dine-in'] as OrderType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setOrderType(type)}
            className={`rounded-lg border-2 p-4 text-left transition-all ${
              orderType === type
                ? 'border-orange-500 bg-orange-500/10 text-white'
                : 'border-gray-700 bg-card text-gray-400 hover:border-gray-500'
            }`}
          >
            <div className="text-2xl mb-1">{type === 'delivery' ? '🛵' : '🍽️'}</div>
            <p className="text-sm font-medium">{type === 'delivery' ? 'Delivery' : 'Salón'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {type === 'delivery' ? 'Con dirección de entrega' : 'Mesa o mostrador'}
            </p>
          </button>
        ))}
      </div>

      {orderType === 'dine-in' && (
        <div className="space-y-2">
          <div>
            <FieldLabel>Sede *</FieldLabel>
            <Select value={selectedHeadquarterId} onValueChange={setSelectedHeadquarterId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Seleccioná una sede'} />
              </SelectTrigger>
              <SelectContent>
                {headquarters.map((headquarter) => (
                  <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                    {headquarter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Mesa (opcional)</FieldLabel>
              <Input
                placeholder="ID de mesa"
                value={newOrderTableId}
                onChange={(e) => setNewOrderTableId(e.target.value)}
                type="number"
              />
            </div>
            <div>
              <FieldLabel>Mozo (opcional)</FieldLabel>
              <Input
                placeholder="ID de mozo"
                value={newOrderWaiterId}
                onChange={(e) => setNewOrderWaiterId(e.target.value)}
                type="number"
              />
            </div>
          </div>
        </div>
      )}

      {orderType === 'dine-in' && !selectedHeadquarterId && (
        <p className="text-xs text-yellow-400">Seleccioná una sede para continuar con el pedido de salón.</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={goBack}>← Atrás</Button>
        <Button
          className="flex-1"
          onClick={goNext}
          disabled={orderType === 'dine-in' && !selectedHeadquarterId}
        >
          Continuar →
        </Button>
      </div>
    </div>
  );

  const renderAddress = () => {
    const zoneColor =
      addressZoneStatus === 'valid' ? 'text-emerald-400' :
      addressZoneStatus === 'outside' ? 'text-red-400' :
      addressZoneStatus === 'error' ? 'text-yellow-400' : 'text-gray-500';

    const zoneMsg =
      addressZoneStatus === 'valid' ? '✓ Dentro de zona de entrega' :
      addressZoneStatus === 'outside' ? '✗ Fuera de la zona de entrega' :
      addressZoneStatus === 'error' ? '⚠ No se pudo verificar la zona' :
      isGeocodingAddress ? 'Verificando dirección...' : '';

    const canContinue = geocodedPoint && addressZoneStatus === 'valid';

    return (
      <div className="space-y-4">
        <SectionTitle>Dirección de entrega</SectionTitle>

        {/* Localidad */}
        <div>
          <FieldLabel>Localidad</FieldLabel>
          <Select value={selectedLocality} onValueChange={setSelectedLocality}>
            <SelectTrigger>
              <SelectValue placeholder={isLoadingLocalities ? 'Cargando localidades...' : 'Seleccioná una localidad'} />
            </SelectTrigger>
            <SelectContent>
              {localities.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Calle y altura */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <FieldLabel>Calle</FieldLabel>
            <Input
              placeholder="Ej: Av. Mitre"
              value={streetName}
              onChange={(e) => {
                setStreetName(e.target.value);
                setShowCrossStreetSuggestions(false);
              }}
              disabled={!selectedLocality}
            />
          </div>
          <div className="w-24">
            <FieldLabel>Altura</FieldLabel>
            <Input
              placeholder="Ej: 1234"
              value={streetNumber}
              onChange={(e) => setStreetNumber(e.target.value)}
              type="number"
              disabled={!selectedLocality}
            />
          </div>
        </div>

        {/* Entre calles con sugerencias */}
        <div className="relative">
          <FieldLabel>
            Entre calles {isLoadingCrossStreets && <span className="text-gray-600">(cargando...)</span>}
          </FieldLabel>
          <Input
            placeholder="Ej: Belgrano y San Martín"
            value={crossStreets}
            onChange={(e) => {
              setCrossStreets(e.target.value);
              setShowCrossStreetSuggestions(true);
            }}
            onFocus={() => setShowCrossStreetSuggestions(crossStreetSuggestions.length > 0)}
            disabled={!streetName}
          />
          {showCrossStreetSuggestions && crossStreetSuggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-gray-700 bg-card shadow-lg overflow-hidden">
              {crossStreetSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  onMouseDown={() => {
                    setCrossStreets(s);
                    setShowCrossStreetSuggestions(false);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Estado geocodificación */}
        {zoneMsg && (
          <p className={`text-xs ${zoneColor}`}>{zoneMsg}</p>
        )}

        {/* Dirección formateada */}
        {geocodedPoint && (
          <div className="rounded-md bg-gray-900/50 border border-gray-800 px-3 py-2">
            <p className="text-xs text-gray-500">Dirección encontrada</p>
            <p className="text-xs text-gray-300 mt-0.5 line-clamp-2">{geocodedPoint.formatted}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={goBack}>← Atrás</Button>
          <Button
            className="flex-1"
            onClick={goNext}
            disabled={!canContinue || isGeocodingAddress}
          >
            {isGeocodingAddress ? 'Verificando...' : 'Continuar →'}
          </Button>
        </div>
      </div>
    );
  };

  const renderProducts = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Productos</SectionTitle>
        <span className="text-xs text-gray-400">
          {selectedItems.reduce((a, p) => a + p.quantity, 0)} items · {currencyFormatter.format(totalAmount)}
        </span>
      </div>

      <Input
        placeholder="Buscar producto..."
        value={productFilter}
        onChange={(e) => setProductFilter(e.target.value)}
        className="h-8 text-sm"
      />

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            categoryFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Todas
        </button>
        {availableCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(String(cat.id))}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              categoryFilter === String(cat.id) ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {filteredProducts.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">Sin productos</p>
        ) : (
          filteredProducts.map((product) => {
            const qty = selectedQuantities[product.id] ?? 0;
            return (
              <div
                key={product.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  qty > 0 ? 'border-orange-700/60 bg-orange-950/20' : 'border-gray-800 bg-card'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">{currencyFormatter.format(product.price)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => decrement(product.id)}
                    disabled={qty === 0}
                    className="h-7 w-7 rounded-md border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 transition-colors text-sm font-bold"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm text-white">{qty}</span>
                  <button
                    type="button"
                    onClick={() => increment(product.id)}
                    className="h-7 w-7 rounded-md border border-orange-700 text-orange-400 hover:bg-orange-500/10 transition-colors text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={goBack}>← Atrás</Button>
        <Button className="flex-1" onClick={goNext} disabled={selectedItems.length === 0}>
          Revisar →
        </Button>
      </div>
    </div>
  );

  const renderConfirm = () => {
    const localityName = localities.find((l) => l.id === selectedLocality)?.name ?? selectedLocality;
    const customerName = customerFound?.name ?? newCustomerName;
    const formattedAddress = orderType === 'delivery'
      ? `${streetName} ${streetNumber}${crossStreets ? ` e/ ${crossStreets}` : ''}, ${localityName}`
      : null;

    return (
      <div className="space-y-4">
        <SectionTitle>Confirmar orden</SectionTitle>

        <div className="rounded-lg border border-gray-800 divide-y divide-gray-800 overflow-hidden">
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-gray-400">Cliente</span>
            <span className="text-white">{customerName}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-gray-400">Teléfono</span>
            <span className="text-white">{phone}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-gray-400">Tipo</span>
            <Badge className={orderType === 'delivery' ? 'bg-blue-600 text-white text-xs' : 'bg-emerald-600 text-white text-xs'}>
              {orderType === 'delivery' ? 'Delivery' : 'Salón'}
            </Badge>
          </div>
          {formattedAddress && (
            <div className="flex justify-between items-start gap-4 px-3 py-2 text-sm">
              <span className="text-gray-400 shrink-0">Dirección</span>
              <span className="text-white text-right">{formattedAddress}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-3 py-2 bg-gray-900/50">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Items</p>
          </div>
          {selectedItems.map((p) => (
            <div key={p.id} className="flex justify-between items-center px-3 py-2 text-sm border-t border-gray-800">
              <span className="text-white">{p.name}</span>
              <div className="flex items-center gap-3 text-gray-400">
                <span>x{p.quantity}</span>
                <span className="text-white">{currencyFormatter.format(p.price * p.quantity)}</span>
              </div>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 border-t border-orange-700/50 bg-orange-950/10">
            <span className="text-sm font-medium text-gray-300">Total</span>
            <span className="text-sm font-bold text-white">{currencyFormatter.format(totalAmount)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={goBack} disabled={isSubmitting}>
            ← Atrás
          </Button>
          <Button className="flex-1" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Creando...' : '✓ Crear orden'}
          </Button>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 'phone': return renderPhone();
      case 'customer': return renderCustomer();
      case 'type': return renderType();
      case 'address': return renderAddress();
      case 'products': return renderProducts();
      case 'confirm': return renderConfirm();
    }
  };

  const stepLabel: Record<Step, string> = {
    phone: 'Teléfono',
    customer: 'Cliente',
    type: 'Tipo',
    address: 'Dirección',
    products: 'Productos',
    confirm: 'Confirmar',
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="bg-card card max-h-[92vh] overflow-hidden text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Nueva orden</span>
            <span className="text-xs font-normal text-gray-500">{stepLabel[step]}</span>
          </DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} steps={activeSteps} />

        <div className="overflow-y-auto max-h-[calc(92vh-8rem)] pr-0.5">
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
