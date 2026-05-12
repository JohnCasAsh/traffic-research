import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  ParkingSquare, Fuel, MapPin, Search, Navigation, PersonStanding,
  Car, X, RefreshCw, MapPinOff,
} from 'lucide-react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { API_URL } from '../api';
import { useLocationConsent } from '../LocationConsentContext';

const MAPS_API_KEY = (
  (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
    ?.VITE_GOOGLE_MAPS_API_KEY || ''
).trim();

const TUGUEGARAO = { lat: 17.6128, lng: 121.7270 };

type ParkingLocation = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  notes: string;
  fare_normal: number | null;
  fare_discounted: number | null;
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

// ── Place autocomplete input (same pattern as driver dashboard) ──
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
    importLibrary('places').then((lib: any) => {
      serviceRef.current = new lib.AutocompleteService();
    }).catch(() => {});
    importLibrary('geocoding').then((lib: any) => {
      geocoderRef.current = new lib.Geocoder();
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPredictions = (input: string) => {
    if (!serviceRef.current || input.length < 2) { setPredictions([]); setOpen(false); return; }
    serviceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'ph' },
        locationBias: { center: { lat: 17.6132, lng: 121.7270 }, radius: 80000 },
      },
      (results: any[], status: string) => {
        if (status === 'OK' && results) {
          setPredictions(results.slice(0, 5).map((r) => ({
            id: r.place_id,
            main: r.structured_formatting?.main_text || r.description,
            secondary: r.structured_formatting?.secondary_text || '',
            description: r.description,
          })));
          setOpen(true);
        } else {
          setPredictions([]); setOpen(false);
        }
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
        } else {
          onSelect(p.description);
        }
      });
    } else {
      onSelect(p.description);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
      />
      {open && predictions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {predictions.map((p) => (
            <li
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
            >
              <p className="text-sm font-medium text-slate-800">{p.main}</p>
              {p.secondary && <p className="text-xs text-slate-400">{p.secondary}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main component ──
export function CommutterDashboardPage() {
  const navigate = useNavigate();
  const { currentLocation, setCurrentLocation } = useLocationConsent();
  const [gpsMsg, setGpsMsg] = useState('Getting GPS…');

  // FROM state
  const [fromText, setFromText] = useState('');
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [usingGps, setUsingGps] = useState(false);

  // Destinations
  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'parking' | 'gas'>('all');
  const [selected, setSelected] = useState<ParkingLocation | null>(null);

  // Map
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const mapInitRef = useRef(false);

  // Load parking locations
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/parking`);
      if (res.ok) setLocations((await res.json()).locations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // GPS watcher — driver-identical auto-start
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsMsg('GPS not supported on this device.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsMsg('');
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsMsg('Location permission was denied.');
          return;
        }
        setGpsMsg('Unable to get location. Retrying…');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 6000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [setCurrentLocation]);

  // When GPS becomes available and user is using GPS mode — update fromCoords
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
        center: TUGUEGARAO,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControlOptions: { position: 9 },
      });
      setMapReady(true);
    });
  }, []);

  // Place parking markers on map
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();

    locations.forEach((loc) => {
      const isGas = GAS_TYPES.has(loc.type);
      const marker = new google.maps.Marker({
        position: { lat: loc.lat, lng: loc.lng },
        map: mapRef.current!,
        title: loc.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: isGas ? '#16a34a' : '#0d9488',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
        },
      });
      // Click marker → select destination
      marker.addListener('click', () => {
        setSelected(loc);
        mapRef.current?.panTo({ lat: loc.lat, lng: loc.lng });
      });
      markersRef.current.set(loc.id, marker);
    });
  }, [mapReady, locations]);

  // Highlight selected marker
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const loc = locations.find((l) => l.id === id);
      if (!loc) return;
      const isGas = GAS_TYPES.has(loc.type);
      const isSel = selected?.id === id;
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: isSel ? 16 : 12,
        fillColor: isSel ? '#f59e0b' : (isGas ? '#16a34a' : '#0d9488'),
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2.5,
      });
    });
  }, [selected, locations]);

  // User location blue dot on map
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (currentLocation) {
      const pos = { lat: currentLocation.lat, lng: currentLocation.lng };
      if (!userMarkerRef.current) {
        userMarkerRef.current = new google.maps.Marker({
          position: pos, map: mapRef.current, title: 'Your Location', zIndex: 999,
          icon: {
            path: google.maps.SymbolPath.CIRCLE, scale: 10,
            fillColor: '#3b82f6', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2.5,
          },
        });
      } else {
        userMarkerRef.current.setPosition(pos);
      }
    } else {
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
    }
  }, [currentLocation, mapReady]);

  const selectAndPan = (loc: ParkingLocation) => {
    setSelected((prev) => (prev?.id === loc.id ? null : loc));
    mapRef.current?.panTo({ lat: loc.lat, lng: loc.lng });
    mapRef.current?.setZoom(16);
  };

  const useGps = () => {
    const loc = currentLocation;
    if (loc) {
      setFromCoords({ lat: loc.lat, lng: loc.lng });
      setFromText('Your Location (GPS)');
      setUsingGps(true);
    } else {
      setFromText('Getting GPS…');
      setUsingGps(true);
    }
  };

  const clearFrom = () => {
    setFromText('');
    setFromCoords(null);
    setUsingGps(false);
  };

  const walkThere = (loc: ParkingLocation) => {
    const origin = fromCoords ?? (currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null);
    let url = `/walkway?dest_lat=${loc.lat}&dest_lng=${loc.lng}&dest_name=${encodeURIComponent(loc.name)}`;
    if (origin) url += `&origin_lat=${origin.lat}&origin_lng=${origin.lng}`;
    navigate(url);
  };

  const driveThere = (loc: ParkingLocation) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}&travelmode=driving`, '_blank');
  };

  const origin = fromCoords ?? (currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null);

  const filtered = locations
    .filter((l) => {
      const q = search.toLowerCase();
      const matchSearch = l.name.toLowerCase().includes(q) || (l.notes || '').toLowerCase().includes(q);
      const isGas = GAS_TYPES.has(l.type);
      if (filterTab === 'parking') return matchSearch && !isGas;
      if (filterTab === 'gas') return matchSearch && isGas;
      return matchSearch;
    })
    .sort((a, b) => {
      if (!origin) return a.name.localeCompare(b.name);
      return (
        getDistanceM(origin.lat, origin.lng, a.lat, a.lng) -
        getDistanceM(origin.lat, origin.lng, b.lat, b.lng)
      );
    });

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Left panel (driver-style form) ── */}
      <div className="w-full md:w-80 md:flex-shrink-0 flex flex-col bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-hidden md:h-full" style={{ maxHeight: '55vh' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-slate-900">Commuter Dashboard</h1>
              <p className="text-xs text-slate-400">Tuguegarao City</p>
            </div>
            <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* FROM field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <MapPin className="w-3 h-3" /> From
              </label>
              {!usingGps && (
                <button
                  onClick={useGps}
                  className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3" />
                  Use GPS
                </button>
              )}
            </div>
            {usingGps ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-300 bg-teal-50">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentLocation ? 'bg-teal-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                <span className="text-sm text-teal-800 flex-1 truncate">
                  {currentLocation ? 'Your live GPS location' : gpsMsg}
                </span>
                <button onClick={clearFrom} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <PlaceAutocompleteInput
                value={fromText}
                onChange={setFromText}
                onSelect={(desc, coords) => {
                  setFromText(desc);
                  if (coords) setFromCoords(coords);
                }}
                placeholder="Enter starting location…"
              />
            )}
          </div>
        </div>

        {/* Destination search + filter */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-2 flex-shrink-0">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <PersonStanding className="w-3 h-3" /> Destination
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parking or gas…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(['all', 'parking', 'gas'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterTab(f)}
                className={`flex-1 py-1.5 text-xs font-semibold transition capitalize ${filterTab === f ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {f === 'all' ? 'All' : f === 'parking' ? 'Parking' : 'Gas'}
              </button>
            ))}
          </div>
        </div>

        {/* Location list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">Loading locations…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <MapPinOff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">{search ? 'No results found.' : 'No locations yet.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((loc) => {
                const isGas = GAS_TYPES.has(loc.type);
                const isSel = selected?.id === loc.id;
                const dist = origin ? getDistanceM(origin.lat, origin.lng, loc.lat, loc.lng) : null;
                return (
                  <button
                    key={loc.id}
                    onClick={() => selectAndPan(loc)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${isSel ? 'bg-amber-50 border-l-2 border-amber-400' : 'hover:bg-slate-50'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isGas ? 'bg-green-100' : 'bg-teal-100'}`}>
                      {isGas ? <Fuel className="w-4 h-4 text-green-600" /> : <ParkingSquare className="w-4 h-4 text-teal-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{loc.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {TYPE_LABELS[loc.type] || loc.type}
                        {dist !== null ? ` · ${formatDist(dist)}` : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected destination action bar */}
        {selected && (
          <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{selected.name}</p>
                <p className="text-xs text-slate-500">
                  {TYPE_LABELS[selected.type] || selected.type}
                  {origin ? ` · ${formatDist(getDistanceM(origin.lat, origin.lng, selected.lat, selected.lng))} away` : ''}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-0.5 text-slate-400 hover:text-slate-700 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => walkThere(selected)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition"
              >
                <PersonStanding className="w-4 h-4" />
                Walk There
              </button>
              <button
                onClick={() => driveThere(selected)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                <Car className="w-4 h-4" />
                Drive There
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative min-h-[45vh] md:min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Map legend */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-500" />
            <span className="text-xs text-slate-600">Parking</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-600" />
            <span className="text-xs text-slate-600">Gas Station</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-xs text-slate-600">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-slate-600">You</span>
          </div>
        </div>

        {/* GPS hint while waiting for fix */}
        {!currentLocation && !usingGps && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-2xl border border-slate-200 shadow-lg px-4 py-3 flex items-center gap-3">
            <Navigation className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-slate-600">{gpsMsg || 'Getting GPS fix…'}</span>
          </div>
        )}

        {/* Tap hint when no selection */}
        {locations.length > 0 && !selected && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-1.5">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-500" />
              Tap a marker or list item to select
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
