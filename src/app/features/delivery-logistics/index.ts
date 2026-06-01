export {
  assignDeliveryRoute,
  createDeliveryDriver,
  deleteDeliveryDriver,
  fetchDeliveryBoard,
  listDeliveryDrivers,
  markDeliveryRoutePrinted,
  updateDeliveryDriver,
  updateDeliveryRouteLocation,
  updateDeliveryRouteStatus,
} from './services/deliveryLogistics.service';

export type {
  CreateDriverInput,
  DeliveryBoard,
  DeliveryDriver,
  DeliveryOrder,
  DeliveryRoute,
  DeliveryRouteOrder,
  DriverStatus,
  RouteStatus,
  VehicleType,
} from './services/deliveryLogistics.service';
