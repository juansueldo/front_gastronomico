import { MapPin, Moon, Search, SunMedium } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { DivIcon, type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import {
  createDeliveryZone,
  deleteDeliveryZoneById,
  fetchDeliveryZones,
  type DeliveryZone,
  type DeliveryZonePoint,
  updateDeliveryZone,
  updateDeliveryZoneStatus,
} from '../features/delivery-zones';
import { listHeadquarters, type Headquarter } from '../features/headquarters';
import { Input } from '../shared/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shared/ui/components/select';
import { DeleteConfirmDialog } from '../shared/ui/components/delete-confirm-dialog';

const DEFAULT_MAP_CENTER: LatLngExpression = [-34.603722, -58.381592];
const ZONE_COLORS = ['#22c55e', '#ff5a0a', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444'];
const LIGHT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

type MapMode = 'view' | 'draw' | 'edit';

interface ZoneMapProps {
  zones: DeliveryZone[];
  zone: DeliveryZone | null;
  mode: MapMode;
  draft: DeliveryZonePoint[];
  onDraftChange: (pts: DeliveryZonePoint[]) => void;
  darkMode: boolean;
}

const toPositions = (points: DeliveryZonePoint[]) => points.map((point) => [point.lat, point.lng] as [number, number]);

const vertexIcon = new DivIcon({
  className: '',
  html: '<span style="display:block;width:16px;height:16px;border-radius:999px;background:#f59e0b;border:2px solid #111827;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitZoneBounds({ bounds }: { bounds?: LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    }
  }, [bounds, map]);

  return null;
}

function InvalidateMapSize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => {
      map.invalidateSize({ animate: false });
    };

    invalidate();
    const firstFrame = window.requestAnimationFrame(invalidate);
    const timeout = window.setTimeout(invalidate, 250);
    const resizeObserver = new ResizeObserver(invalidate);
    resizeObserver.observe(container);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(timeout);
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}

function DraftMapEvents({
  enabled,
  draft,
  onDraftChange,
}: {
  enabled: boolean;
  draft: DeliveryZonePoint[];
  onDraftChange: (pts: DeliveryZonePoint[]) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onDraftChange([...draft, { lat: event.latlng.lat, lng: event.latlng.lng }]);
    },
  });

  return null;
}

function ZoneMap({ zones, zone, mode, draft, onDraftChange, darkMode }: ZoneMapProps) {
  const isDraftMode = mode === 'draw' || mode === 'edit';
  const bounds = useMemo<LatLngBoundsExpression | undefined>(() => {
    const sourcePoints = isDraftMode && draft.length > 0
      ? draft
      : zones.flatMap((item) => item.polygon);
    const validPoints = sourcePoints.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    return validPoints.length > 0 ? toPositions(validPoints) : undefined;
  }, [draft, isDraftMode, zones]);

  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        key={darkMode ? 'dark-map' : 'light-map'}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={darkMode ? DARK_TILE_URL : LIGHT_TILE_URL}
      />
      <InvalidateMapSize />
      <FitZoneBounds bounds={bounds} />
      <DraftMapEvents enabled={isDraftMode} draft={draft} onDraftChange={onDraftChange} />

      {zones.map((item, index) => {
        const selected = zone?.id === item.id;
        const color = selected ? '#ff5a0a' : ZONE_COLORS[index % ZONE_COLORS.length];
        const positions = toPositions(item.polygon);
        if (positions.length < 3) return null;

        return (
          <Polygon
            key={item.id ?? `${item.name}-${index}`}
            positions={positions}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: selected ? 0.24 : 0.12,
              opacity: item.active === false ? 0.45 : 0.95,
              weight: selected ? 3 : 2,
            }}
          >
            <Tooltip sticky>{item.name ?? 'Zona sin nombre'}</Tooltip>
            <Popup>
              <div className="text-sm">
                <strong>{item.name ?? 'Zona sin nombre'}</strong>
                <br />
                {item.active === false ? 'Inactiva' : 'Activa'} · {item.polygon.length} vértices
              </div>
            </Popup>
          </Polygon>
        );
      })}

      {draft.length > 0 ? (
        <>
          <Polyline positions={toPositions(draft)} pathOptions={{ color: '#f59e0b', weight: 3 }} />
          {draft.length >= 3 ? (
            <Polygon
              positions={toPositions(draft)}
              pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.18, weight: 2 }}
            />
          ) : null}
          {draft.map((point, index) => (
            <Marker
              key={`${point.lat}-${point.lng}-${index}`}
              position={[point.lat, point.lng]}
              icon={vertexIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const nextPoint = event.target.getLatLng();
                  onDraftChange(draft.map((value, itemIndex) => (
                    itemIndex === index ? { lat: nextPoint.lat, lng: nextPoint.lng } : value
                  )));
                },
                contextmenu() {
                  onDraftChange(draft.filter((_, itemIndex) => itemIndex !== index));
                },
              }}
            >
              <Tooltip>Vértice {index + 1}</Tooltip>
            </Marker>
          ))}
        </>
      ) : null}
    </MapContainer>
  );
}

const getZoneStatusKey = (zone: DeliveryZone) => (zone.active ? 'active' : 'inactive');

function MapThemeToggle({
  darkMap,
  onChange,
}: {
  darkMap: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
      <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Mapa</span>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          !darkMap ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <SunMedium className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Claro</span>
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          darkMap ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Oscuro</span>
      </button>
    </div>
  );
}

export function DeliveryZonesManager() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHeadquarters, setLoadingHeadquarters] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [mode, setMode] = useState<MapMode>('view');
  const [draft, setDraft] = useState<DeliveryZonePoint[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneHeadquarterId, setNewZoneHeadquarterId] = useState('');
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState('');
  const [darkMap, setDarkMap] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [zoneToDelete, setZoneToDelete] = useState<DeliveryZone | null>(null);

  const loadZones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDeliveryZones();
      setZones(data);
    } catch {
      toast.error('No se pudieron cargar las zonas de entrega');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHeadquarters = useCallback(async () => {
    setLoadingHeadquarters(true);
    try {
      const data = await listHeadquarters({ page: 1, pageSize: 100 });
      setHeadquarters(data.rows ?? []);
      const firstHeadquarterId = String(data.rows?.[0]?.id ?? '');
      setNewZoneHeadquarterId((currentValue) => currentValue || firstHeadquarterId);
    } catch {
      toast.error('No se pudieron cargar las sedes');
    } finally {
      setLoadingHeadquarters(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadZones(), loadHeadquarters()]);
  }, [loadZones, loadHeadquarters]);

  const zoneHeadquarterName = useCallback((zone: DeliveryZone) => {
    const zoneHeadquarterId = String(zone.headquarterId ?? '');
    if (!zoneHeadquarterId) return 'Sin sede';
    return headquarters.find((headquarter) => String(headquarter.id) === zoneHeadquarterId)?.name ?? `Sede #${zoneHeadquarterId}`;
  }, [headquarters]);

  const filteredZones = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return zones.filter((zone) => {
      const matchesStatus = statusFilter === 'all' || getZoneStatusKey(zone) === statusFilter;
      const matchesSearch = !normalizedSearch
        || String(zone.name ?? '').toLowerCase().includes(normalizedSearch)
        || zoneHeadquarterName(zone).toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [zones, searchValue, statusFilter, zoneHeadquarterName]);

  const totalVertices = useMemo(
    () => zones.reduce((accumulator, zone) => accumulator + zone.polygon.length, 0),
    [zones],
  );
  const activeCount = useMemo(
    () => zones.filter((zone) => zone.active).length,
    [zones],
  );

  const selectZone = (zone: DeliveryZone) => {
    setSelectedZone(zone);
    setSelectedHeadquarterId(String(zone.headquarterId ?? ''));
    setMode('view');
    setDraft([]);
    setShowNewForm(false);
  };

  const startCreate = () => {
    setShowNewForm(true);
    setSelectedZone(null);
    setMode('view');
    setDraft([]);
    setNewZoneName('');
    setSelectedHeadquarterId('');
  };

  const cancelCreate = () => {
    setShowNewForm(false);
    setDraft([]);
    setNewZoneName('');
  };

  const handleCreate = async () => {
    const name = newZoneName.trim();
    const parsedHeadquarterId = Number(newZoneHeadquarterId);

    if (!name) { toast.error('Ingresá un nombre para la zona'); return; }
    if (!Number.isInteger(parsedHeadquarterId) || parsedHeadquarterId <= 0) {
      toast.error('Seleccioná una sede válida para la zona');
      return;
    }
    if (draft.length < 3) { toast.error('Dibujá al menos 3 puntos en el mapa'); return; }

    setSaving(true);
    try {
      const created = await createDeliveryZone({
        name,
        polygon: draft,
        headquarterId: parsedHeadquarterId,
        zoneid: `ZONE_${Date.now()}`,
      });
      if (!created) throw new Error('No se pudo crear la zona');

      const createdWithHeadquarter = {
        ...created,
        headquarterId: created.headquarterId ?? parsedHeadquarterId,
      };

      await loadZones();
      setSelectedZone(createdWithHeadquarter);
      setSelectedHeadquarterId(String(createdWithHeadquarter.headquarterId ?? ''));
      setShowNewForm(false);
      setMode('view');
      setDraft([]);
      setNewZoneName('');
      toast.success('Zona creada');
    } catch {
      toast.error('No se pudo crear la zona');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    if (!selectedZone) return;
    setDraft([...selectedZone.polygon]);
    setSelectedHeadquarterId(String(selectedZone.headquarterId ?? ''));
    setMode('edit');
  };

  const cancelEdit = () => {
    setMode('view');
    setDraft([]);
    if (selectedZone) {
      setSelectedHeadquarterId(String(selectedZone.headquarterId ?? ''));
    }
  };

  const saveEdit = async () => {
    if (!selectedZone) return;
    const parsedHeadquarterId = Number(selectedHeadquarterId);
    if (!Number.isInteger(parsedHeadquarterId) || parsedHeadquarterId <= 0) {
      toast.error('Seleccioná una sede válida para la zona');
      return;
    }
    if (draft.length < 3) { toast.error('La zona necesita al menos 3 puntos'); return; }

    setSaving(true);
    try {
      const updated = await updateDeliveryZone(selectedZone.id!, {
        polygon: draft,
        headquarterId: parsedHeadquarterId,
      });

      const nextZone = updated
        ? { ...selectedZone, ...updated, polygon: draft, headquarterId: updated.headquarterId ?? parsedHeadquarterId }
        : { ...selectedZone, polygon: draft, headquarterId: parsedHeadquarterId };

      await loadZones();
      setSelectedZone(nextZone);
      setMode('view');
      setDraft([]);
      toast.success('Zona actualizada');
    } catch {
      toast.error('No se pudo actualizar la zona');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (zone: DeliveryZone) => {
    try {
      await updateDeliveryZoneStatus(zone.id!, zone.active ? 2 : 1);
      const next = { ...zone, active: !zone.active, statusId: zone.active ? 2 : 1 };
      setZones((prev) => prev.map((item) => (item.id === zone.id ? next : item)));
      if (selectedZone?.id === zone.id) {
        setSelectedZone(next);
      }
    } catch {
      toast.error('No se pudo actualizar el estado');
    }
  };

  const handleDelete = async (zone: DeliveryZone) => {
    setSaving(true);
    try {
      await deleteDeliveryZoneById(zone.id!);
      await loadZones();
      if (selectedZone?.id === zone.id) {
        setSelectedZone(null);
        setSelectedHeadquarterId('');
        setMode('view');
        setDraft([]);
      }
      toast.success('Zona eliminada');
      setZoneToDelete(null);
    } catch {
      toast.error('No se pudo eliminar la zona');
    } finally {
      setSaving(false);
    }
  };

  const mapZone = showNewForm ? null : selectedZone;
  const activeMapMode: MapMode = showNewForm ? 'draw' : mode;
  const draftCount = draft.length;

  return (
    <div className="h-full overflow-y-auto bg-body p-3 sm:p-4 md:p-6 lg:overflow-hidden">
      <div className="grid min-h-full gap-4 lg:h-full lg:grid-cols-[300px_1fr]">
        <aside className="flex min-h-0 flex-col rounded-2xl border border-border bg-card/70 p-3 lg:h-full">
          <div className="mb-3 flex items-center gap-2">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="h-10 border-border bg-background text-foreground placeholder:text-muted-foreground"
              placeholder="Buscar zona..."
            />
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="mb-3 h-10 border-border bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover text-popover-foreground">
              <SelectItem value="all">Estado: Todas</SelectItem>
              <SelectItem value="active">Estado: Activas</SelectItem>
              <SelectItem value="inactive">Estado: Inactivas</SelectItem>
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={startCreate}
            disabled={showNewForm}
            className="mb-3 h-10 rounded-xl bg-primary px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            + Nueva zona
          </button>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">Cargando zonas...</div>
            ) : filteredZones.length === 0 ? (
              <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">Sin zonas para el filtro actual.</div>
            ) : (
              filteredZones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => selectZone(zone)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedZone?.id === zone.id && !showNewForm
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background hover:bg-muted/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{zone.name ?? 'Zona sin nombre'}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      zone.active ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200' : 'bg-slate-500/20 text-slate-700 dark:text-slate-200'
                    }`}>
                      {zone.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {zone.polygon.length} vértices · {zoneHeadquarterName(zone)}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Resumen</p>
            <div className="mt-2 flex items-center justify-between">
              <span>Zonas totales</span>
              <span className="font-semibold text-foreground">{zones.length}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Activas</span>
              <span className="font-semibold text-foreground">{activeCount}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Vértices totales</span>
              <span className="font-semibold text-foreground">{totalVertices}</span>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-card/70 lg:h-full lg:min-h-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <p className="text-base font-semibold text-foreground">
              {showNewForm ? 'Nueva zona' : selectedZone?.name ?? 'Detalle de zona'}
            </p>
            {selectedZone && !showNewForm ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                selectedZone.active ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200' : 'bg-slate-500/20 text-slate-700 dark:text-slate-200'
              }`}>
                {selectedZone.active ? 'Activa' : 'Inactiva'}
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <MapThemeToggle darkMap={darkMap} onChange={setDarkMap} />
              {selectedZone && !showNewForm && mode === 'view' ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleActive(selectedZone)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted"
                  >
                    {selectedZone.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-200"
                  >
                    Editar zona
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoneToDelete(selectedZone)}
                    disabled={saving}
                    className="rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-500/20 disabled:opacity-40 dark:text-red-200"
                  >
                    Eliminar
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <ZoneMap
              zones={zones}
              zone={mapZone}
              mode={activeMapMode}
              draft={draft}
              onDraftChange={setDraft}
              darkMode={darkMap}
            />

            {!selectedZone && !showNewForm ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="rounded-lg bg-background/85 px-3 py-2 text-xs text-muted-foreground">
                  Seleccioná una zona de la lista o creá una nueva.
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-border px-4 py-3">
            {showNewForm ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={newZoneName}
                  onChange={(event) => setNewZoneName(event.target.value)}
                  placeholder="Nombre de la zona"
                  className="h-10 min-w-[180px] flex-1 border-border bg-background text-foreground"
                />
                <Select
                  value={newZoneHeadquarterId}
                  onValueChange={setNewZoneHeadquarterId}
                  disabled={loadingHeadquarters || headquarters.length === 0}
                >
                  <SelectTrigger className="h-10 min-w-[210px] border-border bg-background text-foreground">
                    <SelectValue placeholder="Seleccioná sede" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {headquarters.map((headquarter) => (
                      <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                        {headquarter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {draftCount} punto{draftCount !== 1 ? 's' : ''} · mínimo 3
                </span>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving || draftCount < 3 || !newZoneName.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40"
                >
                  {saving ? 'Guardando…' : 'Guardar zona'}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => prev.slice(0, -1))}
                  disabled={draftCount === 0}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted disabled:opacity-40"
                >
                  Deshacer
                </button>
                <button
                  type="button"
                  onClick={cancelCreate}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted"
                >
                  Cancelar
                </button>
                <span className="w-full text-[11px] text-muted-foreground">
                  Click para agregar puntos · arrastrá vértices para moverlos · clic derecho para borrarlos.
                </span>
              </div>
            ) : null}

            {selectedZone && mode === 'edit' && !showNewForm ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Editando <span className="font-medium text-foreground">{selectedZone.name}</span> · {draftCount} punto{draftCount !== 1 ? 's' : ''}
                </p>
                <Select
                  value={selectedHeadquarterId}
                  onValueChange={setSelectedHeadquarterId}
                  disabled={loadingHeadquarters || headquarters.length === 0}
                >
                  <SelectTrigger className="h-10 min-w-[210px] border-border bg-background text-foreground">
                    <SelectValue placeholder="Seleccioná sede" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {headquarters.map((headquarter) => (
                      <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                        {headquarter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving || draftCount < 3}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40"
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => prev.slice(0, -1))}
                  disabled={draftCount === 0}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted disabled:opacity-40"
                >
                  Deshacer
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted"
                >
                  Cancelar
                </button>
              </div>
            ) : null}

            {selectedZone && mode === 'view' && !showNewForm ? (
              <div className="text-xs text-muted-foreground">
                Sede asignada: <span className="font-medium text-foreground">{zoneHeadquarterName(selectedZone)}</span>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <DeleteConfirmDialog
        open={Boolean(zoneToDelete)}
        onOpenChange={(open) => {
          if (!open) setZoneToDelete(null);
        }}
        itemLabel="Zona"
        itemName={zoneToDelete?.name ?? 'Zona sin nombre'}
        itemIcon={<MapPin size={24} className="text-[var(--primary)]" />}
        loading={saving}
        onConfirm={async () => {
          if (!zoneToDelete) return;
          await handleDelete(zoneToDelete);
        }}
      />
    </div>
  );
}
