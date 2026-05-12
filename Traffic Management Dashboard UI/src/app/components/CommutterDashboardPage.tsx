import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ParkingSquare, Fuel, MapPin, Search, Navigation, PersonStanding, Car, X, RefreshCw } from 'lucide-react';
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
  school: 'School Parking', gas_station: 'Gas Station', ev_charging: 'EV Charging', other: 'Other',
};

function getDistanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

function openDriving(loc: ParkingLocation) {
  // No explicit origin — Google Maps uses the device's own GPS
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}&travelmode=driving`, '_blank');
}

export function CommutterDashboardPage() {
  const navigate = useNavigate();
  const { currentLocation, setCurrentLocation } = useLocationConsent();
  const [gpsMsg, setGpsMsg] = useState('Getting GPS fix…');
  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'parking' | 'gas'>('all');
  const [selected, setSelected] = useState<ParkingLocation | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const mapInitRef = useRef(false);
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/parking`);
      if (res.ok) setLocations((await res.json()).locations || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // GPS watcher — identical pattern to DashboardMap (driver page)
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

  // Place / update parking markers whenever map is ready or locations change
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    // Remove stale markers
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

  // Show/move user location marker
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (currentLocation) {
      const pos = { lat: currentLocation.lat, lng: currentLocation.lng };
      if (!userMarkerRef.current) {
        userMarkerRef.current = new google.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: 'Your Location',
          zIndex: 999,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2.5,
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

  const selectAndPan = useCallback((loc: ParkingLocation) => {
    setSelected((prev) => (prev?.id === loc.id ? null : loc));
    mapRef.current?.panTo({ lat: loc.lat, lng: loc.lng });
    mapRef.current?.setZoom(16);
  }, []);

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
      if (!currentLocation) return a.name.localeCompare(b.name);
      return (
        getDistanceM(currentLocation.lat, currentLocation.lng, a.lat, a.lng) -
        getDistanceM(currentLocation.lat, currentLocation.lng, b.lat, b.lng)
      );
    });

  const parkingCount = locations.filter((l) => !GAS_TYPES.has(l.type)).length;
  const gasCount = locations.filter((l) => GAS_TYPES.has(l.type)).length;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Left Sidebar ── */}
      <div className="w-full md:w-80 md:flex-shrink-0 flex flex-col bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-hidden md:h-full" style={{ maxHeight: '52vh' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-slate-900">Commuter Dashboard</h1>
              <p className="text-xs text-slate-400">Tuguegarao City</p>
            </div>
            <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* GPS Status */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentLocation ? 'bg-teal-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-xs text-slate-600 truncate">
              {currentLocation ? 'Live · sorting by distance' : gpsMsg}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parking or gas…"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
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

        {/* Walk or Ride panel — shown when a location is selected */}
        {selected && (
          <div className="mx-3 my-2 bg-gradient-to-br from-teal-50 to-blue-50 rounded-2xl border border-teal-200 p-3 flex-shrink-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm leading-tight truncate">{selected.name}</p>
                <p className="text-xs text-slate-500">{TYPE_LABELS[selected.type] || selected.type}</p>
                {currentLocation && (
                  <p className="text-xs text-teal-600 font-semibold mt-0.5">
                    {formatDist(getDistanceM(currentLocation.lat, currentLocation.lng, selected.lat, selected.lng))} away
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="flex-shrink-0 p-0.5 text-slate-400 hover:text-slate-700 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fuel prices for gas stations */}
            {GAS_TYPES.has(selected.type) && selected.fuel_prices?.length ? (
              <div className="flex flex-wrap gap-1 mb-2">
                {selected.fuel_prices.filter((f) => f.name.trim()).map((f, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                    {f.name} ₱{f.price}/L
                  </span>
                ))}
              </div>
            ) : !GAS_TYPES.has(selected.type) && (selected.fare_normal != null || selected.fare_discounted != null) ? (
              <div className="flex flex-wrap gap-1 mb-2">
                {selected.fare_normal != null && <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">₱{selected.fare_normal} Normal</span>}
                {selected.fare_discounted != null && <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">₱{selected.fare_discounted} Discounted</span>}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate(`/walkway?dest_lat=${selected.lat}&dest_lng=${selected.lng}&dest_name=${encodeURIComponent(selected.name)}`)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition"
              >
                <PersonStanding className="w-4 h-4" />
                Walk There
              </button>
              <button
                onClick={() => openDriving(selected)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                <Car className="w-4 h-4" />
                Ride There
              </button>
            </div>
          </div>
        )}

        {/* Location list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading locations…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {search ? 'No results found.' : 'No locations pinned yet.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((loc) => {
                const isGas = GAS_TYPES.has(loc.type);
                const isSel = selected?.id === loc.id;
                const dist = currentLocation
                  ? getDistanceM(currentLocation.lat, currentLocation.lng, loc.lat, loc.lng)
                  : null;
                return (
                  <button
                    key={loc.id}
                    onClick={() => selectAndPan(loc)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${isSel ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
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
                    {isSel && <div className="w-1.5 h-8 rounded-full bg-teal-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-around bg-slate-50">
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">{locations.length}</p>
            <p className="text-xs text-slate-400">Total</p>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div className="text-center">
            <p className="text-sm font-bold text-teal-600">{parkingCount}</p>
            <p className="text-xs text-slate-400">Parking</p>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div className="text-center">
            <p className="text-sm font-bold text-green-600">{gasCount}</p>
            <p className="text-xs text-slate-400">Gas</p>
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative min-h-[45vh] md:min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Map legend */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-500 flex-shrink-0" />
            <span className="text-xs text-slate-600">Parking</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-600 flex-shrink-0" />
            <span className="text-xs text-slate-600">Gas Station</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="text-xs text-slate-600">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-xs text-slate-600">You</span>
          </div>
        </div>

        {/* GPS acquiring hint — only show while waiting for first fix */}
        {!currentLocation && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-2xl border border-slate-200 shadow-lg px-4 py-3 flex items-center gap-3">
            <Navigation className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-slate-600">{gpsMsg || 'Getting GPS fix…'}</span>
          </div>
        )}

        {/* Tap hint */}
        {locations.length > 0 && !selected && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-1.5">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-500" />
              Tap a marker or list item to navigate
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
