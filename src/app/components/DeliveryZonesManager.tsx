import { Moon, Search, SunMedium } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  createDeliveryZone,
  deleteDeliveryZoneById,
  fetchDeliveryZones,
  type DeliveryZone,
  type DeliveryZonePoint,
  updateDeliveryZone,
  updateDeliveryZoneStatus,
} from '../api';
import { listHeadquarters, type Headquarter } from '../api/headquarter';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#333330' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#040925' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const LIGHT_STYLE: any[] = [];
const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let mapsPromise: Promise<any> | null = null;

type MapMode = 'view' | 'draw' | 'edit';

interface ZoneMapProps {
  zone: DeliveryZone | null;
  mode: MapMode;
  draft: DeliveryZonePoint[];
  onDraftChange: (pts: DeliveryZonePoint[]) => void;
  darkMode: boolean;
}

function loadGoogleMaps(): Promise<any> {
  const win = window as any;
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
}

function ZoneMap({ zone, mode, draft, onDraftChange, darkMode }: ZoneMapProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const savedPolygonRef = useRef<any>(null);
  const draftPolylineRef = useRef<any>(null);
  const draftPolygonRef = useRef<any>(null);
  const vertexMarkersRef = useRef<any[]>([]);
  const clickListenerRef = useRef<any>(null);

  const clearOverlays = useCallback(() => {
    savedPolygonRef.current?.setMap(null); savedPolygonRef.current = null;
    draftPolylineRef.current?.setMap(null); draftPolylineRef.current = null;
    draftPolygonRef.current?.setMap(null); draftPolygonRef.current = null;
    vertexMarkersRef.current.forEach((marker) => marker.setMap(null)); vertexMarkersRef.current = [];
    if (clickListenerRef.current) {
      googleRef.current?.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({ styles: darkMode ? DARK_STYLE : LIGHT_STYLE });
  }, [darkMode]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !divRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !divRef.current) return;
        googleRef.current = google;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(divRef.current, {
            center: { lat: -34.603722, lng: -58.381592 },
            zoom: 12,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'cooperative',
            styles: darkMode ? DARK_STYLE : LIGHT_STYLE,
          });
        }
        setMapsError(null);
      })
      .catch(() => setMapsError('No se pudo cargar Google Maps'));

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map) return;

    clearOverlays();
    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;

    const points = zone?.polygon ?? [];
    if (mode === 'view' && points.length >= 3) {
      savedPolygonRef.current = new google.maps.Polygon({
        paths: points,
        map,
        strokeColor: '#22c55e',
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: '#22c55e',
        fillOpacity: 0.18,
      });
      points.forEach((point) => { bounds.extend(point); hasBounds = true; });
    }

    if ((mode === 'draw' || mode === 'edit') && draft.length > 0) {
      draftPolylineRef.current = new google.maps.Polyline({
        path: draft,
        map,
        strokeColor: '#f59e0b',
        strokeOpacity: 1,
        strokeWeight: 2,
      });

      if (draft.length >= 3) {
        draftPolygonRef.current = new google.maps.Polygon({
          paths: draft,
          map,
          strokeColor: '#f59e0b',
          strokeOpacity: 0,
          strokeWeight: 0,
          fillColor: '#f59e0b',
          fillOpacity: 0.16,
        });
      }

      vertexMarkersRef.current = draft.map((point, index) => {
        const marker = new google.maps.Marker({
          position: point,
          map,
          draggable: true,
          zIndex: 10,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#111827',
            strokeWeight: 1.5,
            scale: 7,
          },
          title: `Vértice ${index + 1}`,
        });

        marker.addListener('dragend', (event: any) => {
          onDraftChange(
            draft.map((value, itemIndex) => (
              itemIndex === index
                ? { lat: event.latLng.lat(), lng: event.latLng.lng() }
                : value
            )),
          );
        });
        marker.addListener('rightclick', () => {
          onDraftChange(draft.filter((_, itemIndex) => itemIndex !== index));
        });

        return marker;
      });

      draft.forEach((point) => { bounds.extend(point); hasBounds = true; });
    }

    if (mode === 'draw' || mode === 'edit') {
      clickListenerRef.current = map.addListener('click', (event: any) => {
        onDraftChange([...draft, { lat: event.latLng.lat(), lng: event.latLng.lng() }]);
      });
    }

    if (hasBounds) map.fitBounds(bounds);
  }, [zone, mode, draft, onDraftChange, clearOverlays]);

  if (!GOOGLE_MAPS_API_KEY || mapsError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {mapsError ?? 'Configurá VITE_GOOGLE_MAPS_API_KEY para visualizar el mapa.'}
      </div>
    );
  }

  return <div ref={divRef} className="h-full w-full" />;
}

const getZoneStatusKey = (zone: DeliveryZone) => (zone.active ? 'active' : 'inactive');

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
    if (!confirm(`¿Eliminar la zona "${zone.name}"?`)) return;
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
    <div className="h-full overflow-hidden bg-body p-4 md:p-6">
      <div className="grid h-full gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="flex h-full flex-col rounded-2xl border border-border bg-card/70 p-3">
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

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/70">
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
                    onClick={() => handleDelete(selectedZone)}
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
              zone={mapZone}
              mode={activeMapMode}
              draft={draft}
              onDraftChange={setDraft}
              darkMode={darkMap}
            />

            <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
              <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Mapa</span>
              <button
                type="button"
                onClick={() => setDarkMap(false)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  !darkMap ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <SunMedium className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Claro</span>
              </button>
              <button
                type="button"
                onClick={() => setDarkMap(true)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  darkMap ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Oscuro</span>
              </button>
            </div>

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
    </div>
  );
}
