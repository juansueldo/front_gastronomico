import { Moon, SunMedium } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

// ─── Types ───────────────────────────────────────────────────────────────────

// ─── API helpers (inline, sin depender del módulo externo) ────────────────────
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

const LIGHT_STYLE: any[] = []; // estilo por defecto de Google

// ─── Google Maps loader (singleton) ──────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
let _mapsPromise: Promise<any> | null = null;

function loadGoogleMaps(): Promise<any> {
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (_mapsPromise) return _mapsPromise;
  _mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(w.google);
    s.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
    document.head.appendChild(s);
  });
  return _mapsPromise;
}

// ─── Map sub-component ────────────────────────────────────────────────────────

type MapMode = 'view' | 'draw' | 'edit';

interface ZoneMapProps {
  zone: DeliveryZone | null;
  mode: MapMode;
  draft: DeliveryZonePoint[];
  onDraftChange: (pts: DeliveryZonePoint[]) => void;
  darkMode: boolean; // 👈
}

function ZoneMap({ zone, mode, draft, onDraftChange,darkMode }: ZoneMapProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);

  // refs para overlays
  const savedPolygonRef = useRef<any>(null);
  const draftPolylineRef = useRef<any>(null);
  const draftPolygonRef = useRef<any>(null);
  const vertexMarkersRef = useRef<any[]>([]);
  const clickListenerRef = useRef<any>(null);

  const clearOverlays = useCallback(() => {
    savedPolygonRef.current?.setMap(null); savedPolygonRef.current = null;
    draftPolylineRef.current?.setMap(null); draftPolylineRef.current = null;
    draftPolygonRef.current?.setMap(null); draftPolygonRef.current = null;
    vertexMarkersRef.current.forEach(m => m.setMap(null)); vertexMarkersRef.current = [];
    if (clickListenerRef.current) {
      googleRef.current?.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
  }, []);
useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({ styles: darkMode ? DARK_STYLE : LIGHT_STYLE });
  }, [darkMode]);
  // Init mapa
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !divRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(google => {
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

  // Re-render overlays
  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map) return;
    clearOverlays();

    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;

    // Zona guardada en modo view
    const points = zone?.polygon ?? [];
    if (mode === 'view' && points.length >= 3) {
      savedPolygonRef.current = new google.maps.Polygon({
        paths: points, map,
        strokeColor: '#06b6d4', strokeOpacity: 1, strokeWeight: 2,
        fillColor: '#06b6d4', fillOpacity: 0.15,
      });
      points.forEach(p => { bounds.extend(p); hasBounds = true; });
    }

    // Borrador (draw/edit)
    if ((mode === 'draw' || mode === 'edit') && draft.length > 0) {
      draftPolylineRef.current = new google.maps.Polyline({
        path: draft, map,
        strokeColor: '#f59e0b', strokeOpacity: 1, strokeWeight: 2,
      });
      if (draft.length >= 3) {
        draftPolygonRef.current = new google.maps.Polygon({
          paths: draft, map,
          strokeColor: '#f59e0b', strokeOpacity: 0, strokeWeight: 0,
          fillColor: '#f59e0b', fillOpacity: 0.12,
        });
      }
      vertexMarkersRef.current = draft.map((pt, i) => {
        const vm = new google.maps.Marker({
          position: pt, map, draggable: true, zIndex: 10,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#f59e0b', fillOpacity: 1,
            strokeColor: '#111', strokeWeight: 1.5, scale: 7,
          },
          title: `Vértice ${i + 1} — clic derecho para borrar`,
        });
        vm.addListener('dragend', (e: any) => {
          onDraftChange(draft.map((v, idx) => idx === i ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : v));
        });
        vm.addListener('rightclick', () => {
          onDraftChange(draft.filter((_, idx) => idx !== i));
        });
        return vm;
      });
      draft.forEach(p => { bounds.extend(p); hasBounds = true; });
    }

    // Click listener para agregar puntos
    if (mode === 'draw' || mode === 'edit') {
      clickListenerRef.current = map.addListener('click', (e: any) => {
        onDraftChange([...draft, { lat: e.latLng.lat(), lng: e.latLng.lng() }]);
      });
    }

    if (hasBounds) map.fitBounds(bounds);
  }, [zone, mode, draft, clearOverlays, onDraftChange]);

  if (!GOOGLE_MAPS_API_KEY || mapsError) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400 text-center px-6">
        {mapsError ?? 'Configurá VITE_GOOGLE_MAPS_API_KEY para ver el mapa'}
      </div>
    );
  }

  return <div ref={divRef} className="h-full w-full" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DeliveryZonesManager() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // zona seleccionada para ver/editar
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [mode, setMode] = useState<MapMode>('view');
  const [draft, setDraft] = useState<DeliveryZonePoint[]>([]);

  // form de nueva zona
  const [showNewForm, setShowNewForm] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
const [darkMap, setDarkMap] = useState(true);
  // ── Cargar zonas ──────────────────────────────────────────────────────────
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

  useEffect(() => { void loadZones(); }, [loadZones]);

  // ── Seleccionar zona ──────────────────────────────────────────────────────
  const selectZone = (zone: DeliveryZone) => {
    setSelectedZone(zone);
    setMode('view');
    setDraft([]);
    setShowNewForm(false);
  };

  // ── Crear zona ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const name = newZoneName.trim();
    if (!name) { toast.error('Ingresá un nombre para la zona'); return; }
    if (draft.length < 3) { toast.error('Dibujá al menos 3 puntos en el mapa'); return; }
    setSaving(true);
    try {
      const created = await createDeliveryZone({
        name,
        polygon: draft,
        zoneid: `ZONE_${Date.now()}`,
        metadata: {},
      });

      if (!created) {
        throw new Error('No se pudo normalizar la zona creada');
      }

      await loadZones();
      setSelectedZone(created);
      setMode('view');
      setDraft([]);
      setShowNewForm(false);
      setNewZoneName('');
      toast.success('Zona creada');
    } catch {
      toast.error('No se pudo crear la zona');
    } finally {
      setSaving(false);
    }
  };

  // ── Editar zona ───────────────────────────────────────────────────────────
  const startEdit = () => {
    if (!selectedZone) return;
    setDraft([...selectedZone.polygon]);
    setMode('edit');
  };

  const saveEdit = async () => {
    if (!selectedZone) return;
    if (draft.length < 3) { toast.error('La zona necesita al menos 3 puntos'); return; }
    setSaving(true);
    try {
      const updated = await updateDeliveryZone(selectedZone.id!, { polygon: draft });
      const next = updated ? { ...selectedZone, ...updated, polygon: draft } : { ...selectedZone, polygon: draft };
      await loadZones();
      setSelectedZone(next);
      setMode('view');
      setDraft([]);
      toast.success('Zona actualizada');
    } catch {
      toast.error('No se pudo actualizar la zona');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setMode('view');
    setDraft([]);
  };

  // ── Eliminar zona ─────────────────────────────────────────────────────────
  const handleDelete = async (zone: DeliveryZone) => {
    if (!confirm(`¿Eliminás la zona "${zone.name}"?`)) return;
    setSaving(true);
    try {
      await deleteDeliveryZoneById(zone.id!);
      await loadZones();
      if (selectedZone?.id === zone.id) {
        setSelectedZone(null);
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

  // ── Toggle activo ─────────────────────────────────────────────────────────
  const toggleActive = async (zone: DeliveryZone) => {
    try {
      await updateDeliveryZoneStatus(zone.id!, zone.active ? 2 : 1);
      const next = { ...zone, active: !zone.active, statusId: zone.active ? 2 : 1 };
      await loadZones();
      setZones(prev => prev.map(z => z.id === zone.id ? next : z));
      if (selectedZone?.id === zone.id) setSelectedZone(next);
    } catch {
      toast.error('No se pudo actualizar el estado');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const isDrawing = showNewForm || mode === 'edit';
  const mapZone = showNewForm ? null : selectedZone;

  return (
    <div className="h-full bg-body flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-orange-700/40">
        <h1 className="text-lg font-semibold text-white tracking-tight">Zonas de entrega</h1>
        <button
          onClick={() => {
            setShowNewForm(true);
            setSelectedZone(null);
            setMode('view');
            setDraft([]);
          }}
          disabled={showNewForm}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-40"
        >
          + Nueva zona
        </button>
      </div>


      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — lista de zonas */}
        <aside className="w-60 shrink-0 border-r border-orange-700/40 overflow-y-auto flex flex-col">
          {loading ? (
            <div className="p-4 text-xs text-gray-500">Cargando...</div>
          ) : zones.length === 0 ? (
            <div className="p-4 text-xs text-gray-500">Sin zonas configuradas</div>
          ) : (
            <ul className="divide-y divide-orange-700/20">
              {zones.map(zone => (
                <li key={zone.id}>
                  <button
                    onClick={() => selectZone(zone)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-800/60 ${selectedZone?.id === zone.id && !showNewForm ? 'bg-gray-800/80 border-l-2 border-orange-500' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm text-white truncate">{zone.name}</span>
                      <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${zone.active ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-400'}`}>
                        {zone.active ? 'activa' : 'inactiva'}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500">{zone.polygon.length} vértices</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Panel principal */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Mapa */}
          <div className="relative flex-1">
            <ZoneMap
              zone={mapZone}
              mode={showNewForm ? 'draw' : mode}
              draft={draft}
              onDraftChange={setDraft}
              darkMode={darkMap}
            />

            <div className="absolute right-4 top-4 z-10">
              <div className="flex items-center gap-1 rounded-xl border border-orange-700/50 bg-card/95 p-1 shadow-lg backdrop-blur">
                <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Mapa
                </span>
                <button
                  type="button"
                  onClick={() => setDarkMap(false)}
                  aria-pressed={!darkMap}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    !darkMap
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-300 hover:bg-orange-700/30 hover:text-white'
                  }`}
                  title="Usar mapa claro"
                >
                  <SunMedium className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Claro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMap(true)}
                  aria-pressed={darkMap}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    darkMap
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-300 hover:bg-orange-700/30 hover:text-white'
                  }`}
                  title="Usar mapa oscuro"
                >
                  <Moon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Oscuro</span>
                </button>
              </div>
            </div>

            {/* Overlay hint cuando no hay zona seleccionada */}
            {!selectedZone && !showNewForm && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-xs text-gray-600 px-3 py-2 rounded-lg">
                  Seleccioná una zona o creá una nueva
                </p>
              </div>
            )}
          </div>

          {/* Barra de controles */}
          <div className="border-t border-orange-700/40">

            {/* ── Crear nueva zona ── */}
            {showNewForm && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <input
                  type="text"
                  placeholder="Nombre de la zona"
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                  className="flex-1 min-w-[140px] px-3 py-1.5 text-sm  border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
                <span className="text-xs text-amber-400">
                  {draft.length} punto{draft.length !== 1 ? 's' : ''} — mínimo 3
                </span>
                <button
                  onClick={handleCreate}
                  disabled={saving || draft.length < 3 || !newZoneName.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-40"
                >
                  {saving ? 'Guardando…' : 'Guardar zona'}
                </button>
                <button
                  onClick={() => { setDraft(p => p.slice(0, -1)); }}
                  disabled={draft.length === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-40"
                >
                  Deshacer
                </button>
                <button
                  onClick={() => { setShowNewForm(false); setDraft([]); setNewZoneName(''); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-600 hover:bg-gray-800 text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <span className="w-full text-[11px] text-amber-400/70">
                  Click en el mapa para agregar · arrastrar vértice para mover · click derecho en vértice para borrar
                </span>
              </div>
            )}

            {/* ── Zona seleccionada — modo vista ── */}
            {selectedZone && !showNewForm && mode === 'view' && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="text-sm text-white font-medium">{selectedZone.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${selectedZone.active ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-400'}`}>
                  {selectedZone.active ? 'activa' : 'inactiva'}
                </span>
                <span className="text-xs text-gray-500">{selectedZone.polygon.length} vértices</span>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(selectedZone)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                  >
                    {selectedZone.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={startEdit}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-700 hover:bg-amber-600 text-white transition-colors"
                  >
                    Editar zona
                  </button>
                  <button
                    onClick={() => handleDelete(selectedZone)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-800 hover:bg-red-700 text-white transition-colors disabled:opacity-40"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}

            {/* ── Zona seleccionada — modo edición ── */}
            {selectedZone && !showNewForm && mode === 'edit' && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="text-xs text-amber-400">
                  Editando: <strong className="text-white">{selectedZone.name}</strong> — {draft.length} punto{draft.length !== 1 ? 's' : ''}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving || draft.length < 3}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-40"
                  >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button
                    onClick={() => setDraft(p => p.slice(0, -1))}
                    disabled={draft.length === 0}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-40"
                  >
                    Deshacer
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-600 hover:bg-gray-800 text-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
                <span className="w-full text-[11px] text-amber-400/70">
                  Click en el mapa para agregar · arrastrar vértice para mover · click derecho en vértice para borrar
                </span>
              </div>
            )}

            {/* Fallback cuando no hay nada seleccionado */}
            {!selectedZone && !showNewForm && (
              <div className="px-4 py-3 text-xs text-gray-500">
                Seleccioná una zona de la lista o creá una nueva.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
