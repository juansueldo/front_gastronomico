export interface ActiveOrderItem {
  id: string;
  type: 'delivery' | 'salon';
  customerName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items: string[];
  detail: string;
  status: string;
  total: string;
  createdAt: string;
  notes?: string;
}

interface AddActiveOrderInput {
  type: ActiveOrderItem['type'];
  customerName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items: string[];
  detail: string;
  total: string;
  status?: string;
  createdAt?: string;
  notes?: string;
}

const ACTIVE_ORDERS_STORAGE_KEY = 'mobile_tomatina.activeOrders';
export const ACTIVE_ORDERS_UPDATED_EVENT = 'mobile_tomatina.activeOrdersUpdated';

const initialOrders: ActiveOrderItem[] = [
  {
    id: 'A-102',
    type: 'delivery',
    customerName: 'Martina López',
    address: 'Av. Rivadavia 1240, Buenos Aires',
    latitude: -34.609806,
    longitude: -58.392479,
    items: ['2x Pizza muzzarella', '1x Gaseosa 1.5L'],
    detail: '2 pizzas muzzarella - Av. Rivadavia 1240',
    status: 'En preparación',
    total: '$18.500',
    createdAt: '23:42',
    notes: 'Sin aceitunas',
  },
  {
    id: 'A-103',
    type: 'salon',
    customerName: 'Mesa 7',
    items: ['1x Milanesa napolitana', '2x Agua sin gas'],
    detail: 'Milanesa napolitana + 2 aguas',
    status: 'Listo para servir',
    total: '$12.200',
    createdAt: '23:18',
  },
  {
    id: 'A-104',
    type: 'delivery',
    customerName: 'Carlos Giménez',
    address: 'Belgrano 845, Buenos Aires',
    latitude: -34.610258,
    longitude: -58.37346,
    items: ['1x Hamburguesa doble', '1x Papas fritas medianas'],
    detail: 'Hamburguesa doble + papas - Belgrano 845',
    status: 'En camino',
    total: '$9.800',
    createdAt: '23:56',
    notes: 'Cobrar con QR',
  },
];

let inMemoryOrders: ActiveOrderItem[] = [...initialOrders];

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const notifyOrdersUpdated = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ACTIVE_ORDERS_UPDATED_EVENT));
};

const saveActiveOrders = (orders: ActiveOrderItem[]) => {
  inMemoryOrders = orders;

  if (canUseStorage()) {
    window.localStorage.setItem(ACTIVE_ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }

  notifyOrdersUpdated();
};

export const getActiveOrders = (): ActiveOrderItem[] => {
  if (!canUseStorage()) {
    return inMemoryOrders;
  }

  const rawValue = window.localStorage.getItem(ACTIVE_ORDERS_STORAGE_KEY);

  if (!rawValue) {
    saveActiveOrders(initialOrders);
    return initialOrders;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      saveActiveOrders(initialOrders);
      return initialOrders;
    }

    return parsedValue as ActiveOrderItem[];
  } catch {
    saveActiveOrders(initialOrders);
    return initialOrders;
  }
};

const buildNextOrderId = (orders: ActiveOrderItem[]) => {
  const maxOrderNumber = orders.reduce((maxValue, order) => {
    const [_, numericPart] = order.id.split('-');
    const parsedOrderNumber = Number(numericPart);

    if (!Number.isFinite(parsedOrderNumber)) {
      return maxValue;
    }

    return Math.max(maxValue, parsedOrderNumber);
  }, 100);

  return `A-${maxOrderNumber + 1}`;
};

const getCurrentTime = () => new Date().toLocaleTimeString('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const addActiveOrder = (orderInput: AddActiveOrderInput) => {
  const orders = getActiveOrders();

  const nextOrder: ActiveOrderItem = {
    id: buildNextOrderId(orders),
    type: orderInput.type,
    customerName: orderInput.customerName,
    address: orderInput.address,
    latitude: orderInput.latitude,
    longitude: orderInput.longitude,
    items: orderInput.items,
    detail: orderInput.detail,
    status: orderInput.status ?? 'Nuevo',
    total: orderInput.total,
    createdAt: orderInput.createdAt ?? getCurrentTime(),
    notes: orderInput.notes,
  };

  saveActiveOrders([nextOrder, ...orders]);

  return nextOrder;
};

export const updateActiveOrder = (orderId: string, updater: (order: ActiveOrderItem) => ActiveOrderItem) => {
  const nextOrders = getActiveOrders().map((order) => (order.id === orderId ? updater(order) : order));
  saveActiveOrders(nextOrders);
};

export const removeActiveOrder = (orderId: string) => {
  const nextOrders = getActiveOrders().filter((order) => order.id !== orderId);
  saveActiveOrders(nextOrders);
};
