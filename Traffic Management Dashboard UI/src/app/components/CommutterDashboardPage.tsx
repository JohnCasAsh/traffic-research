/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  ParkingSquare, MapPin, Search, Navigation, PersonStanding,
  Car, X, RefreshCw, MapPinOff,
} from 'lucide-react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { API_URL, buildAuthHeaders } from '../api';
import { useLocationConsent } from '../LocationConsentContext';
import { useAuth } from '../auth';
import { AssistantPanel } from './AssistantPanel';

const MAPS_API_KEY = (
  (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
    ?.VITE_GOOGLE_MAPS_API_KEY || ''
).trim();

const TUGUEGARAO = { lat: 17.6128, lng: 121.7270 };

type ParkingLocation = {
  id: string; name: string; type: string;
  lat: number; lng: number; notes: string;
  fare_normal: number | null; fare_discounted: number | null;
  fuel_prices?: { name: string; price: string }[] | null;
  photo: string | null;
};

const GAS_TYPES = new Set(['gas_station', 'gasoline_station', 'diesel_station', 'ev_charging']);

const TYPE_LABELS: Record<string, string> = {
  mall: 'Mall Parking', street: 'Street Parking', jeepney_terminal: 'Jeepney Terminal',
  tricycle_terminal: 'Tricycle Terminal', public: 'Public Parking', church: 'Church Parking',
  school: 'School Parking', gas_station: 'Gas Station', ev_charging: 'EV Charging',
  gasoline_station: 'Gasoline Station', diesel_station: 'Diesel Station', other: 'Other',
};

function getDistanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// ── Place autocomplete — same style as driver dashboard ──
type Prediction = { id: string; main: string; secondary: string; description: string };

function PlaceAutocompleteInput({
  value, onChange, onSelect, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (description: string, coords?: { lat: number; lng: number }) => void;
  placeholder: string;
}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const serviceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!MAPS_API_KEY) return;
    importLibrary('places').then((lib: any) => { serviceRef.current = new lib.AutocompleteService(); }).catch(() => {});
    importLibrary('geocoding').then((lib: any) => { geocoderRef.current = new lib.Geocoder(); }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPredictions = (input: string) => {
    if (!serviceRef.current || input.length < 2) { setPredictions([]); setOpen(false); return; }
    serviceRef.current.getPlacePredictions(
      { input, componentRestrictions: { country: 'ph' }, locationBias: { center: { lat: 17.6132, lng: 121.7270 }, radius: 80000 } },
      (results: any[], status: string) => {
        if (status === 'OK' && results) {
          setPredictions(results.slice(0, 5).map((r) => ({
            id: r.place_id,
            main: r.structured_formatting?.main_text || r.description,
            secondary: r.structured_formatting?.secondary_text || '',
            description: r.description,
          })));
          setOpen(true);
        } else { setPredictions([]); setOpen(false); }
      }
    );
  };

  const handleInput = (text: string) => {
    onChange(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), 300);
  };

  const handleSelect = (p: Prediction) => {
    onChange(p.main);
    setOpen(false);
    setPredictions([]);
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ placeId: p.id }, (results: any[], status: string) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location;
          onSelect(p.description, { lat: loc.lat(), lng: loc.lng() });
        } else { onSelect(p.description); }
      });
    } else { onSelect(p.description); }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
      />
      {open && predictions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {predictions.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => handleSelect(p)}
              className="w-full text-left px-4 py-2.5 hover:bg-teal-50 border-b border-slate-100 last:border-0 transition-colors"
            >
              <div className="text-sm font-medium text-slate-800 truncate">{p.main}</div>
              {p.secondary && <div className="text-xs text-slate-400 mt-0.5 truncate">{p.secondary}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export function CommutterDashboardPage() {
  const navigate = useNavigate();
  const { currentLocation, setCurrentLocation } = useLocationConsent();
  const { token } = useAuth();
  const [gpsStatus, setGpsStatus] = useState<string>('Getting GPS…');
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setChatLoading(true);
    fetch(`${API_URL}/api/auth/chat-token`, { headers: buildAuthHeaders(token) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setChatUrl(data.url))
      .catch(() => setChatUrl(null))
      .finally(() => setChatLoading(false));
  }, [token]);

  // FROM state
  const [fromText, setFromText] = useState('');
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [usingGps, setUsingGps] = useState(false);

  // Destinations
  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ParkingLocation | null>(null);

  // Map
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const mapInitRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/parking`);
      if (res.ok) setLocations((await res.json()).locations || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // GPS watcher — driver-identical auto-start
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('GPS not supported on this device.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus('');
        setCurrentLocation({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, timestamp: Date.now(),
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) { setGpsStatus('Location permission was denied.'); return; }
        setGpsStatus('Unable to get location. Retrying…');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 6000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [setCurrentLocation]);

  // Keep GPS fromCoords in sync
  useEffect(() => {
    if (currentLocation && usingGps) {
      setFromCoords({ lat: currentLocation.lat, lng: currentLocation.lng });
    }
  }, [currentLocation, usingGps]);

  // Init Google Map
  useEffect(() => {
    if (mapInitRef.current || !mapContainerRef.current) return;
    mapInitRef.current = true;
    setOptions({ key: MAPS_API_KEY, v: 'weekly' });
    importLibrary('maps').then((mapsLib) => {
      const { Map } = mapsLib as typeof google.maps;
      mapRef.current = new Map(mapContainerRef.current!, {
        center: TUGUEGARAO, zoom: 14,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });
      setMapReady(true);
    });
  }, []);

  const makeMarkerOptions = (isGas: boolean, isSel: boolean): google.maps.MarkerOptions => ({
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: isSel ? 16 : 14,
      fillColor: isSel ? '#f59e0b' : isGas ? '#16a34a' : '#2563eb',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2.5,
    },
    label: {
      text: isSel ? '★' : isGas ? 'G' : 'P',
      color: '#ffffff',
      fontSize: isSel ? '12px' : '11px',
      fontWeight: 'bold',
    },
  });

  // Place markers
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
    locations.filter((loc) => !GAS_TYPES.has(loc.type)).forEach((loc) => {
      const marker = new google.maps.Marker({
        position: { lat: loc.lat, lng: loc.lng },
        map: mapRef.current!,
        title: loc.name,
        ...makeMarkerOptions(false, false),
      });
      marker.addListener('click', () => { setSelected(loc); mapRef.current?.panTo({ lat: loc.lat, lng: loc.lng }); });
      markersRef.current.set(loc.id, marker);
    });
  }, [mapReady, locations]);

  // Highlight selected marker
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const isSel = selected?.id === id;
      const opts = makeMarkerOptions(false, isSel);
      marker.setIcon(opts.icon!);
      marker.setLabel(opts.label!);
    });
  }, [selected, locations]);

  // User location blue dot
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (currentLocation) {
      const pos = { lat: currentLocation.lat, lng: currentLocation.lng };
      if (!userMarkerRef.current) {
        userMarkerRef.current = new google.maps.Marker({
          position: pos, map: mapRef.current, title: 'Your Location', zIndex: 999,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#3b82f6', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2.5 },
        });
      } else { userMarkerRef.current.setPosition(pos); }
    } else { userMarkerRef.current?.setMap(null); userMarkerRef.current = null; }
  }, [currentLocation, mapReady]);

  const useGps = () => {
    setUsingGps(true);
    if (currentLocation) {
      setFromCoords({ lat: currentLocation.lat, lng: currentLocation.lng });
      setFromText(`${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`);
    } else {
      setFromText('');
    }
  };

  const clearFrom = () => { setFromText(''); setFromCoords(null); setUsingGps(false); };

  const origin = fromCoords ?? (currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null);

  const walkThere = () => {
    if (!selected) return;
    let url = `/walkway?dest_lat=${selected.lat}&dest_lng=${selected.lng}&dest_name=${encodeURIComponent(selected.name)}`;
    if (origin) url += `&origin_lat=${origin.lat}&origin_lng=${origin.lng}`;
    navigate(url);
  };

  const driveThere = () => {
    if (!selected) return;
    let url = `/driveway?dest_lat=${selected.lat}&dest_lng=${selected.lng}&dest_name=${encodeURIComponent(selected.name)}`;
    if (origin) url += `&origin_lat=${origin.lat}&origin_lng=${origin.lng}`;
    navigate(url);
  };

  const filtered = locations
    .filter((l) => {
      if (GAS_TYPES.has(l.type)) return false; // commuter dashboard: parking only
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || (l.notes || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (!origin) return a.name.localeCompare(b.name);
      return getDistanceM(origin.lat, origin.lng, a.lat, a.lng) - getDistanceM(origin.lat, origin.lng, b.lat, b.lng);
    });

  return (
    <>
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header — identical to driver */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Commuter Dashboard</h1>
          <p className="text-slate-600">Find nearby parking and gas stations — walk or drive there</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Left form column ── */}
          <div className="lg:col-span-1 space-y-3">

            {/* FROM card — identical structure to driver */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
              <div className="px-4 pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <MapPin className="w-3.5 h-3.5 text-teal-500" /> From
                  </label>
                  {!usingGps ? (
                    <button
                      type="button"
                      onClick={useGps}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Use GPS
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={clearFrom}
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                {usingGps ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-teal-300 bg-teal-50">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentLocation ? 'bg-teal-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                    <span className="text-sm text-teal-800 flex-1 truncate">
                      {currentLocation ? 'Your live GPS location' : gpsStatus || 'Getting GPS…'}
                    </span>
                  </div>
                ) : (
                  <PlaceAutocompleteInput
                    value={fromText}
                    onChange={setFromText}
                    onSelect={(_, coords) => { if (coords) setFromCoords(coords); }}
                    placeholder="Enter starting location"
                  />
                )}
                {!usingGps && (
                  <p className="text-xs mt-1.5 text-slate-400">
                    {currentLocation ? '📍 GPS available — or type an address above' : gpsStatus}
                  </p>
                )}
              </div>
            </div>

            {/* DESTINATION card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <PersonStanding className="w-3.5 h-3.5 text-blue-500" /> Destination
                  </label>
                  <button onClick={load} disabled={loading} className="p-1 rounded hover:bg-slate-100 transition">
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search parking or gas…"
                    className="w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* No filter tabs needed — parking only */}
              </div>

              {/* Location list — scrollable inside card */}
              <div className="max-h-52 overflow-y-auto border-t border-slate-100">
                {loading ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading locations…</div>
                ) : filtered.length === 0 ? (
                  <div className="py-8 text-center">
                    <MapPinOff className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-400">{search ? 'No results found.' : 'No locations yet.'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filtered.map((loc) => {
                      const isSel = selected?.id === loc.id;
                      const dist = origin ? getDistanceM(origin.lat, origin.lng, loc.lat, loc.lng) : null;
                      return (
                        <button
                          key={loc.id}
                          onClick={() => {
                            setSelected((prev) => (prev?.id === loc.id ? null : loc));
                            mapRef.current?.panTo({ lat: loc.lat, lng: loc.lng });
                            mapRef.current?.setZoom(16);
                          }}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${isSel ? 'bg-amber-50 border-l-4 border-amber-400' : 'hover:bg-slate-50'}`}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100">
                            <ParkingSquare className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{loc.name}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {TYPE_LABELS[loc.type] || loc.type}{dist !== null ? ` · ${formatDist(dist)}` : ''}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Selected destination summary */}
            {selected && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{selected.name}</p>
                    <p className="text-xs text-slate-500">
                      {TYPE_LABELS[selected.type] || selected.type}
                      {origin ? ` · ${formatDist(getDistanceM(origin.lat, origin.lng, selected.lat, selected.lng))} away` : ''}
                    </p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-0.5 text-slate-400 hover:text-slate-600 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Walk There — same style as driver's Analyze Routes */}
            <button
              onClick={walkThere}
              disabled={!selected}
              className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white py-3.5 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PersonStanding className="w-5 h-5" />
              {selected ? `Walk to ${selected.name}` : 'Walk There'}
            </button>

            {/* Drive There — same style as driver's Tracking Live button */}
            <button
              onClick={driveThere}
              disabled={!selected}
              className="w-full py-2.5 px-4 border border-slate-200 bg-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              <Car className="w-4 h-4" />
              Drive There
            </button>

          </div>

          {/* ── Map column — same as driver's map card ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full min-h-[600px] relative overflow-hidden">
              <div ref={mapContainerRef} className="absolute inset-0" />

              {/* Legend */}
              <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2 space-y-1.5">
                {[
                  ['bg-blue-600', 'P', 'Parking'],
                  ['bg-amber-400', '★', 'Selected'],
                  ['bg-blue-500', '·', 'You'],
                ].map(([color, letter, label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>{letter}</span>
                    <span className="text-xs text-slate-600">{label}</span>
                  </div>
                ))}
              </div>

              {/* Tap hint */}
              {!selected && locations.length > 0 && (
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-1.5">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-500" />
                    Tap a marker or list item to select
                  </p>
                </div>
              )}

              {/* GPS acquiring hint */}
              {!currentLocation && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-2xl border border-slate-200 shadow-lg px-4 py-3 flex items-center gap-3">
                  <Navigation className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-slate-600">{gpsStatus || 'Getting GPS fix…'}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>

    <AssistantPanel chatUrl={chatUrl} chatLoading={chatLoading} />
    </>
  );
}
