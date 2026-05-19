import { useEffect, useRef, useState } from 'react';
import type { PublicStoreDeliveryZone } from '../storefrontApi';

const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let mapsPromise: Promise<any> | null = null;

const loadGoogleMaps = (): Promise<any> => {
  const win = window as Window & { google?: any };
  if (win.google?.maps) return Promise.resolve(win.google);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(win.google);
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
    document.head.appendChild(script);
  });

  return mapsPromise;
};

export function DeliveryZonesOverviewMap({ zones }: { zones: PublicStoreDeliveryZone[] }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapsError, setMapsError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !mapContainerRef.current) return;
    let cancelled = false;

    void loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapContainerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapContainerRef.current, {
            center: { lat: -34.603722, lng: -58.381592 },
            zoom: 11,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'cooperative',
          });
        }

        const map = mapRef.current;
        overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
        overlaysRef.current = [];

        const bounds = new google.maps.LatLngBounds();
        let hasBounds = false;
        const palette = ['#ff5a2f', '#22c55e', '#3b82f6', '#f59e0b', '#e11d48', '#6366f1'];

        zones.forEach((zone, index) => {
          if (zone.polygon.length < 3) return;
          const color = palette[index % palette.length];

          const polygon = new google.maps.Polygon({
            paths: zone.polygon,
            map,
            strokeColor: color,
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.18,
          });
          overlaysRef.current.push(polygon);

          const firstPoint = zone.polygon[0];
          if (firstPoint) {
            const marker = new google.maps.Marker({
              position: firstPoint,
              map,
              label: {
                text: String(index + 1),
                color: '#ffffff',
                fontWeight: '700',
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: '#0f172a',
                strokeWeight: 1,
                scale: 9,
              },
              title: zone.name || `Zona ${index + 1}`,
            });
            overlaysRef.current.push(marker);
          }

          zone.polygon.forEach((point) => {
            bounds.extend(point);
            hasBounds = true;
          });
        });

        if (hasBounds) {
          map.fitBounds(bounds);
        }

        setMapsError(null);
      })
      .catch(() => setMapsError('No se pudo cargar Google Maps'));

    return () => {
      cancelled = true;
    };
  }, [zones]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#6b7280]">
        Configura `VITE_GOOGLE_MAPS_API_KEY` para visualizar el mapa.
      </div>
    );
  }

  if (mapsError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#6b7280]">
        {mapsError}
      </div>
    );
  }

  return <div ref={mapContainerRef} className="h-full w-full" />;
}
