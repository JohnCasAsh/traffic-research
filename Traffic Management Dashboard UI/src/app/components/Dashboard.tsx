import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { MapPin, Navigation, Fuel, DollarSign, Car, Zap, Settings, Info, X, AlertCircle, ArrowUpDown, Bookmark, Trash2, ChevronRight } from 'lucide-react';
import { DashboardMap } from './DashboardMap';
import { AssistantPanel } from './AssistantPanel';
import { useLocationConsent } from '../LocationConsentContext';
import { formatLocationAccuracy } from '../location';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';

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
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/saved-routes`, { headers: buildAuthHeaders(token) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setSavedRoutes(data.routes || []))
      .catch(() => setSavedRoutes([]));
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
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Origin */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center space-x-2 text-sm font-medium text-slate-700">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    <span>Origin Location</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center"
                  >
                    <Navigation className="w-3 h-3 mr-1" /> Use from tracking
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => {
                    setOriginLocationStatus(null);
                    handleChange('origin', e.target.value);
                  }}
                  placeholder="Enter starting location"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  required
                />
                {originLocationStatus && (
                  <p className="text-xs mt-2 text-slate-600">{originLocationStatus}</p>
                )}
              </motion.div>

              <div className="flex justify-center -my-1">
                <button
                  type="button"
                  onClick={handleSwapLocations}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  title="Swap origin and destination"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Swap A/B
                </button>
              </div>

              {/* Destination */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
              >
                <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-3">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  <span>Destination Location</span>
                </label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => handleChange('destination', e.target.value)}
                  placeholder="Enter destination"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  required
                />
              </motion.div>

              {/* Vehicle Type */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
              >
                <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-3">
                  <Car className="w-4 h-4 text-slate-600" />
                  <span>Vehicle Type</span>
                </label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white transition-all"
                >
                  <optgroup label="ICE Vehicles">
                    <option value="motorcycle">Motorcycle</option>
                    <option value="tricycle">Tricycle</option>
                    <option value="sedan">Sedan / Private Car</option>
                    <option value="van">Van</option>
                    <option value="bus">Bus</option>
                  </optgroup>
                  <optgroup label="HEV Vehicles">
                    <option value="hybrid_car">Hybrid Car</option>
                    <option value="hybrid_van">Hybrid Van</option>
                  </optgroup>
                  <optgroup label="BEV Vehicles">
                    <option value="e_trike">E-Trike</option>
                    <option value="e_motorcycle">E-Motorcycle</option>
                  </optgroup>
                </select>
              </motion.div>

              {/* Fuel Type */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
              >
                <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-3">
                  <Fuel className="w-4 h-4 text-orange-600" />
                  <span>Fuel Type</span>
                </label>
                <select
                  value={formData.fuelType}
                  onChange={(e) => handleChange('fuelType', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white transition-all"
                >
                  <option value="gasoline">Gasoline</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                </select>
              </motion.div>

              {/* Fuel Price */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
              >
                <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-3">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span>Fuel/Energy Price (per unit)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-500">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fuelPrice}
                    onChange={(e) => handleChange('fuelPrice', e.target.value)}
                    placeholder="62.00"
                    className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {formData.fuelType === 'electric' ? 'Price per kWh (local utility rate)' : 'Price per liter (DOE Region II)'}
                </p>
              </motion.div>

              {/* Analyze Button */}
              <motion.button
                type="submit"
                disabled={isAnalyzing}
                whileHover={{ scale: isAnalyzing ? 1 : 1.02 }}
                whileTap={{ scale: isAnalyzing ? 1 : 0.98 }}
                className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white py-4 rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
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
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  title={consent.isConsented ? 'Stop sharing your live location' : 'Share your live location with the app'}
                  onClick={() => {
                    if (!consent.isConsented) {
                      setShowPrivacyModal(true);
                    } else {
                      setConsent(false);
                    }
                  }}
                  className={`flex-1 py-3 px-4 border rounded-xl text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${
                    consent.isConsented
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span>{consent.isConsented ? 'Tracking Live' : 'Enable Live Tracking'}</span>
                </button>
                <button 
                  type="button" 
                  title="Coming Soon: Connect OBD-II via Bluetooth for real vehicle data"
                  className="flex-1 py-3 px-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-sm font-medium flex items-center justify-center space-x-2 cursor-not-allowed"
                >
                  <Settings className="w-4 h-4" />
                  <span>Connect OBD-II</span>
                </button>
              </div>
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
