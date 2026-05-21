import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PublicStoreDeliveryZone } from '../storefrontApi';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search } from 'lucide-react';

type AddressSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_CENTER: LatLngExpression = [-34.603722, -58.381592];
const ZONE_COLORS = ['#ff5a2f', '#22c55e', '#3b82f6', '#f59e0b', '#e11d48', '#6366f1'];

const searchAddressSuggestions = async (query: string): Promise<AddressSuggestion[]> => {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 4) {
    return [];
  }

  const response = await fetch(
    `${NOMINATIM_SEARCH_URL}?format=json&addressdetails=1&limit=5&countrycodes=ar&q=${encodeURIComponent(trimmedQuery)}`,
    { method: 'GET' },
  );

  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => []);
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item: any, index: number) => {
      const latitude = Number(item?.lat);
      const longitude = Number(item?.lon);
      const label = String(item?.display_name ?? '').trim();
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !label) {
        return null;
      }

      return {
        id: String(item?.place_id ?? `${label}-${index}`),
        label,
        latitude,
        longitude,
      };
    })
    .filter((item: AddressSuggestion | null): item is AddressSuggestion => item !== null);
};

const pointInPolygon = (
  point: { latitude: number; longitude: number },
  polygon: PublicStoreDeliveryZone['polygon'],
) => {
  let isInside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
};

function FitMapBounds({ bounds, selectedPoint }: { bounds?: LatLngBoundsExpression; selectedPoint?: AddressSuggestion | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedPoint) {
      map.setView([selectedPoint.latitude, selectedPoint.longitude], 15, { animate: true });
      return;
    }

    if (bounds) {
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  }, [bounds, map, selectedPoint]);

  return null;
}

export function DeliveryZonesOverviewMap({ zones }: { zones: PublicStoreDeliveryZone[] }) {
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<AddressSuggestion | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const bounds = useMemo<LatLngBoundsExpression | undefined>(() => {
    const points = zones.flatMap((zone) => zone.polygon.map((point) => [point.lat, point.lng] as [number, number]));
    return points.length > 0 ? points : undefined;
  }, [zones]);

  const matchingZones = useMemo(() => {
    if (!selectedPoint) {
      return [];
    }

    return zones.filter((zone) => pointInPolygon(selectedPoint, zone.polygon));
  }, [selectedPoint, zones]);

  const handleSearchAddress = async () => {
    const trimmedQuery = addressQuery.trim();
    if (trimmedQuery.length < 4) {
      setSuggestions([]);
      setSelectedPoint(null);
      setSearchMessage('Ingresá al menos 4 caracteres para buscar.');
      return;
    }

    setIsSearching(true);
    setSearchMessage('');
    try {
      const nextSuggestions = await searchAddressSuggestions(trimmedQuery);
      setSuggestions(nextSuggestions);
      setSelectedPoint(null);
      setSearchMessage(nextSuggestions.length === 0 ? 'No encontramos direcciones para esa búsqueda.' : '');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setAddressQuery(suggestion.label);
    setSuggestions([]);
    setSelectedPoint(suggestion);
    const zonesForAddress = zones.filter((zone) => pointInPolygon(suggestion, zone.polygon));
    setSearchMessage(
      zonesForAddress.length > 0
        ? `Dirección dentro de zona: ${zonesForAddress.map((zone) => zone.name).join(', ')}`
        : 'La dirección está fuera de las zonas activas.',
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eef3f6]">
      <div className="absolute left-4 right-4 top-4 z-[1000] rounded-2xl border border-[#eee2d8] bg-white/95 p-3 shadow-[0_12px_35px_rgba(20,29,40,0.18)] backdrop-blur md:left-auto md:w-[520px]">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b949e]" />
            <Input
              value={addressQuery}
              onChange={(event) => {
                setAddressQuery(event.target.value);
                setSelectedPoint(null);
                setSearchMessage('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearchAddress();
                }
              }}
              placeholder="Buscar dirección para comprobar cobertura"
              className="h-11 rounded-xl border-[#e3d7cc] !bg-white pl-9 !text-[#1f2937] placeholder:!text-[#8a8f98] focus-visible:border-[#ff5a2f] focus-visible:ring-2 focus-visible:ring-[#ff5a2f]/20"
            />
          </div>
          <Button
            type="button"
            onClick={() => void handleSearchAddress()}
            className="h-11 rounded-xl bg-[#ff5a2f] px-4 !text-white hover:bg-[#ed4f25]"
            disabled={isSearching}
          >
            {isSearching ? 'Buscando' : 'Buscar'}
          </Button>
        </div>

        {suggestions.length > 0 ? (
          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-[#eee2d8] bg-white p-1 shadow-lg">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-[#1f2937] transition hover:bg-[#fff3ef]"
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}

        {searchMessage ? (
          <p className={`mt-2 text-xs font-semibold ${matchingZones.length > 0 ? 'text-[#239653]' : 'text-[#c84a2d]'}`}>
            {searchMessage}
          </p>
        ) : null}
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapBounds bounds={bounds} selectedPoint={selectedPoint} />
        {zones.map((zone, index) => {
          const color = ZONE_COLORS[index % ZONE_COLORS.length];
          const positions = zone.polygon.map((point) => [point.lat, point.lng] as [number, number]);
          return (
            <Polygon
              key={zone.id}
              positions={positions}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.18,
                weight: 2,
              }}
            >
              <Popup>{zone.name}</Popup>
            </Polygon>
          );
        })}
        {selectedPoint ? (
          <CircleMarker
            center={[selectedPoint.latitude, selectedPoint.longitude]}
            radius={8}
            pathOptions={{
              color: matchingZones.length > 0 ? '#16a34a' : '#dc2626',
              fillColor: matchingZones.length > 0 ? '#22c55e' : '#ef4444',
              fillOpacity: 0.85,
              weight: 3,
            }}
          >
            <Popup>{selectedPoint.label}</Popup>
          </CircleMarker>
        ) : null}
      </MapContainer>
    </div>
  );
}
