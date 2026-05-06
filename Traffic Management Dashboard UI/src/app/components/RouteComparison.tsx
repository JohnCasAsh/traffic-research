import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Award,
  Bookmark,
  CheckCircle2,
  Clock,
  DollarSign,
  Fuel,
  Leaf,
  LoaderCircle,
  MapPin,
  Navigation,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { RouteAnalysisMap } from './RouteAnalysisMap';
import { AssistantPanel } from './AssistantPanel';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';
import {
  type RouteAnalysisResponse,
  type RouteMetrics,
  type TrafficLevel,
  buildApiBaseUrl,
  buildRouteAnalysisRequest,
  buildRouteAnalysisRequestKey,
  doesAnalysisMatchRequest,
  fetchRouteAnalysis,
} from '../routeAnalysis';

type RouteFormData = {
  origin: string;
  destination: string;
  vehicleType: string;
  fuelType: string;
  fuelPrice: string;
};

type RouteNavigationState = RouteFormData & {
  preloadedAnalysis?: RouteAnalysisResponse;
  analysisRequestKey?: string;
};

const DEFAULT_FORM_DATA: RouteFormData = {
  origin: 'Tuguegarao City Hall, Tuguegarao City, Cagayan',
  destination: 'Tuguegarao Airport, Tuguegarao City, Cagayan',
  vehicleType: 'sedan',
  fuelType: 'gasoline',
  fuelPrice: '62.00',
};

const LAST_ANALYSIS_STORAGE_KEY = 'smartroute:last-analysis';
const BEFORE_TRIP_STORAGE_KEY = 'smartroute:before-trip';

function formatFuelValue(route: RouteMetrics, fuelType: string) {
  if (fuelType === 'electric') {
    const energyValue = route.totalEnergyKwh < 10 ? route.totalEnergyKwh.toFixed(3) : route.totalEnergyKwh.toFixed(2);
    return `${energyValue} kWh`;
  }

  const fuelValue = route.totalFuelLiters < 1 ? route.totalFuelLiters.toFixed(3) : route.totalFuelLiters.toFixed(2);
  return `${fuelValue} L`;
}

function formatCo2Value(co2Kg: number) {
  return `${co2Kg < 1 ? co2Kg.toFixed(3) : co2Kg.toFixed(2)} kg`;
}

function formatDeltaValue(value: number, unit: string) {
  const normalized = Math.max(0, Number.isFinite(value) ? value : 0);
  const displayValue = normalized < 1 ? normalized.toFixed(3) : normalized.toFixed(2);
  return `${displayValue} ${unit}`;
}

function formatSignedDeltaValue(value: number, unit: string) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue > 0 ? '+' : safeValue < 0 ? '-' : '';
  const absoluteValue = Math.abs(safeValue);
  const displayValue = absoluteValue < 1 ? absoluteValue.toFixed(3) : absoluteValue.toFixed(2);
  return `${sign}${displayValue} ${unit}`;
}

function formatTrafficLabel(level: TrafficLevel) {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)} Traffic`;
}

function toDisplayScore(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function routeSequenceFromId(routeId: string) {
  const match = String(routeId || '').match(/^route-(\d+)$/i);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function pickBaselineRoute(routes: RouteMetrics[], recommendedRoute: RouteMetrics | null) {
  if (!recommendedRoute) {
    return null;
  }

  const googleRoute = routes.find((route) => route.isGoogleRecommended) || null;
  if (googleRoute && googleRoute.id !== recommendedRoute.id) {
    return googleRoute;
  }

  const alternatives = routes.filter((route) => route.id !== recommendedRoute.id);
  if (!alternatives.length) {
    return null;
  }

  return [...alternatives].sort((left, right) => left.durationMinutes - right.durationMinutes)[0];
}

function formatChoiceLabel(value: string) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function RouteComparison() {
  const location = useLocation();
  const locationState = (location.state as RouteNavigationState | null) || null;
  const { token } = useAuth();
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
  const formData = useMemo<RouteFormData>(() => {
    if (!locationState) {
      return DEFAULT_FORM_DATA;
    }

    return {
      origin: locationState.origin || DEFAULT_FORM_DATA.origin,
      destination: locationState.destination || DEFAULT_FORM_DATA.destination,
      vehicleType: locationState.vehicleType || DEFAULT_FORM_DATA.vehicleType,
      fuelType: locationState.fuelType || DEFAULT_FORM_DATA.fuelType,
      fuelPrice: locationState.fuelPrice || DEFAULT_FORM_DATA.fuelPrice,
    };
  }, [locationState]);
  const apiBaseUrl = useMemo(() => buildApiBaseUrl(), []);
  const navigate = useNavigate();
  const analysisRequest = useMemo(() => buildRouteAnalysisRequest(formData), [formData]);
  const analysisRequestKey = useMemo(
    () => buildRouteAnalysisRequestKey(analysisRequest),
    [analysisRequest]
  );
  const preloadedAnalysis = useMemo(() => {
    const candidate = locationState?.preloadedAnalysis;
    if (!candidate) {
      return null;
    }

    const preloadedRequestKey = String(locationState?.analysisRequestKey || '').trim();
    if (preloadedRequestKey && preloadedRequestKey !== analysisRequestKey) {
      return null;
    }

    return doesAnalysisMatchRequest(candidate, analysisRequest) ? candidate : null;
  }, [locationState, analysisRequest, analysisRequestKey]);

  const [analysis, setAnalysis] = useState<RouteAnalysisResponse | null>(() => preloadedAnalysis);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const savedAnalysisKeyRef = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'limit'>('idle');

  const handleSaveRoute = async () => {
    if (!token || !formData.origin || !formData.destination) return;
    setSaveStatus('saving');
    try {
      const label = `${formData.origin.split(',')[0]} → ${formData.destination.split(',')[0]}`;
      const res = await fetch(`${API_URL}/api/saved-routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label,
          origin: formData.origin,
          destination: formData.destination,
          vehicle_type: formData.vehicleType,
          fuel_type: formData.fuelType,
          fuel_price: formData.fuelPrice,
        }),
      });
      if (res.status === 409) { setSaveStatus('limit'); return; }
      if (!res.ok) throw new Error();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleStartTracking = (route: RouteMetrics) => {
    if (!analysis) return;
    const ft = analysis.request.fuelType;
    window.localStorage.setItem(
      BEFORE_TRIP_STORAGE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        prediction: {
          routeLabel: route.label,
          predictedDurationMinutes: route.durationMinutes,
          predictedDistanceKm: route.distanceKm,
          predictedFuelOrEnergy: ft === 'electric' ? route.totalEnergyKwh : route.totalFuelLiters,
          predictedCostPhp: route.estimatedCostPhp,
          predictedCo2Kg: route.co2Kg,
          unitLabel: ft === 'electric' ? 'kWh' : 'L',
        },
        vehicleType: analysis.request.vehicleType,
        fuelType: ft,
        fuelPrice: analysis.request.fuelPrice,
      })
    );
    navigate('/speed-meter');
  };

  useEffect(() => {
    let cancelled = false;

    async function loadAnalysis() {
      if (preloadedAnalysis) {
        setAnalysis(preloadedAnalysis);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const payload = await fetchRouteAnalysis(apiBaseUrl, analysisRequest);

        if (!cancelled) {
          setAnalysis(payload);
          window.localStorage.setItem(
            LAST_ANALYSIS_STORAGE_KEY,
            JSON.stringify({
              savedAt: new Date().toISOString(),
              analysis: payload,
            })
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAnalysis(null);
          setErrorMessage(
            error instanceof Error
              ? `Live backend analysis unavailable: ${error.message}.`
              : 'Live backend analysis unavailable.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, analysisRequest, preloadedAnalysis]);

  // Silently save each unique analysis result as a trip cost pair for the stats card.
  useEffect(() => {
    if (isLoading || !analysis?.routes?.length) return;
    if (savedAnalysisKeyRef.current === analysisRequestKey) return;

    const sorted = [...analysis.routes].sort(
      (a, b) => routeSequenceFromId(a.id) - routeSequenceFromId(b.id)
    );
    const recommended = sorted.find(r => r.isRecommended) || sorted[0] || null;
    if (!recommended) return;

    const baseline = pickBaselineRoute(sorted, recommended);
    const fastest = [...sorted].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
    const effective = baseline || fastest || recommended;
    if (!effective || effective.id === recommended.id || effective.estimatedCostPhp <= 0) return;

    savedAnalysisKeyRef.current = analysisRequestKey;

    fetch(`${API_URL}/api/routes/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        savedAt: new Date().toISOString(),
        userId: token ? (() => { try { return JSON.parse(atob(token.split('.')[1])).sub; } catch { return null; } })() : null,
        baselineCost: effective.estimatedCostPhp,
        navocsCost: recommended.estimatedCostPhp,
        vehicleType: analysis.request.vehicleType,
        fuelType: analysis.request.fuelType,
        fuelPrice: analysis.request.fuelPrice,
        origin: analysis.request.origin,
        destination: analysis.request.destination,
      }),
    }).catch(() => {});
  }, [analysis, isLoading, analysisRequestKey, token]);

  const routes = useMemo(() => {
    const rawRoutes = analysis?.routes || [];
    return [...rawRoutes].sort(
      (left, right) => routeSequenceFromId(left.id) - routeSequenceFromId(right.id)
    );
  }, [analysis]);
  const recommendedRoute = routes.find((route) => route.isRecommended) || routes[0] || null;
  const baselineRoute = pickBaselineRoute(routes, recommendedRoute);
  const fastestRoute = [...routes].sort((left, right) => left.durationMinutes - right.durationMinutes)[0];
  const cheapestRoute = [...routes].sort((left, right) => left.estimatedCostPhp - right.estimatedCostPhp)[0];
  const fallbackReferenceRoute = fastestRoute || recommendedRoute;
  const effectiveBaselineRoute = baselineRoute || fallbackReferenceRoute;
  const savingsPhpRaw =
    recommendedRoute && effectiveBaselineRoute
      ? effectiveBaselineRoute.estimatedCostPhp - recommendedRoute.estimatedCostPhp
      : 0;
  const savingsPhp = Math.max(0, savingsPhpRaw);
  const extraCostPhp = Math.max(0, -savingsPhpRaw);
  const savingsPercent =
    recommendedRoute && effectiveBaselineRoute && effectiveBaselineRoute.estimatedCostPhp > 0
      ? Math.round((Math.abs(savingsPhpRaw) / effectiveBaselineRoute.estimatedCostPhp) * 100)
      : 0;
  const fuelSavingsRaw =
    recommendedRoute && effectiveBaselineRoute
      ? (analysis?.request.fuelType === 'electric'
          ? effectiveBaselineRoute.totalEnergyKwh - recommendedRoute.totalEnergyKwh
          : effectiveBaselineRoute.totalFuelLiters - recommendedRoute.totalFuelLiters)
      : 0;
  const co2SavingsRaw =
    recommendedRoute && effectiveBaselineRoute
      ? effectiveBaselineRoute.co2Kg - recommendedRoute.co2Kg
      : 0;
  const baselineRouteLabel =
    effectiveBaselineRoute && recommendedRoute && effectiveBaselineRoute.id !== recommendedRoute.id
      ? effectiveBaselineRoute.label
      : 'same route';
  const requestedFuelPrice = Number(formData.fuelPrice);
  const displayFuelPrice = Number.isFinite(requestedFuelPrice)
    ? requestedFuelPrice
    : analysis.request.fuelPrice;
  const requestedTarget = {
    origin: formData.origin.trim() || analysis.request.origin,
    destination: formData.destination.trim() || analysis.request.destination,
    vehicleType: formData.vehicleType.trim() || analysis.request.vehicleType,
    fuelType: formData.fuelType.trim() || analysis.request.fuelType,
    fuelPrice: displayFuelPrice,
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <LoaderCircle className="w-10 h-10 text-teal-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Analyzing Real Routes</h1>
            <p className="text-slate-600">
              Fetching Google routes, sampling elevation, and computing VSP-based fuel cost for your trip.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis || !recommendedRoute) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-10 text-center">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Route Analysis Failed</h1>
            <p className="text-slate-600 mb-4">
              {errorMessage || 'No route data was returned for this trip.'}
            </p>
            <p className="text-sm text-slate-500">
              Check that the backend is running and the Google Maps API key is available to the server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="flex h-full">
        {/* Main Content */}
        <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
          <div className="flex items-center space-x-2 text-sm text-slate-600 mb-2">
            <MapPin className="w-4 h-4" />
            <span>
              {analysis.request.origin} → {analysis.request.destination}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Route Analysis Complete</h1>
              <p className="text-slate-600">
                Comparing {routes.length} Google route{routes.length === 1 ? '' : 's'} for{' '}
                {analysis.request.vehicleLabel} using a VSP-based cost model at ₱
                {analysis.request.fuelPrice.toFixed(2)}
                {analysis.request.fuelType === 'electric' ? '/kWh' : '/L'}.
              </p>
            </div>
            <button
              onClick={handleSaveRoute}
              disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition shrink-0 ${
                saveStatus === 'saved' ? 'bg-teal-100 text-teal-700' :
                saveStatus === 'limit' ? 'bg-amber-100 text-amber-700' :
                saveStatus === 'error' ? 'bg-red-100 text-red-700' :
                'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              } disabled:opacity-60`}
            >
              <Bookmark className="w-4 h-4" />
              {saveStatus === 'saving' ? 'Saving…' :
               saveStatus === 'saved' ? 'Saved!' :
               saveStatus === 'limit' ? 'Limit reached (10 max)' :
               saveStatus === 'error' ? 'Failed — try again' :
               'Save Route'}
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">User Target Inputs</h2>
            <p className="mt-1 text-xs text-slate-500">These values are exactly what the user entered before analysis.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <TargetField label="Origin" value={requestedTarget.origin} />
              <TargetField label="Destination" value={requestedTarget.destination} />
              <TargetField label="Vehicle" value={formatChoiceLabel(requestedTarget.vehicleType)} />
              <TargetField label="Fuel Type" value={formatChoiceLabel(requestedTarget.fuelType)} />
              <TargetField
                label="Fuel Price"
                value={`₱${requestedTarget.fuelPrice.toFixed(2)}${requestedTarget.fuelType === 'electric' ? '/kWh' : '/L'}`}
              />
            </div>
          </div>
          {errorMessage ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 mb-8 shadow-lg relative overflow-hidden"
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute top-0 right-0 w-64 h-64 bg-green-200 rounded-full blur-3xl"
          />

          <div className="flex items-start space-x-4 relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center"
            >
              <Award className="w-6 h-6 text-white" />
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h2 className="text-xl font-bold text-slate-900">Recommended Route</h2>
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>BEST CHOICE</span>
                </motion.span>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-green-900 mb-4 text-lg font-medium"
              >
                {recommendedRoute.label}{' '}
                {savingsPhp > 0
                  ? `saves ₱${savingsPhp.toFixed(2)} (${savingsPercent}%)`
                  : extraCostPhp > 0
                    ? `costs ₱${extraCostPhp.toFixed(2)} (${savingsPercent}%) more`
                    : 'has the same estimated cost'}
                {cheapestRoute?.id === recommendedRoute.id
                  ? ` vs ${baselineRouteLabel} and is the cheapest option.`
                  : ` vs ${baselineRouteLabel} while keeping traffic and speed stability balanced.`}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4"
              >
                <SummaryStat
                  icon={<TrendingDown className="w-4 h-4 text-green-600" />}
                  label="Efficiency Score"
                  value={
                    toDisplayScore(recommendedRoute.efficiencyScore) !== null
                      ? String(toDisplayScore(recommendedRoute.efficiencyScore))
                      : 'N/A'
                  }
                />
                <SummaryStat
                  icon={<DollarSign className="w-4 h-4 text-green-600" />}
                  label="Estimated Cost"
                  value={`₱${recommendedRoute.estimatedCostPhp.toFixed(2)}`}
                />
                <SummaryStat
                  icon={<Fuel className="w-4 h-4 text-green-600" />}
                  label={analysis.request.fuelType === 'electric' ? 'Energy Used' : 'Fuel Used'}
                  value={formatFuelValue(recommendedRoute, analysis.request.fuelType)}
                />
                <SummaryStat
                  icon={<Fuel className="w-4 h-4 text-green-600" />}
                  label={analysis.request.fuelType === 'electric' ? 'Energy Saved vs Baseline' : 'Fuel Saved vs Baseline'}
                  value={formatSignedDeltaValue(fuelSavingsRaw, analysis.request.fuelType === 'electric' ? 'kWh' : 'L')}
                />
                <SummaryStat
                  icon={<Leaf className="w-4 h-4 text-green-600" />}
                  label="CO₂ Reduced vs Baseline"
                  value={formatSignedDeltaValue(co2SavingsRaw, 'kg')}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-white rounded-lg p-4 border border-green-200"
              >
                <h3 className="font-semibold text-slate-900 mb-2">Why this route was selected:</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <ReasonRow>
                    <strong>Best weighted efficiency score</strong> using travel time, fuel spend, traffic pressure, and speed stability.
                  </ReasonRow>
                  <ReasonRow>
                    <strong>Predicted {analysis.request.fuelType === 'electric' ? 'energy' : 'fuel'} use</strong> is {formatFuelValue(recommendedRoute, analysis.request.fuelType)} with {recommendedRoute.stopCount} estimated stop events.
                  </ReasonRow>
                  <ReasonRow>
                    <strong>Cost basis</strong> is {formatFuelValue(recommendedRoute, analysis.request.fuelType)} × ₱{analysis.request.fuelPrice.toFixed(2)}{analysis.request.fuelType === 'electric' ? '/kWh' : '/L'} = ₱{recommendedRoute.estimatedCostPhp.toFixed(2)}.
                  </ReasonRow>
                  <ReasonRow>
                    <strong>Traffic delay stays at</strong> {recommendedRoute.trafficDelayMinutes.toFixed(1)} extra minutes with a {formatTrafficLabel(recommendedRoute.trafficLevel).toLowerCase()} profile.
                  </ReasonRow>
                  <ReasonRow>
                    <strong>Live VSP bands are favorable</strong>: {recommendedRoute.vsp.ecoShare.toFixed(1)}% eco, {recommendedRoute.vsp.wasteShare.toFixed(1)}% high-consumption segments.
                  </ReasonRow>
                </ul>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="mt-4"
              >
                <button
                  type="button"
                  onClick={() => handleStartTracking(recommendedRoute)}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  <Navigation className="w-4 h-4" />
                  Start Tracking This Route
                </button>
              </motion.div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {routes.map((route, index) => (
            <motion.div
              key={route.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <RouteCard route={route} fuelType={analysis.request.fuelType} onStartTracking={handleStartTracking} />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-4">Route Visualization</h2>
          <p className="text-sm text-slate-600 mb-4">
            Map and details below use the same analyzed routes and prices shown above.
          </p>
          <RouteAnalysisMap
            routes={routes}
            fuelType={analysis.request.fuelType}
          />
        </motion.div>
        </div>

        <AssistantPanel chatUrl={chatUrl} chatLoading={chatLoading} />
      </div>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <motion.div whileHover={{ scale: 1.05 }} className="bg-white rounded-lg p-4 border border-green-200">
      <div className="flex items-center space-x-2 mb-1">
        {icon}
        <span className="text-xs text-slate-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-green-600">{value}</div>
    </motion.div>
  );
}

function TargetField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-800 break-words">{value}</div>
    </div>
  );
}

function ReasonRow({ children }: { children: ReactNode }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start space-x-2"
    >
      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </motion.li>
  );
}

function RouteCard({ route, fuelType, onStartTracking }: { route: RouteMetrics; fuelType: string; onStartTracking?: (route: RouteMetrics) => void }) {
  const score = toDisplayScore(route.efficiencyScore);
  const scoreForBar = score !== null ? Math.max(0, Math.min(100, score)) : 0;

  const trafficColors = {
    low: 'bg-green-100 text-green-700 border-green-300',
    moderate: 'bg-orange-100 text-orange-700 border-orange-300',
    heavy: 'bg-red-100 text-red-700 border-red-300',
  };

  const trafficIcons = {
    low: <CheckCircle2 className="w-4 h-4" />,
    moderate: <Clock className="w-4 h-4" />,
    heavy: <AlertTriangle className="w-4 h-4" />,
  };

  return (
    <motion.div
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`bg-white rounded-xl shadow-md border-2 transition-all ${
        route.isRecommended
          ? 'border-green-400 ring-4 ring-green-100'
          : 'border-slate-200 hover:border-teal-300'
      }`}
    >
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-start justify-between mb-2 gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{route.label}</h3>
            <p className="text-xs text-slate-500 mt-1">{route.description}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {route.isGoogleRecommended && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-200">
                RECOMMENDED BY GOOGLE
              </span>
            )}
            {route.isRecommended && (
              <motion.span
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full flex items-center space-x-1"
              >
                <Award className="w-3 h-3" />
                <span>BEST</span>
              </motion.span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 mb-3">
          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${scoreForBar}%` }}
              transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                scoreForBar >= 90
                  ? 'bg-green-500'
                  : scoreForBar >= 75
                  ? 'bg-blue-500'
                  : 'bg-orange-500'
              }`}
            />
          </div>
          <span className="text-sm font-bold text-slate-700">{score !== null ? score : 'N/A'}</span>
        </div>

        <div
          className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full border text-xs font-medium ${
            trafficColors[route.trafficLevel]
          }`}
        >
          {trafficIcons[route.trafficLevel]}
          <span>{formatTrafficLabel(route.trafficLevel)}</span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Pre-Trip Estimates</div>
        <MetricRow
          icon={<Navigation className="w-4 h-4 text-blue-600" />}
          label="Distance"
          value={`${route.distanceKm.toFixed(2)} km`}
        />
        <MetricRow
          icon={<Clock className="w-4 h-4 text-purple-600" />}
          label="Duration"
          value={`${route.durationMinutes.toFixed(1)} min`}
        />
        <MetricRow
          icon={<Fuel className="w-4 h-4 text-orange-600" />}
          label={fuelType === 'electric' ? 'Energy Used' : 'Fuel Used'}
          value={formatFuelValue(route, fuelType)}
        />
        <MetricRow
          icon={<DollarSign className="w-4 h-4 text-green-600" />}
          label="Estimated Cost"
          value={`₱${route.estimatedCostPhp.toFixed(2)}`}
          highlight={route.isRecommended}
        />
        <MetricRow
          icon={<Leaf className="w-4 h-4 text-green-600" />}
          label="CO₂ Emission"
          value={formatCo2Value(route.co2Kg)}
        />
        <MetricRow
          icon={<TrendingDown className="w-4 h-4 text-teal-600" />}
          label="Traffic Delay"
          value={`${route.trafficDelayMinutes.toFixed(1)} min`}
        />
      </div>
      {onStartTracking && (
        <div className="px-6 pb-5">
          <button
            type="button"
            onClick={() => onStartTracking(route)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <Navigation className="w-4 h-4" />
            Start Tracking
          </button>
        </div>
      )}
    </motion.div>
  );
}

function MetricRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg ${
        highlight ? 'bg-green-50 border border-green-200' : 'bg-slate-50'
      }`}
    >
      <div className="flex items-center space-x-2">
        {icon}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className={`font-semibold ${highlight ? 'text-green-700' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}
