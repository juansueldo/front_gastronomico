import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, Clock, MapPin, PackageCheck, RefreshCw, Store } from 'lucide-react';
import { useParams } from 'react-router';
import { Button } from '../../../shared/ui/components/button';
import {
  createTrackingSocket,
  getPublicOrderTracking,
  type PublicOrderTracking,
} from '../services/orderTracking.service';

const DEFAULT_CENTER: LatLngExpression = [-34.603722, -58.381592];
const ORDER_STEPS = ['pending', 'processing', 'ready', 'completed'];

const houseIcon = divIcon({
  className: 'comiio-map-icon',
  iconSize: [38, 38],
  iconAnchor: [19, 36],
  popupAnchor: [0, -32],
  html: `
    <div style="display:flex;height:38px;width:38px;align-items:center;justify-content:center;border-radius:999px;background:#fff7ed;border:2px solid #ea580c;box-shadow:0 8px 18px rgba(15,23,42,.22)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m3 10.5 9-7 9 7"/>
        <path d="M5 10v10h14V10"/>
        <path d="M9 20v-6h6v6"/>
      </svg>
    </div>
  `,
});

const deliveryIcon = divIcon({
  className: 'comiio-map-icon',
  iconSize: [42, 42],
  iconAnchor: [21, 39],
  popupAnchor: [0, -35],
  html: `
    <div style="display:flex;height:42px;width:42px;align-items:center;justify-content:center;border-radius:999px;background:#ecfdf5;border:2px solid #16a34a;box-shadow:0 8px 18px rgba(15,23,42,.24)">
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="6.5" cy="17.5" r="2.5"/>
        <circle cx="17.5" cy="17.5" r="2.5"/>
        <path d="M9 17.5h4l2-6h3"/>
        <path d="M6.5 17.5 9 11h3l3 6.5"/>
        <path d="M12 8h2.5l1.5 3.5"/>
        <path d="M4 13h3"/>
      </svg>
    </div>
  `,
});

const vehicleLabels: Record<string, string> = {
  motorcycle: 'Moto',
  bicycle: 'Bicicleta',
  car: 'Auto',
  other: 'Vehículo',
};

function getPosition(latitude?: number | null, longitude?: number | null): LatLngExpression | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function TrackingMapBounds({ destination, driver }: { destination: LatLngExpression | null; driver: LatLngExpression | null }) {
  const map = useMap();

  useEffect(() => {
    const points = [destination, driver].filter(Boolean) as [number, number][];
    if (points.length > 1) {
      map.fitBounds(points, { padding: [42, 42] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [destination, driver, map]);

  return null;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function OrderTrackingPage() {
  const { token = '' } = useParams();
  const [tracking, setTracking] = useState<PublicOrderTracking | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const loadTracking = async (showLoading = false) => {
    if (!token) return;
    if (showLoading) setIsLoading(true);
    try {
      const data = await getPublicOrderTracking(token);
      setTracking(data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos cargar el seguimiento');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTracking(true);
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;

    const socket = createTrackingSocket(token);
    socket.on('connect', () => setIsSocketConnected(true));
    socket.on('disconnect', () => setIsSocketConnected(false));
    socket.on('connect_error', () => setIsSocketConnected(false));
    socket.on('tracking_updated', (payload) => {
      const data = payload?.data ?? payload;
      if (data?.order) {
        setTracking(data);
        setErrorMessage('');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (isSocketConnected || !token) return undefined;
    const interval = window.setInterval(() => {
      void loadTracking(false);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isSocketConnected, token]);

  const destinationPosition = useMemo(() => getPosition(
    tracking?.order.destination?.latitude,
    tracking?.order.destination?.longitude,
  ), [tracking]);

  const driverPosition = useMemo(() => getPosition(
    tracking?.driverLocation?.latitude,
    tracking?.driverLocation?.longitude,
  ), [tracking]);

  const currentStepIndex = tracking?.order.status === 'cancelled'
    ? -1
    : Math.max(0, ORDER_STEPS.indexOf(tracking?.order.status || 'pending'));

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff7f2] p-4 text-slate-950">
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-orange-500" />
          <p className="mt-3 font-semibold">Cargando seguimiento...</p>
        </div>
      </main>
    );
  }

  if (errorMessage || !tracking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff7f2] p-4 text-slate-950">
        <section className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
          <PackageCheck className="mx-auto h-10 w-10 text-orange-500" />
          <h1 className="mt-4 text-2xl font-bold">Seguimiento no disponible</h1>
          <p className="mt-2 text-sm text-slate-600">{errorMessage || 'El link no existe o ya expiró.'}</p>
          <Button type="button" className="mt-5" onClick={() => void loadTracking(true)}>Reintentar</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff7f2] p-4 text-slate-950 md:p-8">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="border-b border-orange-100 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-orange-500">{tracking.store?.name || 'Comiio'}</p>
                <h1 className="mt-1 text-2xl font-bold">Pedido #{tracking.order.number}</h1>
                <p className="mt-1 text-slate-600">{tracking.order.deliveryAddress || 'Dirección de entrega'}</p>
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                {tracking.order.statusLabel}
              </span>
            </div>
          </div>

          <div className="h-[420px] bg-slate-100">
            <MapContainer center={destinationPosition || driverPosition || DEFAULT_CENTER} zoom={13} className="h-full w-full" zoomControl={false}>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ZoomControl position="bottomright" />
              <TrackingMapBounds destination={destinationPosition} driver={driverPosition} />
              {destinationPosition ? (
                <Marker position={destinationPosition} icon={houseIcon}>
                  <Popup>Tu dirección de entrega</Popup>
                </Marker>
              ) : null}
              {driverPosition ? (
                <Marker position={driverPosition} icon={deliveryIcon}>
                  <Popup>{tracking.driver?.name || 'Repartidor'}</Popup>
                </Marker>
              ) : null}
            </MapContainer>
          </div>

          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              {ORDER_STEPS.map((step, index) => {
                const active = currentStepIndex >= index;
                return (
                  <div key={step} className={`rounded-xl border p-3 ${active ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                    <p className="text-xs font-semibold uppercase">{index + 1}</p>
                    <p className="mt-1 font-bold">
                      {step === 'pending' ? 'Recibido' : step === 'processing' ? 'Preparando' : step === 'ready' ? 'En camino' : 'Entregado'}
                    </p>
                  </div>
                );
              })}
            </div>
            {tracking.order.status === 'cancelled' ? (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Este pedido fue cancelado.</p>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <Bike className="h-6 w-6 text-orange-500" />
              <div>
                <h2 className="font-bold">Repartidor</h2>
                <p className="text-sm text-slate-600">{tracking.driver?.name || 'Aún no asignado'}</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Vehículo</dt>
                <dd className="font-semibold">{vehicleLabels[tracking.driver?.vehicleType || ''] || '-'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Patente</dt>
                <dd className="font-semibold">{tracking.driver?.plate || '-'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Recorrido</dt>
                <dd className="font-semibold">{tracking.route?.statusLabel || 'Pendiente'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <MapPin className="h-6 w-6 text-orange-500" />
              <div>
                <h2 className="font-bold">Ubicación</h2>
                <p className="text-sm text-slate-600">
                  {tracking.driverLocation
                    ? tracking.driverLocation.isFresh ? 'Actualizada en vivo' : 'No actualizada recientemente'
                    : 'Todavía no hay ubicación del repartidor'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Última actualización: {formatDate(tracking.driverLocation?.lastLocationAt)}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-orange-500" />
              <div>
                <h2 className="font-bold">Estado de conexión</h2>
                <p className="text-sm text-slate-600">{isSocketConnected ? 'Conectado en tiempo real' : 'Actualizando cada 15 segundos'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <Store className="h-6 w-6 text-orange-500" />
              <div>
                <h2 className="font-bold">Pedido</h2>
                <p className="text-sm text-slate-600">Cliente: {tracking.customer?.name || '-'}</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
