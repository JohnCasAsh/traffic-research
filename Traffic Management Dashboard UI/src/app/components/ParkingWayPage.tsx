import { useEffect, useState } from 'react';
import { ParkingSquare, Fuel, MapPin, RefreshCw, Search, Navigation, PersonStanding, Car, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { API_URL } from '../api';
import { useLocationConsent } from '../LocationConsentContext';
import { formatLocationAccuracy } from '../location';

type Location = {
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
  mall: 'Mall Parking',
  street: 'Street Parking',
  jeepney_terminal: 'Jeepney Terminal',
  tricycle_terminal: 'Tricycle Terminal',
  public: 'Public Parking',
  church: 'Church Parking',
  school: 'School Parking',
  gas_station: 'Gas Station',
  ev_charging: 'EV Charging Station',
  other: 'Other',
};

const TYPE_COLORS: Record<string, string> = {
  mall: 'bg-blue-100 text-blue-700',
  street: 'bg-slate-100 text-slate-700',
  jeepney_terminal: 'bg-orange-100 text-orange-700',
  tricycle_terminal: 'bg-amber-100 text-amber-700',
  public: 'bg-teal-100 text-teal-700',
  church: 'bg-purple-100 text-purple-700',
  school: 'bg-green-100 text-green-700',
  gas_station: 'bg-green-100 text-green-700',
  ev_charging: 'bg-emerald-100 text-emerald-700',
  other: 'bg-slate-100 text-slate-500',
};

function getDistanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number) {
  return m < 1000 ? `${Math.round(m)}m away` : `${(m / 1000).toFixed(1)}km away`;
}

function openNavigation(loc: Location, mode: 'walking' | 'driving', currentLocation: { lat: number; lng: number } | null) {
  const origin = currentLocation
    ? `${currentLocation.lat},${currentLocation.lng}`
    : '17.6128,121.7270';
  window.open(
    `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${loc.lat},${loc.lng}&travelmode=${mode}`,
    '_blank'
  );
}

export function ParkingWayPage() {
  const navigate = useNavigate();
  const { consent, setConsent, currentLocation } = useLocationConsent();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'parking' | 'gas'>('all');
  const [selected, setSelected] = useState<Location | null>(null);

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

  const filtered = locations
    .filter(l => {
      const matchesSearch =
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.notes || '').toLowerCase().includes(search.toLowerCase()) ||
        (TYPE_LABELS[l.type] || '').toLowerCase().includes(search.toLowerCase());
      const isGas = GAS_TYPES.has(l.type);
      if (filterTab === 'parking') return matchesSearch && !isGas;
      if (filterTab === 'gas') return matchesSearch && isGas;
      return matchesSearch;
    })
    .sort((a, b) => {
      if (!currentLocation) return a.name.localeCompare(b.name);
      return getDistanceM(currentLocation.lat, currentLocation.lng, a.lat, a.lng)
        - getDistanceM(currentLocation.lat, currentLocation.lng, b.lat, b.lng);
    });

  const parkingCount = locations.filter(l => !GAS_TYPES.has(l.type)).length;
  const gasCount = locations.filter(l => GAS_TYPES.has(l.type)).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <ParkingSquare className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Parking Way</h1>
              <p className="text-sm text-slate-500">Find parking & gas stations — walk or ride there</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Live Location Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Navigation className={`w-4 h-4 ${consent.isConsented ? 'text-teal-600' : 'text-slate-400'}`} />
              {consent.isConsented ? (
                currentLocation ? (
                  <div>
                    <span className="text-sm font-semibold text-teal-700 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                      {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                    </span>
                    <span className="text-xs text-slate-500 ml-3.5">
                      Accuracy: {formatLocationAccuracy(currentLocation.accuracy)}
                      {' · '}Sorting by distance
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Getting GPS fix...
                  </span>
                )
              ) : (
                <span className="text-sm text-slate-500">Enable live tracking to sort by distance</span>
              )}
            </div>
            <button
              onClick={() => consent.isConsented ? setConsent(false) : setConsent(true)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                consent.isConsented
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {consent.isConsented ? 'Stop Tracking' : 'Enable Tracking'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{locations.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Pins</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{parkingCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Parking Spots</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{gasCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Gas Stations</p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Search by name or notes..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white">
            {(['all', 'parking', 'gas'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setFilterTab(tab); setSelected(null); }}
                className={`px-4 py-2.5 text-sm font-medium transition ${
                  filterTab === tab
                    ? tab === 'gas' ? 'bg-green-600 text-white' : 'bg-teal-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab === 'all' ? 'All' : tab === 'parking' ? 'Parking' : 'Gas'}
              </button>
            ))}
          </div>
        </div>

        {/* Walk or Ride — shown when a card is selected */}
        {selected && (
          <div className="bg-white rounded-2xl border-2 border-teal-300 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${GAS_TYPES.has(selected.type) ? 'bg-green-100' : 'bg-teal-100'}`}>
                {GAS_TYPES.has(selected.type)
                  ? <Fuel className="w-4 h-4 text-green-600" />
                  : <ParkingSquare className="w-4 h-4 text-teal-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{selected.name}</p>
                <p className="text-xs text-slate-500">{TYPE_LABELS[selected.type] || selected.type}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-slate-600 transition">
                Clear
              </button>
            </div>
            {!consent.isConsented && (
              <p className="text-xs text-amber-600">
                Enable tracking above to use your exact GPS location as the starting point.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate(`/walkway?dest_lat=${selected.lat}&dest_lng=${selected.lng}&dest_name=${encodeURIComponent(selected.name)}`)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition"
              >
                <PersonStanding className="w-4 h-4" />
                Walk There
              </button>
              <button
                onClick={() => openNavigation(selected, 'driving', currentLocation)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
              >
                <Car className="w-4 h-4" />
                Ride There
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading locations...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            {search ? 'No results found.' : 'No locations pinned yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(loc => {
              const isGas = GAS_TYPES.has(loc.type);
              const isSelected = selected?.id === loc.id;
              const dist = currentLocation
                ? getDistanceM(currentLocation.lat, currentLocation.lng, loc.lat, loc.lng)
                : null;
              return (
                <div
                  key={loc.id}
                  onClick={() => setSelected(isSelected ? null : loc)}
                  className={`bg-white rounded-2xl border overflow-hidden cursor-pointer transition-all ${
                    isSelected ? 'border-teal-400 shadow-md ring-2 ring-teal-300' : 'border-slate-200 hover:shadow-md'
                  }`}
                >
                  {loc.photo && (
                    <img src={loc.photo} alt={loc.name} className="w-full h-36 object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isGas ? 'bg-green-50' : 'bg-teal-50'}`}>
                        {isGas
                          ? <Fuel className="w-4 h-4 text-green-600" />
                          : <ParkingSquare className="w-4 h-4 text-teal-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{loc.name}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[loc.type] || TYPE_COLORS.other}`}>
                            {TYPE_LABELS[loc.type] || loc.type}
                          </span>
                          {dist !== null && (
                            <span className="text-xs text-slate-400">{formatDist(dist)}</span>
                          )}
                        </div>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0 mt-1" />}
                    </div>

                    {isGas && loc.fuel_prices?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {loc.fuel_prices.filter(f => f.name.trim()).map((f, i) => (
                          <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                            {f.name} — ₱{f.price}/L
                          </span>
                        ))}
                      </div>
                    ) : !isGas && (loc.fare_normal != null || loc.fare_discounted != null) ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {loc.fare_normal != null && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100">
                            ₱{loc.fare_normal} Normal
                          </span>
                        )}
                        {loc.fare_discounted != null && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            ₱{loc.fare_discounted} Student/PWD/Senior
                          </span>
                        )}
                      </div>
                    ) : null}

                    {loc.notes && (
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-2">{loc.notes}</p>
                    )}

                    <button
                      onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`, '_blank'); }}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      View on Google Maps
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
