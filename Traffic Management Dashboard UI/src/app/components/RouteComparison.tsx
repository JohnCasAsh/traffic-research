import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Award,
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
import { DashboardMap } from './DashboardMap';

type TrafficLevel = 'low' | 'moderate' | 'heavy';

type RouteMetrics = {
  id: string;
  rank: number;
  label: string;
  description: string;
  distanceKm: number;
  durationMinutes: number;
  staticDurationMinutes: number;
  trafficDelayMinutes: number;
  trafficLevel: TrafficLevel;
  estimatedCostPhp: number;
  totalFuelLiters: number;
  totalEnergyKwh: number;
  efficiencyScore: number;
  co2Kg: number;
  isRecommended: boolean;
  warnings: string[];
  componentScores: {
    time: number;
    fuel: number;
    traffic: number;
    speedStability: number;
  };
  averageSpeedKph: number;
  stopCount: number;
  idleMinutes: number;
  vsp: {
    averageKwPerTon: number;
    maxKwPerTon: number;
    ecoShare: number;
    moderateShare: number;
    wasteShare: number;
  };
};

type AnalysisResponse = {
  generatedAt: string;
  request: {
    origin: string;
    destination: string;
    vehicleType: string;
    vehicleLabel: string;
    fuelType: string;
    fuelPrice: number;
    currency: string;
  };
  recommendedRouteId: string;
  routes: RouteMetrics[];
};

type RouteFormData = {
  origin: string;
  destination: string;
  vehicleType: string;
  fuelType: string;
  fuelPrice: string;
};

const DEFAULT_FORM_DATA: RouteFormData = {
  origin: 'Tuguegarao City Hall, Tuguegarao City, Cagayan',
  destination: 'Tuguegarao Airport, Tuguegarao City, Cagayan',
  vehicleType: 'sedan',
  fuelType: 'gasoline',
  fuelPrice: '62.00',
};

const LAST_ANALYSIS_STORAGE_KEY = 'smartroute:last-analysis';

function buildApiBaseUrl() {
  const raw = (
    import.meta as ImportMeta & {
      env?: { VITE_API_URL?: string };
    }
  ).env?.VITE_API_URL;

  const trimmed = String(raw || '').trim().replace(/\/$/, '');
  if (trimmed) {
    return trimmed;
  }

  return typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://api.navocs.com';
}

function formatFuelValue(route: RouteMetrics, fuelType: string) {
  if (fuelType === 'electric') {
    return `${route.totalEnergyKwh.toFixed(2)} kWh`;
  }

  return `${route.totalFuelLiters.toFixed(2)} L`;
}

function formatTrafficLabel(level: TrafficLevel) {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)} Traffic`;
}

function buildFallbackAnalysis(formData: RouteFormData): AnalysisResponse {
  const fuelType = String(formData.fuelType || 'gasoline').toLowerCase();
  const fuelPrice = Number.parseFloat(formData.fuelPrice || '0') || (fuelType === 'electric' ? 10 : 62);
  const vehicleLabel =
    formData.vehicleType === 'e_trike' || formData.vehicleType === 'etrike'
      ? 'E-Trike'
      : formData.vehicleType === 'e_motorcycle' || formData.vehicleType === 'emotorcycle'
        ? 'E-Motorcycle'
        : formData.vehicleType === 'hybrid_car' || formData.vehicleType === 'hybrid'
          ? 'Hybrid Car'
          : formData.vehicleType === 'hybrid_van'
            ? 'Hybrid Van'
            : 'Sedan / Private Car';

  const prototypes: Array<{
    label: string;
    description: string;
    distanceKm: number;
    durationMinutes: number;
    trafficDelayMinutes: number;
    trafficLevel: TrafficLevel;
    speedStability: number;
  }> = [
    {
      label: 'Balanced City Route',
      description: 'Fallback estimate while live backend analysis is temporarily unavailable.',
      distanceKm: 16.8,
      durationMinutes: 42,
      trafficDelayMinutes: 7,
      trafficLevel: 'moderate',
      speedStability: 76,
    },
    {
      label: 'Fastest Main Road',
      description: 'Higher traffic pressure but lower travel time.',
      distanceKm: 18.3,
      durationMinutes: 39,
      trafficDelayMinutes: 11,
      trafficLevel: 'heavy',
      speedStability: 63,
    },
    {
      label: 'Lower Traffic Bypass',
      description: 'Longer distance with steadier traffic conditions.',
      distanceKm: 19.5,
      durationMinutes: 44,
      trafficDelayMinutes: 4,
      trafficLevel: 'low',
      speedStability: 84,
    },
  ];

  const baselineConsumptionPerKm = fuelType === 'electric' ? 0.14 : 0.085;

  const routes = prototypes.map((item, index) => {
    const trafficMultiplier = item.trafficLevel === 'heavy' ? 1.15 : item.trafficLevel === 'moderate' ? 1.05 : 0.95;
    const unitsUsed = item.distanceKm * baselineConsumptionPerKm * trafficMultiplier;
    const estimatedCostPhp = unitsUsed * fuelPrice;
    const co2Kg = fuelType === 'electric' ? unitsUsed * 0.72 : unitsUsed * 2.31;
    const efficiencyScore = Math.round(
      (100 - item.trafficDelayMinutes * 3) * 0.35 +
      (100 - (estimatedCostPhp / Math.max(estimatedCostPhp, 1)) * 40) * 0.25 +
      item.speedStability * 0.4
    );

    return {
      id: `route-${index + 1}`,
      rank: index + 1,
      label: item.label,
      description: item.description,
      distanceKm: item.distanceKm,
      durationMinutes: item.durationMinutes,
      staticDurationMinutes: Math.max(1, item.durationMinutes - item.trafficDelayMinutes),
      trafficDelayMinutes: item.trafficDelayMinutes,
      trafficLevel: item.trafficLevel,
      estimatedCostPhp: Number(estimatedCostPhp.toFixed(2)),
      totalFuelLiters: fuelType === 'electric' ? 0 : Number(unitsUsed.toFixed(3)),
      totalEnergyKwh: fuelType === 'electric' ? Number(unitsUsed.toFixed(3)) : 0,
      efficiencyScore,
      co2Kg: Number(co2Kg.toFixed(2)),
      isRecommended: false,
      warnings: ['Fallback estimate only'],
      componentScores: {
        time: Math.max(50, 100 - item.durationMinutes),
        fuel: Math.max(50, 100 - Math.round(unitsUsed * 10)),
        traffic: item.trafficLevel === 'heavy' ? 58 : item.trafficLevel === 'moderate' ? 72 : 88,
        speedStability: item.speedStability,
      },
      averageSpeedKph: Number((item.distanceKm / (item.durationMinutes / 60)).toFixed(1)),
      stopCount: item.trafficLevel === 'heavy' ? 8 : item.trafficLevel === 'moderate' ? 5 : 3,
      idleMinutes: Number((item.trafficDelayMinutes * 0.6).toFixed(1)),
      vsp: {
        averageKwPerTon: item.trafficLevel === 'heavy' ? 8.6 : item.trafficLevel === 'moderate' ? 7.2 : 6.1,
        maxKwPerTon: item.trafficLevel === 'heavy' ? 21.5 : item.trafficLevel === 'moderate' ? 18.2 : 15.4,
        ecoShare: item.trafficLevel === 'heavy' ? 28 : item.trafficLevel === 'moderate' ? 37 : 48,
        moderateShare: item.trafficLevel === 'heavy' ? 44 : item.trafficLevel === 'moderate' ? 41 : 36,
        wasteShare: item.trafficLevel === 'heavy' ? 28 : item.trafficLevel === 'moderate' ? 22 : 16,
      },
    };
  });

  routes.sort((left, right) => right.efficiencyScore - left.efficiencyScore);
  routes.forEach((route, index) => {
    route.rank = index + 1;
    route.isRecommended = index === 0;
  });

  return {
    generatedAt: new Date().toISOString(),
    request: {
      origin: formData.origin || DEFAULT_FORM_DATA.origin,
      destination: formData.destination || DEFAULT_FORM_DATA.destination,
      vehicleType: formData.vehicleType || DEFAULT_FORM_DATA.vehicleType,
      vehicleLabel,
      fuelType,
      fuelPrice,
      currency: 'PHP',
    },
    recommendedRouteId: routes[0].id,
    routes,
  };
}

export function RouteComparison() {
  const location = useLocation();
  const formData = (location.state as RouteFormData | null) || DEFAULT_FORM_DATA;
  const apiBaseUrl = useMemo(() => buildApiBaseUrl(), []);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalysis() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/routes/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        const rawPayload = await response.text();
        let payload: any = null;

        try {
          payload = JSON.parse(rawPayload);
        } catch {
          payload = null;
        }

        if (!response.ok) {
          throw new Error(payload?.details || payload?.error || 'Failed to analyze routes.');
        }

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
          const fallback = buildFallbackAnalysis(formData);
          setAnalysis(fallback);
          setErrorMessage(
            error instanceof Error
              ? `Live backend analysis unavailable: ${error.message}. Showing fallback estimates.`
              : 'Live backend analysis unavailable. Showing fallback estimates.'
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
  }, [apiBaseUrl, formData]);

  const routes = analysis?.routes || [];
  const recommendedRoute = routes.find((route) => route.isRecommended) || routes[0] || null;
  const fastestRoute = [...routes].sort((left, right) => left.durationMinutes - right.durationMinutes)[0];
  const cheapestRoute = [...routes].sort((left, right) => left.estimatedCostPhp - right.estimatedCostPhp)[0];
  const referenceRoute = fastestRoute || recommendedRoute;
  const savingsPhp =
    recommendedRoute && referenceRoute
      ? Math.max(0, referenceRoute.estimatedCostPhp - recommendedRoute.estimatedCostPhp)
      : 0;
  const savingsPercent =
    recommendedRoute && referenceRoute && referenceRoute.estimatedCostPhp > 0
      ? Math.round((savingsPhp / referenceRoute.estimatedCostPhp) * 100)
      : 0;
  const fuelSavings =
    recommendedRoute && referenceRoute
      ? Math.max(
          0,
          (analysis?.request.fuelType === 'electric'
            ? referenceRoute.totalEnergyKwh - recommendedRoute.totalEnergyKwh
            : referenceRoute.totalFuelLiters - recommendedRoute.totalFuelLiters)
        )
      : 0;
  const co2Savings =
    recommendedRoute && referenceRoute
      ? Math.max(0, referenceRoute.co2Kg - recommendedRoute.co2Kg)
      : 0;

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Route Analysis Complete</h1>
          <p className="text-slate-600">
            Comparing {routes.length} Google route{routes.length === 1 ? '' : 's'} for{' '}
            {analysis.request.vehicleLabel} using a VSP-based cost model at ₱
            {analysis.request.fuelPrice.toFixed(2)}
            {analysis.request.fuelType === 'electric' ? '/kWh' : '/L'}.
          </p>
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
                {recommendedRoute.label} saves ₱{savingsPhp.toFixed(2)} ({savingsPercent}%)
                {cheapestRoute?.id === recommendedRoute.id ? ' and is the cheapest option.' : ' while keeping traffic and speed stability balanced.'}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"
              >
                <SummaryStat
                  icon={<TrendingDown className="w-4 h-4 text-green-600" />}
                  label="Efficiency Score"
                  value={String(recommendedRoute.efficiencyScore)}
                />
                <SummaryStat
                  icon={<DollarSign className="w-4 h-4 text-green-600" />}
                  label="Estimated Cost"
                  value={`₱${recommendedRoute.estimatedCostPhp.toFixed(2)}`}
                />
                <SummaryStat
                  icon={<Fuel className="w-4 h-4 text-green-600" />}
                  label={analysis.request.fuelType === 'electric' ? 'Energy Saved' : 'Fuel Saved'}
                  value={`${fuelSavings.toFixed(2)} ${analysis.request.fuelType === 'electric' ? 'kWh' : 'L'}`}
                />
                <SummaryStat
                  icon={<Leaf className="w-4 h-4 text-green-600" />}
                  label="CO₂ Reduced"
                  value={`${co2Savings.toFixed(2)} kg`}
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
                    <strong>Traffic delay stays at</strong> {recommendedRoute.trafficDelayMinutes.toFixed(1)} extra minutes with a {formatTrafficLabel(recommendedRoute.trafficLevel).toLowerCase()} profile.
                  </ReasonRow>
                  <ReasonRow>
                    <strong>Live VSP bands are favorable</strong>: {recommendedRoute.vsp.ecoShare.toFixed(1)}% eco, {recommendedRoute.vsp.wasteShare.toFixed(1)}% high-consumption segments.
                  </ReasonRow>
                </ul>
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
              <RouteCard route={route} fuelType={analysis.request.fuelType} />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-4">Route Visualization</h2>
          <div className="relative rounded-lg overflow-hidden" style={{ height: '480px' }}>
            <DashboardMap
              origin={analysis.request.origin || DEFAULT_FORM_DATA.origin}
              destination={analysis.request.destination || DEFAULT_FORM_DATA.destination}
              liveTrackingEnabled={false}
            />

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute top-4 right-4 z-10 bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Leaf className="w-3.5 h-3.5" />
              Eco-Routing Active
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2.5 shadow text-xs space-y-1.5"
            >
              <div className="font-semibold text-slate-700 mb-1">Predicted Trip Snapshot</div>
              <div className="text-slate-600">Before Trip: ₱{recommendedRoute.estimatedCostPhp.toFixed(2)} projected spend</div>
              <div className="text-slate-600">Fuel / Energy: {formatFuelValue(recommendedRoute, analysis.request.fuelType)}</div>
              <div className="text-slate-600">Time: {recommendedRoute.durationMinutes.toFixed(1)} min</div>
            </motion.div>
          </div>
        </motion.div>
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

function RouteCard({ route, fuelType }: { route: RouteMetrics; fuelType: string }) {
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

        <div className="flex items-center space-x-2 mb-3">
          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${route.efficiencyScore}%` }}
              transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                route.efficiencyScore >= 90
                  ? 'bg-green-500'
                  : route.efficiencyScore >= 75
                  ? 'bg-blue-500'
                  : 'bg-orange-500'
              }`}
            />
          </div>
          <span className="text-sm font-bold text-slate-700">{route.efficiencyScore}</span>
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
          value={`${route.co2Kg.toFixed(2)} kg`}
        />
        <MetricRow
          icon={<TrendingDown className="w-4 h-4 text-teal-600" />}
          label="Traffic Delay"
          value={`${route.trafficDelayMinutes.toFixed(1)} min`}
        />
      </div>
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
