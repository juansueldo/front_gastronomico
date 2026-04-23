import { useRef, useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { DeliveryZonePoint, upsertDeliveryZone, deleteDeliveryZone } from '../api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { endpoints } from '../api/enpoints';

export interface DeliveryZoneMapProps {
  deliveryZonePoints: DeliveryZonePoint[];
  draftDeliveryZonePoints: DeliveryZonePoint[];
  isEditingDeliveryZone: boolean;
  onSetDraftDeliveryZonePoints: (points: DeliveryZonePoint[]) => void;
  onSetIsEditingDeliveryZone: (editing: boolean) => void;
  deliveryOrders: Array<{ id: string; latitude?: number; longitude?: number; }>;
  onZoneSaved?: () => void; // Nuevo: callback para avisar al padre
}

export function DeliveryZoneMap({
  deliveryZonePoints,
  draftDeliveryZonePoints,
  isEditingDeliveryZone,
  onSetDraftDeliveryZonePoints,
  onSetIsEditingDeliveryZone,
  deliveryOrders,
  onZoneSaved,
}: DeliveryZoneMapProps) {
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const deliveryMapRef = useRef<HTMLDivElement | null>(null);
  const googleMapInstanceRef = useRef<any>(null);
  const googleMapMarkersRef = useRef<any[]>([]);
  const deliveryZonePolygonRef = useRef<any>(null);
  const draftDeliveryZonePolygonRef = useRef<any>(null);
  const draftDeliveryZonePolylineRef = useRef<any>(null);
  const deliveryZoneClickListenerRef = useRef<any>(null);
  const draftVertexMarkersRef = useRef<any[]>([]);

  // Google Maps API Key
  const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  // Helpers para colores de prioridad
  const getPriorityMapPinColor = (priority: string) => {
    if (priority === 'old') return '#ef4444';
    if (priority === 'delayed') return '#eab308';
    if (priority === 'on-time') return '#22c55e';
    return '#6b7280';
  };

  // Dummy: determina prioridad por ahora solo por id
  const getPriorityLabel = (order: any) => 'Pedido';
  const getOrderVisualPriority = (order: any) => 'default';

  // Edición de zona
  const startDeliveryZoneEdition = () => {
    if (!GOOGLE_MAPS_API_KEY) {
      setGoogleMapsError('Configurá VITE_GOOGLE_MAPS_API_KEY para dibujar zona de entrega');
      return;
    }
    onSetDraftDeliveryZonePoints([...deliveryZonePoints]);
    onSetIsEditingDeliveryZone(true);
  };
  const cancelDeliveryZoneEdition = () => {
    onSetIsEditingDeliveryZone(false);
    onSetDraftDeliveryZonePoints([]);
  };
  const undoDeliveryZonePoint = () => {
    onSetDraftDeliveryZonePoints(draftDeliveryZonePoints.slice(0, -1));
  };
  const saveDeliveryZonePolygon = async () => {
    if (draftDeliveryZonePoints.length < 3) {
      setGoogleMapsError('La zona de entrega necesita al menos 3 puntos');
      return;
    }
    try {
      await upsertDeliveryZone({
        name: 'Zona principal',
        active: true,
        polygon: draftDeliveryZonePoints,
      });
      onSetDraftDeliveryZonePoints([]);
      onSetIsEditingDeliveryZone(false);
      if (onZoneSaved) onZoneSaved(); // Notificar al padre para que recargue la zona
    } catch (error: any) {
      setGoogleMapsError(error?.message || 'No se pudo guardar la zona de entrega');
    }
  };
  const removeDeliveryZonePolygon = async () => {
    try {
      await deleteDeliveryZone();
      onSetDraftDeliveryZonePoints([]);
      onSetIsEditingDeliveryZone(false);
    } catch (error: any) {
      setGoogleMapsError(error?.message || 'No se pudo eliminar la zona de entrega');
    }
  };

  // Renderizar Google Maps y zona
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !deliveryMapRef.current) return;
    let isCancelled = false;
    let googleMapsScriptPromise: Promise<unknown> | null = null;
    const loadGoogleMapsScript = (apiKey: string) => {
      if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps no disponible en servidor'));
      const windowWithGoogle = window as Window & { google?: unknown };
      if (windowWithGoogle.google) return Promise.resolve(windowWithGoogle.google);
      if (googleMapsScriptPromise) return googleMapsScriptPromise;
      googleMapsScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(windowWithGoogle.google);
        script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
        document.head.appendChild(script);
      });
      return googleMapsScriptPromise;
    };
    const renderGoogleMap = async () => {
      try {
        const google = await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY) as any;
        if (isCancelled || !deliveryMapRef.current) return;
        setGoogleMapsError(null);
        if (!googleMapInstanceRef.current) {
          googleMapInstanceRef.current = new google.maps.Map(deliveryMapRef.current, {
            center: { lat: -34.603722, lng: -58.381592 },
            zoom: 12,
            disableDefaultUI: true,
            zoomControl: true,
          });
        }
        googleMapMarkersRef.current.forEach((marker) => marker.setMap(null));
        googleMapMarkersRef.current = [];
        if (deliveryZonePolygonRef.current) { deliveryZonePolygonRef.current.setMap(null); deliveryZonePolygonRef.current = null; }
        if (draftDeliveryZonePolygonRef.current) { draftDeliveryZonePolygonRef.current.setMap(null); draftDeliveryZonePolygonRef.current = null; }
        if (draftDeliveryZonePolylineRef.current) { draftDeliveryZonePolylineRef.current.setMap(null); draftDeliveryZonePolylineRef.current = null; }
        draftVertexMarkersRef.current.forEach((marker) => marker.setMap(null));
        draftVertexMarkersRef.current = [];
        if (deliveryZoneClickListenerRef.current) { google.maps.event.removeListener(deliveryZoneClickListenerRef.current); deliveryZoneClickListenerRef.current = null; }
        const deliveryOrdersWithCoordinates = deliveryOrders.filter((order) => Number.isFinite(order.latitude) && Number.isFinite(order.longitude));
        const bounds = new google.maps.LatLngBounds();
        let hasBounds = false;
        deliveryOrdersWithCoordinates.forEach((order) => {
          const position = { lat: order.latitude as number, lng: order.longitude as number };
          const priority = getOrderVisualPriority(order);
          const marker = new google.maps.Marker({
            position,
            map: googleMapInstanceRef.current,
            title: `${order.id} · ${getPriorityLabel(order)}`,
            label: { text: order.id.replace('A-', ''), color: '#ffffff', fontSize: '11px', fontWeight: '700' },
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: getPriorityMapPinColor(priority), fillOpacity: 1, strokeColor: '#111827', strokeWeight: 1, scale: 14 },
          });
          googleMapMarkersRef.current.push(marker);
          bounds.extend(position);
          hasBounds = true;
        });
        if (deliveryZonePoints.length >= 3) {
          deliveryZonePolygonRef.current = new google.maps.Polygon({
            paths: deliveryZonePoints,
            map: googleMapInstanceRef.current,
            strokeColor: '#06b6d4', strokeOpacity: 1, strokeWeight: 2, fillColor: '#06b6d4', fillOpacity: 0.15,
          });
          deliveryZonePoints.forEach((point) => { bounds.extend(point); hasBounds = true; });
        }
        if (isEditingDeliveryZone && draftDeliveryZonePoints.length > 0) {
          draftDeliveryZonePolylineRef.current = new google.maps.Polyline({ path: draftDeliveryZonePoints, map: googleMapInstanceRef.current, strokeColor: '#f59e0b', strokeOpacity: 1, strokeWeight: 2 });
          if (draftDeliveryZonePoints.length >= 3) {
            draftDeliveryZonePolygonRef.current = new google.maps.Polygon({ paths: draftDeliveryZonePoints, map: googleMapInstanceRef.current, strokeColor: '#f59e0b', strokeOpacity: 1, strokeWeight: 2, fillColor: '#f59e0b', fillOpacity: 0.1 });
          }
          draftDeliveryZonePoints.forEach((point) => { bounds.extend(point); hasBounds = true; });
          draftVertexMarkersRef.current = draftDeliveryZonePoints.map((point, index) => {
            const vertexMarker = new google.maps.Marker({
              position: point,
              map: googleMapInstanceRef.current,
              draggable: true,
              label: { text: String(index + 1), color: '#ffffff', fontSize: '10px', fontWeight: '700' },
              icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#f59e0b', fillOpacity: 1, strokeColor: '#111827', strokeWeight: 1, scale: 8 },
              title: `Vértice ${index + 1}`,
            });
            vertexMarker.addListener('dragend', (event: any) => {
              const lat = event?.latLng?.lat?.();
              const lng = event?.latLng?.lng?.();
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              onSetDraftDeliveryZonePoints(draftDeliveryZonePoints.map((vertex, vertexIndex) => (
                vertexIndex === index ? { lat, lng } : vertex
              )));
            });
            vertexMarker.addListener('rightclick', () => {
              onSetDraftDeliveryZonePoints(draftDeliveryZonePoints.filter((_, vertexIndex) => vertexIndex !== index));
            });
            return vertexMarker;
          });
        }
        if (isEditingDeliveryZone) {
          deliveryZoneClickListenerRef.current = googleMapInstanceRef.current.addListener('click', (event: any) => {
            const lat = event?.latLng?.lat?.();
            const lng = event?.latLng?.lng?.();
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            onSetDraftDeliveryZonePoints([...draftDeliveryZonePoints, { lat, lng }]);
          });
        }
        if (hasBounds) {
          googleMapInstanceRef.current.fitBounds(bounds);
        }
      } catch {
        setGoogleMapsError('No se pudo cargar Google Maps');
      }
    };
    void renderGoogleMap();
    return () => { isCancelled = true; };
  }, [deliveryOrders, deliveryZonePoints, draftDeliveryZonePoints, isEditingDeliveryZone]);

  return (
    <div
      className={
        `${isFullscreen
          ? 'fixed inset-0 z-50 bg-black/80 flex flex-col justify-center items-center p-0 m-0 w-screen h-screen'
          : 'rounded-lg border border-orange-700 bg-card p-4 space-y-3'} transition-all duration-300`
      }
      style={isFullscreen ? { borderRadius: 0, padding: 0 } : {}}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <h2 className="text-sm font-medium text-gray-300">Mapa de delivery</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-label-info text-white text-xs">
            {deliveryOrders.length} pedidos
          </Badge>
          <Badge
            variant="secondary"
            className={deliveryZonePoints.length >= 3 ? 'bg-emerald-600 text-white text-xs' : 'bg-gray-600 text-white text-xs'}
          >
            {deliveryZonePoints.length >= 3 ? 'Zona activa' : 'Sin zona'}
          </Badge>
          {!isFullscreen && (
            <button
              aria-label="Pantalla completa"
              className="ml-2 p-1 rounded hover:bg-gray-700 text-gray-300"
              onClick={() => setIsFullscreen(true)}
              type="button"
            >
              <Maximize2 size={18} />
            </button>
          )}
        </div>
      </div>
      <div className={
        isFullscreen
          ? 'relative flex-1 w-full h-full min-h-[400px] bg-body border-none rounded-none'
          : 'relative h-72 rounded-lg border border-orange-700 bg-body overflow-hidden'
      }>
        {isFullscreen && (
          <button
            aria-label="Cerrar pantalla completa"
            className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white"
            onClick={() => setIsFullscreen(false)}
            type="button"
          >
            <X size={22} />
          </button>
        )}
        {GOOGLE_MAPS_API_KEY && !googleMapsError ? (
          <div ref={deliveryMapRef} className={isFullscreen ? 'h-full w-full min-h-[400px]' : 'h-full w-full'} />
        ) : (
          <div className="p-4 h-full flex items-center justify-center text-sm text-gray-400 text-center">
            {googleMapsError ?? 'Configurá VITE_GOOGLE_MAPS_API_KEY para ver Google Maps'}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-400">Prioridad:</span>
        <span className="inline-flex items-center gap-1 text-gray-300"><span className="size-2 rounded-full bg-gray-500" /> Recién ingresado</span>
        <span className="inline-flex items-center gap-1 text-gray-300"><span className="size-2 rounded-full bg-green-500" /> En horario</span>
        <span className="inline-flex items-center gap-1 text-gray-300"><span className="size-2 rounded-full bg-yellow-500" /> Demorado</span>
        <span className="inline-flex items-center gap-1 text-gray-300"><span className="size-2 rounded-full bg-red-500" /> Antiguo</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!isEditingDeliveryZone ? (
          <Button size="sm" variant="outline" className="bg-transparent border-orange-600 text-white hover:bg-gray-700" onClick={startDeliveryZoneEdition}>
            Dibujar zona de entrega
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" className="bg-transparent border-orange-600 text-white hover:bg-gray-700" onClick={undoDeliveryZonePoint} disabled={draftDeliveryZonePoints.length === 0}>
              Deshacer punto
            </Button>
            <Button size="sm" variant="secondary" onClick={saveDeliveryZonePolygon} disabled={draftDeliveryZonePoints.length < 3}>
              Guardar zona
            </Button>
            <Button size="sm" variant="outline" className="bg-transparent border-orange-600 text-white hover:bg-gray-700" onClick={cancelDeliveryZoneEdition}>
              Cancelar edición
            </Button>
          </>
        )}
        <Button size="sm" variant="destructive" onClick={removeDeliveryZonePolygon} disabled={deliveryZonePoints.length < 3 && draftDeliveryZonePoints.length === 0}>
          Eliminar zona
        </Button>
        {isEditingDeliveryZone ? (
          <span className="text-xs text-amber-300">Click para agregar vértices, arrastrá para ajustar y click derecho en vértice para quitar</span>
        ) : null}
      </div>
      {deliveryOrders.length === 0 ? (
        <div className="p-3 rounded-lg border border-orange-700 bg-body text-xs text-gray-400">
          Sin pedidos de delivery activos. Podés configurar la zona igualmente.
        </div>
      ) : null}
    </div>
  );
}
