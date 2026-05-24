import type { CustomerDto } from '../types/customers.dto';
import type { Customer, CustomerLookupResult } from '../types/customers.model';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

export function mapCustomerDtoToModel(item: CustomerDto): Customer {
  const id = Number(item.id);
  const firstname = String(item.firstname ?? '').trim();
  const lastname = String(item.lastname ?? '').trim();
  const directName = String(item.name ?? '').trim();
  const phone = String(item.phone ?? item.phoneNumber ?? item.customerPhone ?? '').trim();
  const statusId = Number(item.statusId ?? item.status_id);
  const status = item.status ?? item.Status;
  const orderCount = Number(item.orderCount);
  const totalSpent = Number(item.totalSpent);
  const lastOrderTotal = Number(item.lastOrder?.totalAmount ?? item.lastOrder?.total_amount);

  return {
    id: Number.isInteger(id) && id > 0 ? id : undefined,
    name: directName || `${firstname} ${lastname}`.trim() || 'Cliente',
    firstname: firstname || undefined,
    lastname: lastname || undefined,
    phone,
    email: item.email,
    statusId: Number.isInteger(statusId) ? statusId : undefined,
    statusName: status?.name,
    orderCount: Number.isFinite(orderCount) ? orderCount : undefined,
    totalSpent: Number.isFinite(totalSpent) ? totalSpent : undefined,
    lastOrder: item.lastOrder
      ? {
        id: item.lastOrder.id,
        orderDate: item.lastOrder.orderDate ?? item.lastOrder.order_date,
        status: item.lastOrder.status,
        totalAmount: Number.isFinite(lastOrderTotal) ? lastOrderTotal : undefined,
      }
      : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    metadata: item.metadata,
  };
}

export function mapCustomerDtoToLookup(item: CustomerDto, fallbackPhone = ''): CustomerLookupResult {
  const customer = mapCustomerDtoToModel({
    ...item,
    phone: item.phone ?? item.phoneNumber ?? item.customerPhone ?? fallbackPhone,
  });

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone || fallbackPhone,
    savedAddress: item.lastDeliveryAddress
      ? {
        street: item.lastDeliveryAddress.street,
        number: item.lastDeliveryAddress.number,
        locality: item.lastDeliveryAddress.locality,
        crossStreets: item.lastDeliveryAddress.crossStreets,
        latitude: item.lastDeliveryAddress.latitude,
        longitude: item.lastDeliveryAddress.longitude,
        formatted: item.lastDeliveryAddress.formatted ?? '',
      }
      : undefined,
    orderHistory: (item.Orders ?? item.orders ?? []).slice(0, 5).map((order) => ({
      id: String(order.id),
      date: new Date(order.createdAt ?? order.created_at ?? Date.now()).toLocaleDateString('es-AR'),
      total: currencyFormatter.format(Number(order.total_amount ?? order.total ?? 0)),
      items: (order.OrderItems ?? order.orderItems ?? []).map((orderItem) => (
        orderItem.Product?.name ?? orderItem.product?.name ?? 'Producto'
      )),
    })),
  };
}
