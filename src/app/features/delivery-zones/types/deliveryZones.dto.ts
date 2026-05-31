export interface DeliveryZonePointDto {
  lat?: number;
  lng?: number;
}

export type DeliveryZoneDto = {
  id?: string | number;
  customerId?: number;
  customer_id?: number;
  name?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
  zoneid?: string;
  storeId?: number;
  store_id?: number;
  statusId?: number;
  status_id?: number;
  headquarterId?: number;
  headquarter_id?: number;
  Headquarter?: { id?: number };
  Status?: { id?: number; name?: string };
  polygon?: DeliveryZonePointDto[];
  geojson?: { type?: string; coordinates?: number[][][] };
  geometry?: { type?: string; coordinates?: number[][][] };
  points?: DeliveryZonePointDto[];
  vertices?: DeliveryZonePointDto[];
  updatedAt?: string;
  updated_at?: string;
  deliveryFee?: number | string;
  delivery_fee?: number | string;
  zone?: DeliveryZoneDto;
  deliveryZone?: DeliveryZoneDto;
  item?: DeliveryZoneDto;
};
