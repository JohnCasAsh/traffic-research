import { useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { LoaderCircle, Navigation } from 'lucide-react';

type TrafficLevel = 'low' | 'moderate' | 'heavy';

type RouteMetric = {
  id: string;
  label: string;
  description: string;
  encodedPolyline?: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedCostPhp: number;
  totalFuelLiters: number;
  totalEnergyKwh: number;
  efficiencyScore: number;
  trafficLevel: TrafficLevel;
};

type RouteAnalysisMapProps = {
  routes: RouteMetric[];
  fuelType: string;
};

const DEFAULT_CENTER = { lat: 17.6132, lng: 121.727 };

function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  if (!encoded || typeof encoded !== 'string') {
    return [];
  }

  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length + 1);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length + 1);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function trafficColor(level: TrafficLevel) {
  if (level === 'heavy') {
    return '#ef4444';
  }

  if (level === 'moderate') {
    return '#f97316';
  }

  return '#22c55e';
}

function formatFuel(route: RouteMetric, fuelType: string) {
  if (fuelType === 'electric') {
    return `${route.totalEnergyKwh.toFixed(2)} kWh`;
  }

  return `${route.totalFuelLiters.toFixed(2)} L`;
}

function scoreLabel(value: number) {
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(0, Math.min(100, rounded));
}

export function RouteAnalysisMap({ routes, fuelType }: RouteAnalysisMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const polylinesRef = useRef<Map<string, any>>(new Map());
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const mapsApiKey = useMemo(() => {
    return (
      (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
        ?.VITE_GOOGLE_MAPS_API_KEY || ''
    ).trim();
  }, []);

  useEffect(() => {
    if (!selectedRouteId && routes.length > 0) {
      const recommended = routes.find((route) => scoreLabel(route.efficiencyScore) === 100) || routes[0];
      setSelectedRouteId(recommended.id);
      return;
    }

    if (!routes.some((route) => route.id === selectedRouteId)) {
      setSelectedRouteId(routes[0]?.id || null);
    }
  }, [routes, selectedRouteId]);

  const routePaths = useMemo(() => {
    const result = new Map<string, Array<{ lat: number; lng: number }>>();

    for (const route of routes) {
      const decoded = decodePolyline(route.encodedPolyline || '');
      if (decoded.length > 1) {
        result.set(route.id, decoded);
      }
    }

    return result;
  }, [routes]);

  const selectedRoute =
    routes.find((route) => route.id === selectedRouteId) || routes[0] || null;

  useEffect(() => {
    let disposed = false;

    async function setupMap() {
      if (!mapsApiKey) {
        setMapError('Google Maps key is missing.');
        return;
      }

      try {
        setOptions({ key: mapsApiKey, v: 'weekly' });
        await importLibrary('maps');

        if (disposed || !mapContainerRef.current) {
          return;
        }

        const gmaps = (window as any).google?.maps;
        if (!gmaps) {
          throw new Error('Google Maps runtime not available.');
        }

        const map = new gmaps.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        mapRef.current = map;
        setMapReady(true);
        setMapError(null);
      } catch (error: any) {
        setMapError(error?.message || 'Failed to initialize map.');
      }
    }

    setupMap();

    return () => {
      disposed = true;
      if (startMarkerRef.current) {
        startMarkerRef.current.setMap(null);
        startMarkerRef.current = null;
      }

      if (endMarkerRef.current) {
        endMarkerRef.current.setMap(null);
        endMarkerRef.current = null;
      }

      for (const line of polylinesRef.current.values()) {
        line.setMap(null);
      }
      polylinesRef.current.clear();

      mapRef.current = null;
      setMapReady(false);
    };
  }, [mapsApiKey]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const gmaps = (window as any).google?.maps;
    if (!gmaps) {
      return;
    }

    for (const existingLine of polylinesRef.current.values()) {
      existingLine.setMap(null);
    }
    polylinesRef.current.clear();

    const bounds = new gmaps.LatLngBounds();

    for (const route of routes) {
      const path = routePaths.get(route.id);
      if (!path || path.length < 2) {
        continue;
      }

      const isSelected = selectedRouteId === route.id;
      const polyline = new gmaps.Polyline({
        map: mapRef.current,
        path,
        strokeColor: trafficColor(route.trafficLevel),
        strokeOpacity: isSelected ? 0.95 : 0.35,
        strokeWeight: isSelected ? 7 : 4,
        zIndex: isSelected ? 30 : 10,
      });

      polyline.addListener('click', () => {
        setSelectedRouteId(route.id);
      });

      polylinesRef.current.set(route.id, polyline);

      for (const point of path) {
        bounds.extend(point);
      }
    }

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 52);
    }

    for (const route of routes) {
      const line = polylinesRef.current.get(route.id);
      if (!line) {
        continue;
      }

      const isSelected = selectedRouteId === route.id;
      line.setOptions({
        strokeOpacity: isSelected ? 0.95 : 0.35,
        strokeWeight: isSelected ? 7 : 4,
        zIndex: isSelected ? 30 : 10,
      });
    }

    const activePath = selectedRoute ? routePaths.get(selectedRoute.id) : null;
    if (activePath && activePath.length > 1) {
      const startPoint = activePath[0];
      const endPoint = activePath[activePath.length - 1];

      if (startMarkerRef.current) {
        startMarkerRef.current.setMap(null);
      }

      if (endMarkerRef.current) {
        endMarkerRef.current.setMap(null);
      }

      startMarkerRef.current = new gmaps.Marker({
        map: mapRef.current,
        position: startPoint,
        label: {
          text: 'A',
          color: '#ffffff',
          fontWeight: '700',
        },
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          fillColor: '#0ea5e9',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 9,
        },
      });

      endMarkerRef.current = new gmaps.Marker({
        map: mapRef.current,
        position: endPoint,
        label: {
          text: 'B',
          color: '#ffffff',
          fontWeight: '700',
        },
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 9,
        },
      });
    }
  }, [mapReady, routePaths, routes, selectedRoute, selectedRouteId]);

  if (!routes.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No route data available for map rendering.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative min-h-[360px] sm:min-h-[430px] lg:min-h-[520px] rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {!mapReady && !mapError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm">
            <div className="text-center px-4">
              <LoaderCircle className="w-7 h-7 text-teal-600 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-700">Loading route map...</p>
            </div>
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/95 px-4">
            <p className="text-sm text-red-700 text-center">{mapError}</p>
          </div>
        )}

        <div className="absolute top-3 left-3 right-3 z-10 hidden sm:flex gap-2 overflow-x-auto pb-1">
          {routes.map((route) => {
            const active = route.id === selectedRouteId;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => setSelectedRouteId(route.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white/95 border-slate-200 text-slate-700 hover:bg-white'}`}
              >
                {route.label} • ₱{route.estimatedCostPhp.toFixed(2)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Map Route Details</h3>
          <p className="text-xs text-slate-600 mt-1">
            Select a route to sync map path, travel stats, and price.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {routes.map((route) => {
            const active = route.id === selectedRouteId;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => setSelectedRouteId(route.id)}
                className={`text-left rounded-xl border p-3 transition ${active ? 'border-teal-500 bg-teal-50 shadow-sm' : 'border-slate-200 bg-white hover:border-teal-300'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{route.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{route.description}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-full ${active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {scoreLabel(route.efficiencyScore)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <MapStat label="Distance" value={`${route.distanceKm.toFixed(2)} km`} />
                  <MapStat label="Duration" value={`${route.durationMinutes.toFixed(1)} min`} />
                  <MapStat label={fuelType === 'electric' ? 'Energy' : 'Fuel'} value={formatFuel(route, fuelType)} />
                  <MapStat label="Cost" value={`₱${route.estimatedCostPhp.toFixed(2)}`} emphasize />
                </div>

                <div className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                  <Navigation className="w-3 h-3 mr-1" />
                  {route.trafficLevel.charAt(0).toUpperCase() + route.trafficLevel.slice(1)} traffic
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MapStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${emphasize ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${emphasize ? 'text-green-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
