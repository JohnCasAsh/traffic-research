import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { MapPin, Navigation, Fuel, DollarSign, Car, Zap, TrendingUp, Settings, Info, X, AlertCircle } from 'lucide-react';
import { DashboardMap } from './DashboardMap';
import { useLocationConsent } from '../LocationConsentContext';
import {
  formatLocationAccuracy,
  GeolocationLookupError,
  getReliableCurrentPosition,
} from '../location';

export function Dashboard() {
  const navigate = useNavigate();
  const { consent, setConsent, isSharingLocation } = useLocationConsent();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false);
  const [isLocatingOrigin, setIsLocatingOrigin] = useState(false);
  const [originLocationStatus, setOriginLocationStatus] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    vehicleType: 'sedan',
    fuelType: 'gasoline',
    fuelPrice: '3.50',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    
    // Simulate analysis
    setTimeout(() => {
      setIsAnalyzing(false);
      navigate('/routes', { state: formData });
    }, 2000);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUseCurrentLocation = async () => {
    setIsLocatingOrigin(true);
    setOriginLocationStatus(null);

    try {
      let locationResult;
      try {
        locationResult = await getReliableCurrentPosition({
          desiredAccuracyMeters: 55,
          maxAcceptableAccuracyMeters: 130,
          timeoutMs: 22000,
          settleTimeMs: 3500,
        });
      } catch (error) {
        if (
          error instanceof GeolocationLookupError &&
          (error.code === 'coarse-location' || error.code === 'timeout')
        ) {
          locationResult = await getReliableCurrentPosition();
        } else {
          throw error;
        }
      }

      const { position, accuracyMeters, precise } = locationResult;
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const coordinateText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      const accuracyText = formatLocationAccuracy(accuracyMeters);

      setFormData((previous) => ({
        ...previous,
        origin: coordinateText,
      }));
      
      // Update location consent context if user has consented
      if (consent.isConsented) {
        // This will be handled by the map component
      }

      setOriginLocationStatus(
        precise
          ? accuracyText
            ? `Current location applied. Accuracy about ${accuracyText}. You can still edit Origin manually.`
            : 'Current location applied. You can still edit Origin manually.'
          : accuracyText
            ? `Current location applied with approximate accuracy about ${accuracyText}. Verify the pin before routing.`
            : 'Current location applied with approximate accuracy. Verify the pin before routing.'
      );
    } catch (error) {
      if (error instanceof GeolocationLookupError) {
        if (error.code === 'unsupported') {
          setOriginLocationStatus('Location is not supported in this browser.');
        } else if (error.code === 'permission-denied') {
          setOriginLocationStatus('Location permission was denied. Enable it to use current origin.');
        } else if (error.code === 'coarse-location') {
          const accuracyText = formatLocationAccuracy(error.accuracyMeters);
          setOriginLocationStatus(
            accuracyText
              ? `Location looks too broad right now, about ${accuracyText}. Move to a clearer signal or enable device location services, then try again.`
              : 'Location looks too broad right now. Move to a clearer signal or enable device location services, then try again.'
          );
        } else if (error.code === 'timeout') {
          setOriginLocationStatus('Location is taking too long to become accurate. Please try again.');
        } else {
          setOriginLocationStatus('Unable to read current location. You can enter Origin manually.');
        }
      } else {
        setOriginLocationStatus('Unable to read current location. You can enter Origin manually.');
      }
    } finally {
      setIsLocatingOrigin(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
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
                    disabled={isLocatingOrigin}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <Navigation className="w-3 h-3 mr-1" /> {isLocatingOrigin ? 'Locating...' : 'Use current'}
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
                  onChange={(e) => handleChange('vehicleType', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white transition-all"
                >
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="truck">Truck</option>
                  <option value="electric">Electric Vehicle</option>
                  <option value="hybrid">Hybrid</option>
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
                  <option value="hybrid">Hybrid</option>
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
                    placeholder="3.50"
                    className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {formData.fuelType === 'electric' ? 'Price per kWh' : 'Price per gallon'}
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
                      setLiveTrackingEnabled(false);
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

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-6 grid grid-cols-2 gap-4"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200"
              >
                <div className="text-xs text-green-700 mb-1">Avg. Savings</div>
                <div className="text-2xl font-bold text-green-900">28%</div>
                <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+5% this month</span>
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200"
              >
                <div className="text-xs text-blue-700 mb-1">Routes Analyzed</div>
                <div className="text-2xl font-bold text-blue-900">1,247</div>
                <div className="flex items-center space-x-1 text-xs text-blue-600 mt-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+12% this week</span>
                </div>
              </motion.div>
            </motion.div>

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
                  setLiveTrackingEnabled(true);
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