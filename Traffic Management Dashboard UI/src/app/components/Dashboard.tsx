import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Navigation, Fuel, Car, X, AlertCircle, ParkingSquare, Search, PersonStanding, CheckCircle, RefreshCw } from 'lucide-react';
import { setOptions } from '@googlemaps/js-api-loader';
import { DashboardMap } from './DashboardMap';
import { AssistantPanel } from './AssistantPanel';
import { useLocationConsent } from '../LocationConsentContext';
import { formatLocationAccuracy } from '../location';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';

const MAPS_API_KEY = (
  (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
    ?.VITE_GOOGLE_MAPS_API_KEY || ''
).trim();

if (MAPS_API_KEY) {
  setOptions({ key: MAPS_API_KEY, v: 'weekly' });
}

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
  ev_charging: 'EV Charging',
  other: 'Other',
};

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

export function Dashboard() {
  const { token } = useAuth();
  const { consent, setConsent, currentLocation } = useLocationConsent();
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [parkingLocations, setParkingLocations] = useState<ParkingLocation[]>([]);
  const [parkingLoading, setParkingLoading] = useState(true);
  const [selectedParking, setSelectedParking] = useState<ParkingLocation | null>(null);
  const [parkingSearch, setParkingSearch] = useState('');

  useEffect(() => {
    if (!token) return;
    setChatLoading(true);
    fetch(`${API_URL}/api/auth/chat-token`, { headers: buildAuthHeaders(token) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setChatUrl(data.url))
      .catch(() => setChatUrl(null))
      .finally(() => setChatLoading(false));
  }, [token]);

  const loadParking = () => {
    setParkingLoading(true);
    fetch(`${API_URL}/api/parking`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setParkingLocations(data.locations || []))
      .catch(() => {})
      .finally(() => setParkingLoading(false));
  };

  useEffect(() => { loadParking(); }, []);

  const filteredParking = parkingLocations
    .filter(loc =>
      loc.name.toLowerCase().includes(parkingSearch.toLowerCase()) ||
      (loc.notes || '').toLowerCase().includes(parkingSearch.toLowerCase()) ||
      (TYPE_LABELS[loc.type] || '').toLowerCase().includes(parkingSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (!currentLocation) return a.name.localeCompare(b.name);
      return getDistanceM(currentLocation.lat, currentLocation.lng, a.lat, a.lng)
        - getDistanceM(currentLocation.lat, currentLocation.lng, b.lat, b.lng);
    });

  const openNavigation = (mode: 'walking' | 'driving') => {
    if (!selectedParking) return;
    const origin = currentLocation
      ? `${currentLocation.lat},${currentLocation.lng}`
      : '17.6128,121.7270';
    const dest = `${selectedParking.lat},${selectedParking.lng}`;
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${mode}`,
      '_blank'
    );
  };

  const mapOrigin = currentLocation
    ? `${currentLocation.lat.toFixed(6)},${currentLocation.lng.toFixed(6)}`
    : '';
  const mapDestination = selectedParking
    ? `${selectedParking.lat},${selectedParking.lng}`
    : '';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex">
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Map</h1>
            <p className="text-slate-600">Walk or ride to a nearby parking spot</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Panel — Walk or Ride */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-1 space-y-4"
            >

              {/* Live Location Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <Navigation className="w-3.5 h-3.5 text-teal-600" /> Your Location
                </h3>
                {consent.isConsented ? (
                  currentLocation ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-teal-700">
                        <span className="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                        {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                      </div>
                      <p className="text-xs text-slate-500">
                        Accuracy: {formatLocationAccuracy(currentLocation.accuracy)}
                      </p>
                      <button
                        onClick={() => setConsent(false)}
                        className="text-xs text-slate-400 hover:text-red-500 transition mt-1"
                      >
                        Stop tracking
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Getting GPS fix...
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => setShowPrivacyModal(true)}
                    className="w-full py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" />
                    Enable Live Tracking
                  </button>
                )}
              </div>

              {/* Parking / Station List */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Select Destination
                    </h3>
                    <button
                      onClick={loadParking}
                      disabled={parkingLoading}
                      className="text-slate-400 hover:text-slate-600 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${parkingLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={parkingSearch}
                      onChange={e => setParkingSearch(e.target.value)}
                      placeholder="Search parking or station..."
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                    />
                  </div>
                </div>

                {parkingLoading ? (
                  <div className="px-4 pb-6 text-center text-sm text-slate-400">Loading locations...</div>
                ) : filteredParking.length === 0 ? (
                  <div className="px-4 pb-6 text-center text-sm text-slate-400">
                    {parkingSearch ? 'No results found.' : 'No locations available yet.'}
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {filteredParking.map(loc => {
                      const isSelected = selectedParking?.id === loc.id;
                      const isGas = GAS_TYPES.has(loc.type);
                      const dist = currentLocation
                        ? getDistanceM(currentLocation.lat, currentLocation.lng, loc.lat, loc.lng)
                        : null;
                      return (
                        <button
                          key={loc.id}
                          onClick={() => setSelectedParking(isSelected ? null : loc)}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isGas ? 'bg-green-100' : 'bg-teal-100'}`}>
                            {isGas
                              ? <Fuel className="w-3.5 h-3.5 text-green-600" />
                              : <ParkingSquare className="w-3.5 h-3.5 text-teal-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-teal-700' : 'text-slate-800'}`}>
                              {loc.name}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {TYPE_LABELS[loc.type] || loc.type}
                              {dist !== null ? ` · ${formatDist(dist)}` : ''}
                            </p>
                          </div>
                          {isSelected && <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Walk / Ride Buttons */}
              {selectedParking && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide truncate">
                    → {selectedParking.name}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openNavigation('walking')}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition"
                    >
                      <PersonStanding className="w-4 h-4" />
                      Walk
                    </button>
                    <button
                      onClick={() => openNavigation('driving')}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                    >
                      <Car className="w-4 h-4" />
                      Ride
                    </button>
                  </div>
                  {!currentLocation && (
                    <p className="text-xs text-amber-600 text-center">
                      Enable tracking to use your exact location
                    </p>
                  )}
                </motion.div>
              )}

            </motion.div>

            {/* Map */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="lg:col-span-2"
            >
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full min-h-[600px] relative overflow-hidden">
                <DashboardMap
                  origin={mapOrigin}
                  destination={mapDestination}
                  liveTrackingEnabled={consent.isConsented}
                />
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      <AssistantPanel chatUrl={chatUrl} chatLoading={chatLoading} />

      {/* Privacy Consent Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-amber-600" />
                Location Privacy
              </h2>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6 text-sm text-slate-600">
              <p>
                <strong>Live Tracking</strong> shares your real-time location with the app to:
              </p>
              <ul className="ml-4 space-y-2 list-disc">
                <li>Display your location on the map</li>
                <li>Sort nearby parking spots by distance</li>
                <li>Show accurate walking/riding directions</li>
                <li>Provide navigation assistance</li>
              </ul>
              <p className="mt-4 border-t border-slate-200 pt-4">
                <strong>Privacy Assurance:</strong> Your location is only visible while you're actively using the app.
                You can disable this at any time. No permanent records are stored.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={() => {
                  setConsent(true);
                  setShowPrivacyModal(false);
                }}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
              >
                Enable &amp; Share
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-4 text-center">
              You can change this setting anytime in the app settings
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
