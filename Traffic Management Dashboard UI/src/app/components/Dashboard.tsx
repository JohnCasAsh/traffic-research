import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { MapPin, Navigation, Fuel, DollarSign, Car, Zap, Settings, Info, X, AlertCircle, ArrowUpDown, Bookmark, Trash2, ChevronRight } from 'lucide-react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { DashboardMap } from './DashboardMap';
import { AssistantPanel } from './AssistantPanel';
import { useLocationConsent } from '../LocationConsentContext';
import { formatLocationAccuracy } from '../location';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';

const SAVED_ROUTES_CACHE_KEY = 'smartroute:saved-routes-cache';

const MAPS_API_KEY = (
  (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
    ?.VITE_GOOGLE_MAPS_API_KEY || ''
).trim();

type Prediction = { id: string; main: string; secondary: string; description: string };

function PlaceAutocompleteInput({
  value, onChange, placeholder, required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const serviceRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!MAPS_API_KEY) return;
    setOptions({ apiKey: MAPS_API_KEY, version: 'beta' });
    importLibrary('places')
      .then((lib: any) => { serviceRef.current = new lib.AutocompleteService(); })
      .catch(() => {});
  }, []);

  const fetchPredictions = (input: string) => {
    if (!serviceRef.current || input.length < 2) {
      setPredictions([]); setOpen(false); return;
    }
    serviceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'ph' },
        locationBias: { center: { lat: 17.6132, lng: 121.7270 }, radius: 80000 },
      },
      (results: any[], status: string) => {
        if (status === 'OK' && results) {
          setPredictions(results.slice(0, 5).map(r => ({
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

  const handleSelect = (desc: string) => {
    onChange(desc); setPredictions([]); setOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => handleInput(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
      />
      {open && predictions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {predictions.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => handleSelect(p.description)}
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

const VEHICLE_DEFAULTS: Record<string, { fuelType: string; fuelPrice: string }> = {
  motorcycle:  { fuelType: 'gasoline', fuelPrice: '62.00' },
  tricycle:    { fuelType: 'gasoline', fuelPrice: '62.00' },
  sedan:       { fuelType: 'gasoline', fuelPrice: '62.00' },
  van:         { fuelType: 'diesel',   fuelPrice: '58.50' },
  bus:         { fuelType: 'diesel',   fuelPrice: '58.50' },
  hybrid_car:  { fuelType: 'gasoline', fuelPrice: '62.00' },
  hybrid_van:  { fuelType: 'gasoline', fuelPrice: '62.00' },
  e_trike:     { fuelType: 'electric', fuelPrice: '10.00' },
  e_motorcycle:{ fuelType: 'electric', fuelPrice: '10.00' },
  suv:         { fuelType: 'diesel',   fuelPrice: '58.50' },
  truck:       { fuelType: 'diesel',   fuelPrice: '58.50' },
  electric:    { fuelType: 'electric', fuelPrice: '10.00' },
  hybrid:      { fuelType: 'gasoline', fuelPrice: '62.00' },
  etrike:      { fuelType: 'electric', fuelPrice: '10.00' },
  emotorcycle: { fuelType: 'electric', fuelPrice: '10.00' },
};

type RouteFormData = {
  origin: string;
  destination: string;
  vehicleType: string;
  fuelType: string;
  fuelPrice: string;
};

export function Dashboard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { consent, setConsent, currentLocation } = useLocationConsent();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

  type SavedRoute = { id: string; label: string; origin: string; destination: string; vehicle_type: string; fuel_type: string; fuel_price: string; saved_at: string };
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => {
    try {
      const cached = localStorage.getItem(SAVED_ROUTES_CACHE_KEY);
      return cached ? (JSON.parse(cached) as SavedRoute[]) : [];
    } catch { return []; }
  });
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/saved-routes`, { headers: buildAuthHeaders(token) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const routes: SavedRoute[] = data.routes || [];
        setSavedRoutes(routes);
        localStorage.setItem(SAVED_ROUTES_CACHE_KEY, JSON.stringify(routes));
      })
      .catch(() => {});
  }, [token]);

  const handleLoadSavedRoute = (r: SavedRoute) => {
    navigate('/routes', {
      state: {
        origin: r.origin,
        destination: r.destination,
        vehicleType: r.vehicle_type,
        fuelType: r.fuel_type,
        fuelPrice: r.fuel_price,
      },
    });
  };

  const handleDeleteSavedRoute = async (id: string) => {
    if (!token) return;
    setDeletingRouteId(id);
    try {
      const res = await fetch(`${API_URL}/api/saved-routes/${id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(token),
      });
      if (res.ok) setSavedRoutes(prev => prev.filter(r => r.id !== id));
    } finally {
      setDeletingRouteId(null);
    }
  };
  const [originLocationStatus, setOriginLocationStatus] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [formData, setFormData] = useState<RouteFormData>({
    origin: '',
    destination: '',
    vehicleType: 'sedan',
    fuelType: 'gasoline',
    fuelPrice: '62.00',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);

    navigate('/routes', {
      state: {
        ...formData,
      },
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVehicleChange = (vehicleType: string) => {
    const defaults = VEHICLE_DEFAULTS[vehicleType] ?? { fuelType: 'gasoline', fuelPrice: '62.00' };
    setFormData(prev => ({ ...prev, vehicleType, fuelType: defaults.fuelType, fuelPrice: defaults.fuelPrice }));
  };

  const applyTrackedLocationToOrigin = (location: { lat: number; lng: number; accuracy: number }) => {
    const coordinateText = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    const accuracyText = formatLocationAccuracy(location.accuracy);

    setFormData((previous) => ({
      ...previous,
      origin: coordinateText,
    }));

    setOriginLocationStatus(
      `Current location: ${coordinateText}${accuracyText ? ` (${accuracyText})` : ''}`
    );
  };

  const handleUseCurrentLocation = () => {
    if (!currentLocation) {
      setOriginLocationStatus('Waiting for live GPS fix. Please try again in a few seconds.');
      return;
    }

    applyTrackedLocationToOrigin(currentLocation);
  };

  const handleSwapLocations = () => {
    setOriginLocationStatus(null);
    setFormData((previous) => ({
      ...previous,
      origin: previous.destination,
      destination: previous.origin,
    }));
  };

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Route Optimizer Dashboard</h1>
          <p className="text-slate-600">
            Enter your trip details to find the most energy-efficient and cost-effective route
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Origin + Destination in one card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
                {/* Origin */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <MapPin className="w-3.5 h-3.5 text-teal-500" />
                      From
                    </label>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Use GPS
                    </button>
                  </div>
                  <PlaceAutocompleteInput
                    value={formData.origin}
                    onChange={(v) => { setOriginLocationStatus(null); handleChange('origin', v); }}
                    placeholder="Enter starting location"
                    required
                  />
                  {originLocationStatus && (
                    <p className="text-xs mt-1.5 text-slate-500">{originLocationStatus}</p>
                  )}
                </div>

                {/* Swap divider */}
                <div className="flex items-center gap-2 px-4 py-1 border-y border-slate-100">
                  <div className="flex-1 h-px bg-slate-100" />
                  <button
                    type="button"
                    onClick={handleSwapLocations}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    Swap
                  </button>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Destination */}
                <div className="px-4 pt-3 pb-4">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <Navigation className="w-3.5 h-3.5 text-blue-500" />
                    To
                  </label>
                  <PlaceAutocompleteInput
                    value={formData.destination}
                    onChange={(v) => handleChange('destination', v)}
                    placeholder="Enter destination"
                    required
                  />
                </div>
              </div>

              {/* Vehicle + Fuel in one compact row */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <Car className="w-3.5 h-3.5 text-slate-500" />
                    Vehicle
                  </label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                  >
                    <optgroup label="ICE">
                      <option value="motorcycle">Motorcycle</option>
                      <option value="tricycle">Tricycle</option>
                      <option value="sedan">Sedan / Car</option>
                      <option value="van">Van</option>
                      <option value="bus">Bus</option>
                    </optgroup>
                    <optgroup label="Hybrid">
                      <option value="hybrid_car">Hybrid Car</option>
                      <option value="hybrid_van">Hybrid Van</option>
                    </optgroup>
                    <optgroup label="Electric">
                      <option value="e_trike">E-Trike</option>
                      <option value="e_motorcycle">E-Motorcycle</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    <Fuel className="w-3.5 h-3.5 text-orange-500" />
                    Fuel
                  </label>
                  <select
                    value={formData.fuelType}
                    onChange={(e) => handleChange('fuelType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                  >
                    <option value="gasoline">Gasoline</option>
                    <option value="diesel">Diesel</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
              </div>

              {/* Fuel Price */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-green-500" />
                  {formData.fuelType === 'electric' ? 'Energy Price / kWh' : 'Fuel Price / Liter'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fuelPrice}
                    onChange={(e) => handleChange('fuelPrice', e.target.value)}
                    placeholder="62.00"
                    className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {formData.fuelType === 'electric' ? 'Local utility rate' : 'DOE Region II reference price'}
                </p>
              </div>

              {/* Analyze Button */}
              <motion.button
                type="submit"
                disabled={isAnalyzing}
                whileHover={{ scale: isAnalyzing ? 1 : 1.02 }}
                whileTap={{ scale: isAnalyzing ? 1 : 0.98 }}
                className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white py-3.5 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Settings className="w-5 h-5" />
                    </motion.div>
                    <span>Analyzing Routes...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>Analyze Routes</span>
                  </>
                )}
              </motion.button>

              <button
                type="button"
                onClick={() => consent.isConsented ? setConsent(false) : setShowPrivacyModal(true)}
                className={`w-full py-2.5 px-4 border rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  consent.isConsented
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Navigation className="w-4 h-4" />
                {consent.isConsented ? 'Tracking Live' : 'Enable Live Tracking'}
              </button>
            </form>

            {/* Saved Routes */}
            {savedRoutes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Bookmark className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-semibold text-slate-700">Saved Routes</span>
                  <span className="ml-auto text-xs text-slate-400">{savedRoutes.length}/10</span>
                </div>
                <div className="space-y-2">
                  {savedRoutes.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 group hover:border-teal-300 transition">
                      <button
                        onClick={() => handleLoadSavedRoute(r)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="text-sm font-medium text-slate-800 truncate">{r.label}</div>
                        <div className="text-xs text-slate-400 truncate capitalize">{r.vehicle_type.replace('_', ' ')} · {r.fuel_type}</div>
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 shrink-0 transition" onClick={() => handleLoadSavedRoute(r)} />
                      <button
                        onClick={() => handleDeleteSavedRoute(r.id)}
                        disabled={deletingRouteId === r.id}
                        className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <div className="flex items-start space-x-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Pro Tip:</strong> Routes with lower traffic typically consume less fuel,
                  even if they're slightly longer in distance.
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Map Container */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full min-h-[600px] relative overflow-hidden">
              <DashboardMap
                origin={formData.origin}
                destination={formData.destination}
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
                <li>Show traffic conditions and your position to other users</li>
                <li>Calculate accurate route information</li>
                <li>Provide navigation assistance</li>
              </ul>
              <p className="mt-4 border-t border-slate-200 pt-4">
                <strong>Privacy Assurance:</strong> Your location is only visible while you're actively using the app. 
                You can disable this at any time. No permanent records are stored unless you explicitly save them.
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
                Enable & Share
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
