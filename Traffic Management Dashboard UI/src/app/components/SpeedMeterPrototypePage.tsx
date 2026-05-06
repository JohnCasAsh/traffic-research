import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Fuel,
  Gauge,
  LocateFixed,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { formatLocationAccuracy } from '../location';
import { API_URL, buildAuthHeaders } from '../api';
import { AssistantPanel } from './AssistantPanel';
import { useAuth } from '../auth';

// ─── Types ─────────────────────────────────────────────────────────────────────

type KalmanState = { estimate: number; errorCovariance: number };
type SignalQuality = 'good' | 'ok' | 'poor' | 'none';
type LastPoint = {
  lat: number;
  lng: number;
  timestampMs: number;
  accuracyMeters: number;
  altitudeMeters: number | null;
};
type SpeedMeterMode = 'stable' | 'balanced' | 'responsive';
type Environment = 'auto' | 'indoors' | 'outdoors';

type SpeedSample = {
  id: string;
  timestampIso: string;
  elapsedSeconds: number;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  positionReliable: boolean;
  speedSource: 'gps_doppler' | 'computed' | 'zero';
  instantSpeedMps: number;
  rawSpeedMps: number;
  computedSpeedMps: number;
  kalmanSpeedMps: number;
  analysisMode: SpeedMeterMode;
  distanceDeltaMeters: number;
  cumulativeDistanceMeters: number;
  environment: Environment;
  altitudeMeters: number | null;
  accelerationMps2: number;
  grade: number;
  vspKwPerTon: number;
  segmentFuelOrEnergyPerKm: number;
  segmentCostPerKm: number;
  runningFuelOrEnergy: number;
  runningCostPhp: number;
};

type VehiclePowertrain = 'ICE' | 'HEV' | 'BEV';

type VehicleLiveProfile = {
  key: string;
  label: string;
  fuelType: 'gasoline' | 'diesel' | 'electric';
  powertrain: VehiclePowertrain;
  massKg: number;
  idleRateLitersPerMinute: number;
  engineEfficiency?: number;
  drivetrainEfficiency?: number;
  regenEfficiency?: number;
};

type PredictedTripSummary = {
  routeLabel: string;
  predictedDurationMinutes: number;
  predictedDistanceKm: number;
  predictedFuelOrEnergy: number;
  predictedCostPhp: number;
  predictedCo2Kg: number;
  unitLabel: 'L' | 'kWh';
};

type CompletedTripRecord = {
  id: string;
  finishedAt: string;
  vehicleType: string;
  fuelType: string;
  fuelPrice: number;
  predicted: PredictedTripSummary | null;
  actual: {
    durationMinutes: number;
    distanceKm: number;
    fuelOrEnergy: number;
    costPhp: number;
    co2Kg: number;
  };
  accuracy: {
    timePct: number | null;
    fuelPct: number | null;
    costPct: number | null;
  };
  synced: boolean;
};

type ModeConfig = {
  label: string;
  baseKalmanQ: number;
  fastKalmanQ: number;
  adaptiveQDeltaMps: number;
  movementSignificanceFactor: number;
  maxNoiseGateMeters: number;
  stillSpeedThresholdMps: number;
  stopLockMinSamples: number;
  zeroLockSpeedMps: number;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

// FIX 1: Separate accuracy thresholds for indoors vs outdoors.
// Indoors, GPS is always poor — we relax the gate so we still get *some* readings
// rather than rejecting everything. Outdoors we tighten it to filter multipath.
const ACCURACY_THRESHOLD: Record<Environment, number> = {
  outdoors: 15,   // tight — near buildings multipath typically pushes >15 m
  indoors:  50,   // relaxed — indoors rarely gets below 20–30 m; still usable
  auto:     25,   // middle ground when user hasn't specified
};

const KALMAN_R = 1.2;
const MIN_DELTA_TIME_SECONDS = 0.3; // FIX: was 0.5 — iOS can fire faster during warmup
const MAX_EXPECTED_SPEED_MPS = 50;  // ~180 km/h hard cap
const RESUME_GAP_REACQUIRE_SECONDS = 8;
const REACQUIRE_SKIP_SAMPLES = 5;
const RESUME_SPIKE_FILTER_SECONDS = 20;
const RESUME_SPIKE_MIN_SPEED_MPS = 1.2;
const RESUME_SPIKE_MAX_COMPUTED_MPS = 0.4;
const RESUME_SPIKE_MIN_ACCURACY_FACTOR = 0.6;

// FIX 4: Tighten max distance per sample — 120 m implied 432 km/h which is a
// building reflection, not movement. 40 m is still generous for a runner (~144 km/h).
const MAX_REASONABLE_SAMPLE_DISTANCE: Record<Environment, number> = {
  outdoors: 40,
  indoors:  15,  // indoors you're moving slowly; 15 m jump is already suspicious
  auto:     40,
};

const MODE_SETTINGS: Record<SpeedMeterMode, ModeConfig> = {
  stable: {
    label: 'Stable',
    baseKalmanQ: 0.4,
    fastKalmanQ: 1.8,
    adaptiveQDeltaMps: 1.2,
    movementSignificanceFactor: 0.45,
    maxNoiseGateMeters: 1.6,
    stillSpeedThresholdMps: 0.28,
    stopLockMinSamples: 3,
    zeroLockSpeedMps: 0.12,
  },
  balanced: {
    label: 'Balanced',
    baseKalmanQ: 0.6,
    fastKalmanQ: 2.8,
    adaptiveQDeltaMps: 0.9,
    movementSignificanceFactor: 0.4,
    maxNoiseGateMeters: 1.2,
    stillSpeedThresholdMps: 0.35,
    stopLockMinSamples: 2,
    zeroLockSpeedMps: 0.15,
  },
  responsive: {
    label: 'Responsive',
    baseKalmanQ: 1.0,
    fastKalmanQ: 4.2,
    adaptiveQDeltaMps: 0.6,
    movementSignificanceFactor: 0.32,
    maxNoiseGateMeters: 0.9,
    stillSpeedThresholdMps: 0.45,
    stopLockMinSamples: 1,
    zeroLockSpeedMps: 0.2,
  },
};

const DEFAULT_MODE: SpeedMeterMode = 'balanced';
const DEFAULT_ENVIRONMENT: Environment = 'auto';
const LAST_ANALYSIS_STORAGE_KEY = 'smartroute:last-analysis';
const TRIP_HISTORY_STORAGE_KEY = 'smartroute:trip-history';
const BEFORE_TRIP_STORAGE_KEY = 'smartroute:before-trip';

const DEFAULT_FUEL_PRICE: Record<'gasoline' | 'diesel' | 'electric', number> = {
  gasoline: 62,
  diesel: 58.5,
  electric: 10,
};

const CO2_PER_UNIT: Record<'gasoline' | 'diesel' | 'electric', number> = {
  gasoline: 2.31,
  diesel: 2.68,
  electric: 0.72,
};

const LIVE_VEHICLE_PROFILES: Record<string, VehicleLiveProfile> = {
  motorcycle: {
    key: 'motorcycle',
    label: 'Motorcycle',
    fuelType: 'gasoline',
    powertrain: 'ICE',
    massKg: 150,
    idleRateLitersPerMinute: 0.003,
    engineEfficiency: 0.28,
  },
  tricycle: {
    key: 'tricycle',
    label: 'Tricycle',
    fuelType: 'gasoline',
    powertrain: 'ICE',
    massKg: 350,
    idleRateLitersPerMinute: 0.004,
    engineEfficiency: 0.24,
  },
  sedan: {
    key: 'sedan',
    label: 'Sedan / Private Car',
    fuelType: 'gasoline',
    powertrain: 'ICE',
    massKg: 1200,
    idleRateLitersPerMinute: 0.008,
    engineEfficiency: 0.26,
  },
  van: {
    key: 'van',
    label: 'Van',
    fuelType: 'diesel',
    powertrain: 'ICE',
    massKg: 2000,
    idleRateLitersPerMinute: 0.012,
    engineEfficiency: 0.28,
  },
  bus: {
    key: 'bus',
    label: 'Bus',
    fuelType: 'diesel',
    powertrain: 'ICE',
    massKg: 8000,
    idleRateLitersPerMinute: 0.025,
    engineEfficiency: 0.36,
  },
  hybrid_car: {
    key: 'hybrid_car',
    label: 'Hybrid Car',
    fuelType: 'gasoline',
    powertrain: 'HEV',
    massKg: 1350,
    idleRateLitersPerMinute: 0.005,
    engineEfficiency: 0.38,
  },
  hybrid_van: {
    key: 'hybrid_van',
    label: 'Hybrid Van',
    fuelType: 'gasoline',
    powertrain: 'HEV',
    massKg: 2100,
    idleRateLitersPerMinute: 0.008,
    engineEfficiency: 0.36,
  },
  e_trike: {
    key: 'e_trike',
    label: 'E-Trike',
    fuelType: 'electric',
    powertrain: 'BEV',
    massKg: 400,
    idleRateLitersPerMinute: 0,
    drivetrainEfficiency: 0.88,
    regenEfficiency: 0.35,
  },
  e_motorcycle: {
    key: 'e_motorcycle',
    label: 'E-Motorcycle',
    fuelType: 'electric',
    powertrain: 'BEV',
    massKg: 170,
    idleRateLitersPerMinute: 0,
    drivetrainEfficiency: 0.9,
    regenEfficiency: 0.3,
  },
};

// ─── Utilities ─────────────────────────────────────────────────────────────────

function haversineDistanceMeters(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(end.lat - start.lat);
  const dLng = toRad(end.lng - start.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toFiniteNonNegative(value: number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function energyDensityKwhPerLiter(fuelType: 'gasoline' | 'diesel' | 'electric') {
  if (fuelType === 'diesel') {
    return 10.7;
  }

  return 8.9;
}

function pickVehicleProfile(vehicleType: string, fuelType: string): VehicleLiveProfile {
  const normalizedVehicleType = String(vehicleType || 'sedan')
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, '_');
  const fallback = LIVE_VEHICLE_PROFILES.sedan;
  const base = LIVE_VEHICLE_PROFILES[normalizedVehicleType] || fallback;
  const normalizedFuelType = String(fuelType || base.fuelType).toLowerCase();
  const safeFuelType =
    normalizedFuelType === 'diesel'
      ? 'diesel'
      : normalizedFuelType === 'electric'
        ? 'electric'
        : 'gasoline';

  return {
    ...base,
    fuelType: safeFuelType,
  };
}

function safeAccuracyPercent(predicted: number, actual: number) {
  if (!Number.isFinite(predicted) || predicted <= 0 || !Number.isFinite(actual)) {
    return null;
  }

  return Math.max(0, Math.round((1 - Math.abs(actual - predicted) / predicted) * 100));
}

function readPredictedSummary(): PredictedTripSummary | null {
  try {
    const raw = window.localStorage.getItem(LAST_ANALYSIS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const analysis = parsed?.analysis;
    const routes = Array.isArray(analysis?.routes) ? analysis.routes : [];
    const recommended = routes.find((route: any) => route?.isRecommended) || routes[0];

    if (!recommended) {
      return null;
    }

    const fuelType = String(analysis?.request?.fuelType || 'gasoline').toLowerCase();
    const unitLabel = fuelType === 'electric' ? 'kWh' : 'L';

    return {
      routeLabel: String(recommended?.label || 'Predicted route'),
      predictedDurationMinutes: Number(recommended?.durationMinutes || 0),
      predictedDistanceKm: Number(recommended?.distanceKm || 0),
      predictedFuelOrEnergy:
        fuelType === 'electric'
          ? Number(recommended?.totalEnergyKwh || 0)
          : Number(recommended?.totalFuelLiters || 0),
      predictedCostPhp: Number(recommended?.estimatedCostPhp || 0),
      predictedCo2Kg: Number(recommended?.co2Kg || 0),
      unitLabel,
    };
  } catch {
    return null;
  }
}

function readBeforeTripData(): {
  prediction: PredictedTripSummary;
  vehicleType: string;
  fuelType: 'gasoline' | 'diesel' | 'electric';
  fuelPrice: number;
  origin: string;
  destination: string;
  routeDescription: string;
} | null {
  try {
    const raw = window.localStorage.getItem(BEFORE_TRIP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.prediction) return null;
    // Consume the key so a future direct visit does not reuse stale data
    window.localStorage.removeItem(BEFORE_TRIP_STORAGE_KEY);
    const ft = String(parsed.fuelType || 'gasoline').toLowerCase();
    return {
      prediction: parsed.prediction as PredictedTripSummary,
      vehicleType: String(parsed.vehicleType || 'sedan'),
      fuelType: ft === 'diesel' ? 'diesel' : ft === 'electric' ? 'electric' : 'gasoline',
      fuelPrice: Number(parsed.fuelPrice) || 62,
      origin: String(parsed.origin || ''),
      destination: String(parsed.destination || ''),
      routeDescription: String(parsed.routeDescription || ''),
    };
  } catch {
    return null;
  }
}

/**
 * 1-D Kalman filter update step.
 * Blends the previous estimate with a new noisy measurement.
 * Higher processNoise = trust the new measurement more.
 * Higher KALMAN_R = trust the measurement less (more smoothing).
 */
function kalmanUpdate(
  state: KalmanState,
  measurement: number,
  processNoise: number,
): KalmanState {
  const predicted = state.errorCovariance + processNoise;
  const gain = predicted / (predicted + KALMAN_R);
  return {
    estimate: state.estimate + gain * (measurement - state.estimate),
    errorCovariance: (1 - gain) * predicted,
  };
}

function getSignalQuality(accuracyMeters: number | null): SignalQuality {
  if (accuracyMeters == null || accuracyMeters <= 0) return 'none';
  if (accuracyMeters <= 10) return 'good';
  if (accuracyMeters <= 25) return 'ok';
  return 'poor';
}

function formatDuration(totalSeconds: number) {
  const n = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return [h, m, s].map((v, i) => (i === 0 ? String(v) : String(v).padStart(2, '0'))).join(':');
}

function formatPaceMinutesPerKm(speedMps: number) {
  if (!Number.isFinite(speedMps) || speedMps <= 0.2) return '--';
  const totalSeconds = 1000 / speedMps;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.round(totalSeconds % 60);
  if (seconds === 60) { minutes += 1; seconds = 0; }
  return `${minutes}:${String(seconds).padStart(2, '0')} min/km`;
}

function buildCsvContent(samples: SpeedSample[]) {
  const headers = [
    'timestamp_iso', 'elapsed_seconds', 'latitude', 'longitude',
    'accuracy_meters', 'position_reliable', 'speed_source',
    'instant_speed_mps', 'instant_speed_kph',
    'raw_gps_speed_mps', 'computed_speed_mps',
    'kalman_speed_mps', 'kalman_speed_kph',
    'analysis_mode', 'environment',
    'distance_delta_meters', 'cumulative_distance_meters',
  ];
  const lines = samples.map((s) => [
    s.timestampIso, s.elapsedSeconds.toFixed(2),
    s.latitude.toFixed(7), s.longitude.toFixed(7),
    s.accuracyMeters.toFixed(2), s.positionReliable ? '1' : '0', s.speedSource,
    s.instantSpeedMps.toFixed(4), (s.instantSpeedMps * 3.6).toFixed(4),
    s.rawSpeedMps.toFixed(4), s.computedSpeedMps.toFixed(4),
    s.kalmanSpeedMps.toFixed(4), (s.kalmanSpeedMps * 3.6).toFixed(4),
    s.analysisMode, s.environment,
    s.distanceDeltaMeters.toFixed(3), s.cumulativeDistanceMeters.toFixed(3),
  ]);
  return [headers.join(','), ...lines.map((l) => l.join(','))].join('\n');
}

function triggerDownload(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SpeedMeterPrototypePage() {
  const { token, user } = useAuth();
  const isResearchRole = user?.role === 'admin' || user?.role === 'researcher';
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

  const watchIdRef = useRef<number | null>(null);
  const sessionStartMsRef = useRef<number | null>(null);
  const elapsedOffsetSecondsRef = useRef(0);
  const lastPointRef = useRef<LastPoint | null>(null);
  const lastCallbackMsRef = useRef<number | null>(null);
  const resumeGuardRemainingRef = useRef(0);
  const resumeSpikeFilterUntilMsRef = useRef(0);
  const kalmanRef = useRef<KalmanState>({ estimate: 0, errorCovariance: 1 });
  const totalDistanceMetersRef = useRef(0);
  const maxSpeedMpsRef = useRef(0);
  const skippedRef = useRef(0);
  const stopConfidenceRef = useRef(0);
  const runningFuelOrEnergyRef = useRef(0);
  const runningCostPhpRef = useRef(0);
  const lastSmoothedSpeedRef = useRef(0);
  const beforeTripFuelPriceRef = useRef<number | null>(null);
  const beforeTripFuelTypeRef = useRef<string | null>(null);

  const [isTracking, setIsTracking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Tap Start to begin live speed sampling.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [instantSpeedMps, setInstantSpeedMps] = useState(0);
  const [currentSpeedMps, setCurrentSpeedMps] = useState(0);
  const [averageSpeedMps, setAverageSpeedMps] = useState(0);
  const [maxSpeedMps, setMaxSpeedMps] = useState(0);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState(0);
  const [latestAccuracyMeters, setLatestAccuracyMeters] = useState<number | null>(null);
  const [skippedSamples, setSkippedSamples] = useState(0);
  const [samples, setSamples] = useState<SpeedSample[]>([]);
  const [vehicleType, setVehicleType] = useState('sedan');
  const [fuelType, setFuelType] = useState<'gasoline' | 'diesel' | 'electric'>('gasoline');
  const [fuelPrice, setFuelPrice] = useState('62.00');
  const [liveVspKwPerTon, setLiveVspKwPerTon] = useState(0);
  const [liveFuelOrEnergyPerKm, setLiveFuelOrEnergyPerKm] = useState(0);
  const [liveCostPerKm, setLiveCostPerKm] = useState(0);
  const [runningFuelOrEnergy, setRunningFuelOrEnergy] = useState(0);
  const [runningCostPhp, setRunningCostPhp] = useState(0);
  const [predictedSummary, setPredictedSummary] = useState<PredictedTripSummary | null>(null);
  const [tripOrigin, setTripOrigin] = useState('');
  const [tripDestination, setTripDestination] = useState('');
  const [tripRouteDescription, setTripRouteDescription] = useState('');
  const [completedTrip, setCompletedTrip] = useState<CompletedTripRecord | null>(null);
  const [syncStatus, setSyncStatus] = useState('Not synced');

  const modeRef = useRef<SpeedMeterMode>(DEFAULT_MODE);
  const modeConfigRef = useRef<ModeConfig>(MODE_SETTINGS[DEFAULT_MODE]);
  const environmentRef = useRef<Environment>(DEFAULT_ENVIRONMENT);

  const navigate = useNavigate();

  useEffect(() => {
    const beforeTrip = readBeforeTripData();
    if (beforeTrip) {
      setPredictedSummary(beforeTrip.prediction);
      setTripOrigin(beforeTrip.origin);
      setTripDestination(beforeTrip.destination);
      setTripRouteDescription(beforeTrip.routeDescription);
      // Store fuel type and price before setting vehicleType so the vehicleType effect can consume them
      beforeTripFuelTypeRef.current = beforeTrip.fuelType;
      beforeTripFuelPriceRef.current = beforeTrip.fuelPrice;
      setVehicleType(beforeTrip.vehicleType);
    } else {
      setPredictedSummary(readPredictedSummary());
    }
  }, []);

  useEffect(() => {
    const overrideFuelType = beforeTripFuelTypeRef.current;
    beforeTripFuelTypeRef.current = null;
    const profile = pickVehicleProfile(vehicleType, overrideFuelType || fuelType);
    setFuelType(profile.fuelType);
    if (beforeTripFuelPriceRef.current !== null) {
      setFuelPrice(beforeTripFuelPriceRef.current.toFixed(2));
      beforeTripFuelPriceRef.current = null;
    } else {
      const defaultPrice = DEFAULT_FUEL_PRICE[profile.fuelType];
      setFuelPrice(defaultPrice.toFixed(2));
    }
  }, [vehicleType]);

  const stopWatcher = () => {
    if (watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  };

  const readElapsedSeconds = (nowMs: number) => {
    const active = sessionStartMsRef.current ? (nowMs - sessionStartMsRef.current) / 1000 : 0;
    return Math.max(0, elapsedOffsetSecondsRef.current + active);
  };

  const pauseTracking = () => {
    if (!isTracking) return;
    const elapsed = readElapsedSeconds(Date.now());
    elapsedOffsetSecondsRef.current = elapsed;
    sessionStartMsRef.current = null;
    stopWatcher();
    setElapsedSeconds(elapsed);
    setIsTracking(false);
    setIsStarting(false);
    setStatusMessage('Paused. Resume to continue the same session.');
  };

  const startTracking = () => {
    if (isTracking || isStarting) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Geolocation is not supported in this browser.');
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);
    setStatusMessage('Live. GPS warming up for the first few seconds...');
    lastCallbackMsRef.current = null;
    resumeGuardRemainingRef.current = 0;
    resumeSpikeFilterUntilMsRef.current = 0;
    sessionStartMsRef.current = Date.now();

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nowMs = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        const accuracyMeters = toFiniteNonNegative(position.coords.accuracy);
        const altitudeMeters = Number.isFinite(Number(position.coords.altitude))
          ? Number(position.coords.altitude)
          : null;
        const rawSpeedMps = Number(position.coords.speed);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const previousCallbackMs = lastCallbackMsRef.current;
        if (previousCallbackMs != null) {
          const callbackGapSec = Math.max(0, (nowMs - previousCallbackMs) / 1000);
          if (callbackGapSec >= RESUME_GAP_REACQUIRE_SECONDS) {
            // Device sleep/app background/restart can cause GPS reacquisition spikes.
            resumeGuardRemainingRef.current = REACQUIRE_SKIP_SAMPLES;
            resumeSpikeFilterUntilMsRef.current = nowMs + RESUME_SPIKE_FILTER_SECONDS * 1000;
            kalmanRef.current = { estimate: 0, errorCovariance: 1 };
            stopConfidenceRef.current = 0;
            setStatusMessage('GPS resumed after sleep/restart. Stabilizing signal...');
          }
        }
        lastCallbackMsRef.current = nowMs;

        // Always update the badge so the user sees signal quality live.
        setLatestAccuracyMeters(accuracyMeters);

        if (resumeGuardRemainingRef.current > 0) {
          resumeGuardRemainingRef.current -= 1;
          skippedRef.current += 1;
          setSkippedSamples(skippedRef.current);
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters, altitudeMeters };
          setStatusMessage('GPS resumed. Waiting for stable samples...');
          return;
        }

        const env = environmentRef.current;
        const accuracyThreshold = ACCURACY_THRESHOLD[env];
        const positionReliable = accuracyMeters <= accuracyThreshold;

        // Sanitise the raw GPS speed from the chipset.
        const speedMps = Number.isFinite(rawSpeedMps) && rawSpeedMps >= 0 ? rawSpeedMps : 0;

        // FIX 2: Hard-reject physically impossible readings BEFORE Kalman sees them.
        // A single 80 km/h multipath blip still pulled the Kalman estimate up even
        // with smoothing — rejecting it outright is cleaner.
        if (speedMps > MAX_EXPECTED_SPEED_MPS) {
          skippedRef.current += 1;
          setSkippedSamples(skippedRef.current);
          // Still advance the anchor so delta-time stays correct.
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters, altitudeMeters };
          return;
        }

        const prev = lastPointRef.current;
        if (!prev) {
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters, altitudeMeters };
          setStatusMessage('Live. GPS warming up...');
          return;
        }

        // FIX: was 0.5 s — iOS fires watchPosition faster during warmup, which
        // silently dropped early samples and made the display appear frozen.
        const deltaTimeSec = (nowMs - prev.timestampMs) / 1000;
        if (deltaTimeSec < MIN_DELTA_TIME_SECONDS) return;

        const rawDistanceMeters = haversineDistanceMeters({ lat: prev.lat, lng: prev.lng }, { lat, lng });
        if (!Number.isFinite(rawDistanceMeters)) {
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters, altitudeMeters };
          return;
        }

        // FIX 4: Per-environment distance gate — was 120 m (≈ 432 km/h at 1 s),
        // now tighter: 40 m outdoors, 15 m indoors.
        const maxDist = MAX_REASONABLE_SAMPLE_DISTANCE[env];
        if (rawDistanceMeters > maxDist) {
          skippedRef.current += 1;
          setSkippedSamples(skippedRef.current);
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters, altitudeMeters };
          return;
        }

        const computedSpeedMps = rawDistanceMeters / deltaTimeSec;

        // Extra wake-up protection: during a short post-resume window,
        // reject high Doppler speed if position-delta speed stays near-zero.
        const inResumeSpikeFilterWindow = nowMs < resumeSpikeFilterUntilMsRef.current;
        const wakeSpikeLikely =
          inResumeSpikeFilterWindow &&
          speedMps >= RESUME_SPIKE_MIN_SPEED_MPS &&
          computedSpeedMps <= RESUME_SPIKE_MAX_COMPUTED_MPS &&
          accuracyMeters >= accuracyThreshold * RESUME_SPIKE_MIN_ACCURACY_FACTOR;

        if (wakeSpikeLikely) {
          skippedRef.current += 1;
          setSkippedSamples(skippedRef.current);
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters, altitudeMeters };
          setStatusMessage('Filtering wake-up GPS spike...');
          return;
        }

        const distanceDeltaMeters = rawDistanceMeters;
        const fuelPriceNumber = Number.parseFloat(fuelPrice) || DEFAULT_FUEL_PRICE[fuelType];
        const profile = pickVehicleProfile(vehicleType, fuelType);

        // FIX 3: Accuracy-weighted Kalman process noise.
        // Near buildings / indoors, accuracy degrades but old code kept Q the same,
        // so noisy readings were trusted as much as clean ones. Now we scale the
        // process noise UP when accuracy is poor — meaning the filter leans harder
        // on its own prediction (more smoothing) when GPS is unreliable.
        const prevEstimate = kalmanRef.current.estimate;
        const measurementDelta = Math.abs(speedMps - prevEstimate);
        const modeConfig = modeConfigRef.current;

        // accuracyPenalty: 1.0 when GPS is perfect, up to 3× when very noisy.
        // Dividing by threshold keeps it relative to what "acceptable" is for the
        // current environment — indoors threshold is higher, so the penalty stays
        // proportional even though indoors accuracy is inherently worse.
        const accuracyPenalty = clamp(accuracyMeters / accuracyThreshold, 1, 3);

        let processNoise =
          measurementDelta >= modeConfig.adaptiveQDeltaMps
            ? modeConfig.fastKalmanQ
            : modeConfig.baseKalmanQ;

        // When GPS is noisy, raise R (trust measurement less) by scaling Q down.
        // Lower Q relative to R means Kalman gain falls → filter ignores the noisy
        // measurement more and sticks closer to its prediction.
        processNoise = processNoise / accuracyPenalty;

        kalmanRef.current = kalmanUpdate(kalmanRef.current, speedMps, processNoise);
        let smoothedSpeedMps = Math.max(0, kalmanRef.current.estimate);
        const previousSmoothedSpeedMps = lastSmoothedSpeedRef.current;
        const accelerationMps2 = (smoothedSpeedMps - previousSmoothedSpeedMps) / Math.max(deltaTimeSec, 0.1);

        let grade = 0;
        if (
          Number.isFinite(altitudeMeters) &&
          Number.isFinite(prev.altitudeMeters) &&
          distanceDeltaMeters >= 2
        ) {
          grade = clamp((Number(altitudeMeters) - Number(prev.altitudeMeters)) / distanceDeltaMeters, -0.2, 0.2);
        }

        const vspKwPerTon =
          smoothedSpeedMps * (1.1 * accelerationMps2 + 9.81 * grade + 0.132) +
          0.000302 * smoothedSpeedMps ** 3;
        const massTons = profile.massKg / 1000;
        const wheelPowerKw = Math.max(0, vspKwPerTon * massTons);
        const distanceKm = distanceDeltaMeters / 1000;
        let segmentUnits = 0;

        if (profile.powertrain === 'BEV') {
          const drivetrainEfficiency = Math.max(0.2, profile.drivetrainEfficiency || 0.9);
          const regenEfficiency = Math.max(0, profile.regenEfficiency || 0.3);
          const positiveEnergyKwh = (wheelPowerKw * deltaTimeSec) / 3600 / drivetrainEfficiency;
          const negativePowerKw = Math.min(0, vspKwPerTon * massTons);
          const recoveredEnergyKwh = Math.abs(negativePowerKw) * (deltaTimeSec / 3600) * regenEfficiency;
          const idleEnergyKwh = smoothedSpeedMps <= 0.5 ? (deltaTimeSec / 3600) * 0.6 : 0;
          segmentUnits = Math.max(0, positiveEnergyKwh - recoveredEnergyKwh) + idleEnergyKwh;
        } else {
          const engineEfficiency = Math.max(0.12, profile.engineEfficiency || 0.26);
          const movingFuelEnergyKwh = (wheelPowerKw * deltaTimeSec) / 3600 / engineEfficiency;
          const movingFuelLiters = movingFuelEnergyKwh / energyDensityKwhPerLiter(profile.fuelType);
          const idleFuelLiters = smoothedSpeedMps <= 0.5 ? profile.idleRateLitersPerMinute * (deltaTimeSec / 60) : 0;
          segmentUnits = Math.max(0, movingFuelLiters) + Math.max(0, idleFuelLiters);
        }

        const segmentFuelOrEnergyPerKm = distanceKm > 0.001 ? segmentUnits / distanceKm : 0;
        const segmentCostPerKm = segmentFuelOrEnergyPerKm * fuelPriceNumber;

        runningFuelOrEnergyRef.current += Math.max(0, segmentUnits);
        runningCostPhpRef.current = runningFuelOrEnergyRef.current * fuelPriceNumber;

        // Snap to zero after a short hold of near-zero speed + small movement.
        const nearStillBySpeed = speedMps <= modeConfig.stillSpeedThresholdMps;
        const nearStillByDistance = rawDistanceMeters <= modeConfig.maxNoiseGateMeters * 0.5;

        if (nearStillBySpeed && nearStillByDistance) {
          stopConfidenceRef.current += 1;
        } else {
          stopConfidenceRef.current = 0;
        }

        if (stopConfidenceRef.current >= modeConfig.stopLockMinSamples) {
          smoothedSpeedMps = 0;
          kalmanRef.current = { ...kalmanRef.current, estimate: 0 };
        }

        // FIX: Only accumulate distance when we're not locked to zero — GPS jitter
        // while stationary was inflating total distance and skewing average speed.
        if (smoothedSpeedMps > 0) {
          totalDistanceMetersRef.current += distanceDeltaMeters;
        }

        maxSpeedMpsRef.current = Math.max(maxSpeedMpsRef.current, smoothedSpeedMps);

        const elapsedSec = readElapsedSeconds(nowMs);
        const avgMps = elapsedSec > 0 ? totalDistanceMetersRef.current / elapsedSec : 0;

        const sample: SpeedSample = {
          id: `${nowMs}-${Math.random().toString(16).slice(2)}`,
          timestampIso: new Date(nowMs).toISOString(),
          elapsedSeconds: elapsedSec,
          latitude: lat, longitude: lng,
          accuracyMeters, positionReliable,
          speedSource: speedMps > 0 ? 'gps_doppler' : 'zero',
          instantSpeedMps: speedMps,
          // FIX: store the actual raw value from the chip, not the sanitised speedMps
          rawSpeedMps: Number.isFinite(rawSpeedMps) ? rawSpeedMps : -1,
          computedSpeedMps, // position-delta for reference
          kalmanSpeedMps: smoothedSpeedMps,
          analysisMode: modeRef.current,
          environment: env,
          distanceDeltaMeters,
          cumulativeDistanceMeters: totalDistanceMetersRef.current,
          altitudeMeters,
          accelerationMps2,
          grade,
          vspKwPerTon,
          segmentFuelOrEnergyPerKm,
          segmentCostPerKm,
          runningFuelOrEnergy: runningFuelOrEnergyRef.current,
          runningCostPhp: runningCostPhpRef.current,
        };

        setElapsedSeconds(elapsedSec);
        setInstantSpeedMps(speedMps);
        setTotalDistanceMeters(totalDistanceMetersRef.current);
        setCurrentSpeedMps(smoothedSpeedMps);
        setAverageSpeedMps(avgMps);
        setMaxSpeedMps(maxSpeedMpsRef.current);
        setLiveVspKwPerTon(vspKwPerTon);
        setLiveFuelOrEnergyPerKm(segmentFuelOrEnergyPerKm);
        setLiveCostPerKm(segmentCostPerKm);
        setRunningFuelOrEnergy(runningFuelOrEnergyRef.current);
        setRunningCostPhp(runningCostPhpRef.current);
        setSamples((prev) => [...prev, sample]);
        setStatusMessage('Live. Tracking speed samples.');
        lastSmoothedSpeedRef.current = smoothedSpeedMps;

        lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters, altitudeMeters };
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage('PERMISSION_DENIED');
          pauseTracking();
          return;
        }
        if (error.code === error.TIMEOUT) {
          setStatusMessage('Waiting for GPS fix – go outdoors or near a window.');
          return;
        }
        setStatusMessage('Location temporarily unavailable. Try an open outdoor area.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );

    watchIdRef.current = watchId;
    setIsTracking(true);
    setIsStarting(false);
  };

  const resetSession = () => {
    stopWatcher();
    setIsTracking(false);
    setStatusMessage('Session reset. Tap Start to begin a fresh sample run.');
    setErrorMessage(null);
    sessionStartMsRef.current = null;
    elapsedOffsetSecondsRef.current = 0;
    lastPointRef.current = null;
    lastCallbackMsRef.current = null;
    resumeGuardRemainingRef.current = 0;
    resumeSpikeFilterUntilMsRef.current = 0;
    kalmanRef.current = { estimate: 0, errorCovariance: 1 };
    totalDistanceMetersRef.current = 0;
    maxSpeedMpsRef.current = 0;
    skippedRef.current = 0;
    stopConfidenceRef.current = 0;
    lastSmoothedSpeedRef.current = 0;
    runningFuelOrEnergyRef.current = 0;
    runningCostPhpRef.current = 0;
    setIsStarting(false);
    setElapsedSeconds(0); setInstantSpeedMps(0); setCurrentSpeedMps(0); setAverageSpeedMps(0);
    setMaxSpeedMps(0); setTotalDistanceMeters(0);
    setLiveVspKwPerTon(0); setLiveFuelOrEnergyPerKm(0); setLiveCostPerKm(0);
    setRunningFuelOrEnergy(0); setRunningCostPhp(0);
    setLatestAccuracyMeters(null); setSkippedSamples(0); setSamples([]);
  };

  useEffect(() => {
    if (!isTracking) return;
    const id = window.setInterval(() => setElapsedSeconds(readElapsedSeconds(Date.now())), 1000);
    return () => window.clearInterval(id);
  }, [isTracking]);

  useEffect(() => () => stopWatcher(), []);

  const instantSpeedKph = useMemo(() => instantSpeedMps * 3.6, [instantSpeedMps]);
  const currentSpeedKph = useMemo(() => currentSpeedMps * 3.6, [currentSpeedMps]);
  const averageSpeedKph = useMemo(() => averageSpeedMps * 3.6, [averageSpeedMps]);
  const maxSpeedKph = useMemo(() => maxSpeedMps * 3.6, [maxSpeedMps]);
  const currentPaceText = useMemo(() => formatPaceMinutesPerKm(currentSpeedMps), [currentSpeedMps]);
  const latestAccuracyText = useMemo(() => formatLocationAccuracy(latestAccuracyMeters), [latestAccuracyMeters]);
  const signalQuality = useMemo(() => getSignalQuality(latestAccuracyMeters), [latestAccuracyMeters]);
  const profile = useMemo(() => pickVehicleProfile(vehicleType, fuelType), [vehicleType, fuelType]);
  const unitLabel = profile.fuelType === 'electric' ? 'kWh' : 'L';
  const liveBand =
    liveVspKwPerTon < 4 ? 'eco' : liveVspKwPerTon < 10 ? 'moderate' : 'waste';

  const exportCsv = () => {
    if (samples.length === 0) { setStatusMessage('No samples yet. Start tracking first.'); return; }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    triggerDownload(`speedmeter-${ts}.csv`, buildCsvContent(samples), 'text/csv;charset=utf-8');
    setStatusMessage('CSV downloaded.');
  };

  const finalizeTrip = async () => {
    if (samples.length === 0) {
      setStatusMessage('No samples yet. Track first before ending the trip.');
      return;
    }

    const pricePerUnit = Number.parseFloat(fuelPrice) || DEFAULT_FUEL_PRICE[fuelType];
    const durationMinutes = elapsedSeconds / 60;
    const distanceKm = totalDistanceMeters / 1000;
    const fuelOrEnergy = runningFuelOrEnergyRef.current;
    const costPhp = fuelOrEnergy * pricePerUnit;
    const co2Kg = fuelOrEnergy * CO2_PER_UNIT[fuelType];

    const completed: CompletedTripRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      finishedAt: new Date().toISOString(),
      vehicleType,
      fuelType,
      fuelPrice: pricePerUnit,
      predicted: predictedSummary,
      actual: {
        durationMinutes,
        distanceKm,
        fuelOrEnergy,
        costPhp,
        co2Kg,
      },
      accuracy: {
        timePct: predictedSummary
          ? safeAccuracyPercent(predictedSummary.predictedDurationMinutes, durationMinutes)
          : null,
        fuelPct: predictedSummary
          ? safeAccuracyPercent(predictedSummary.predictedFuelOrEnergy, fuelOrEnergy)
          : null,
        costPct: predictedSummary
          ? safeAccuracyPercent(predictedSummary.predictedCostPhp, costPhp)
          : null,
      },
      synced: false,
    };

    setCompletedTrip(completed);

    const existing = JSON.parse(window.localStorage.getItem(TRIP_HISTORY_STORAGE_KEY) || '[]');
    const history = Array.isArray(existing) ? existing : [];
    history.unshift(completed);
    window.localStorage.setItem(TRIP_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 120)));

    setSyncStatus('Saved locally. Syncing...');
    try {
      const response = await fetch(`${API_URL}/api/routes/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(completed),
      });

      if (!response.ok) {
        throw new Error('Sync endpoint unavailable');
      }

      const syncedRecord = {
        ...completed,
        synced: true,
      };
      setCompletedTrip(syncedRecord);
      const refreshed = JSON.parse(window.localStorage.getItem(TRIP_HISTORY_STORAGE_KEY) || '[]');
      const refreshedHistory = Array.isArray(refreshed) ? refreshed : [];
      const updatedHistory = refreshedHistory.map((item: CompletedTripRecord) =>
        item.id === syncedRecord.id ? syncedRecord : item
      );
      window.localStorage.setItem(TRIP_HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      setSyncStatus('Synced to server');
    } catch {
      setSyncStatus('Offline/local only. Will sync later.');
    }
  };

  const latestRows = useMemo(() => samples.slice(-10).reverse(), [samples]);

  const signalColor = {
    good: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    ok: 'text-amber-700 bg-amber-50 border-amber-200',
    poor: 'text-red-700 bg-red-50 border-red-200',
    none: 'text-slate-500 bg-slate-50 border-slate-200',
  }[signalQuality];

  const signalLabel = { good: 'GPS Good', ok: 'GPS OK', poor: 'GPS Weak', none: 'No GPS' }[signalQuality];

  const SignalIcon =
    signalQuality === 'good' ? CheckCircle2 :
    signalQuality === 'ok' ? Wifi :
    signalQuality === 'poor' ? AlertTriangle : WifiOff;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex">
      <div className="flex-1 overflow-auto py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Header + metrics ────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                <Gauge className="h-4 w-4" />
                Live VSP Meter
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                SmartRoute Speed Meter
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600 md:text-base">
                Live GPS speed and Vehicle Specific Power with running fuel burn, cost per km,
                and trip total cost. End each trip to compare predicted vs actual accuracy.
              </p>
            </div>

            {/* Live GPS signal quality badge */}
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${signalColor}`}>
              <SignalIcon className="h-3.5 w-3.5" />
              {signalLabel}{latestAccuracyText ? ` · ${latestAccuracyText}` : ''}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {isResearchRole ? (
              <>
                <select
                  value={vehicleType}
                  onChange={(event) => setVehicleType(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="motorcycle">Motorcycle (ICE)</option>
                  <option value="tricycle">Tricycle (ICE)</option>
                  <option value="sedan">Sedan / Private Car (ICE)</option>
                  <option value="van">Van (ICE)</option>
                  <option value="bus">Bus (ICE)</option>
                  <option value="hybrid_car">Hybrid Car (HEV)</option>
                  <option value="hybrid_van">Hybrid Van (HEV)</option>
                  <option value="e_trike">E-Trike (BEV)</option>
                  <option value="e_motorcycle">E-Motorcycle (BEV)</option>
                </select>
                <select
                  value={fuelType}
                  onChange={(event) => setFuelType(event.target.value as 'gasoline' | 'diesel' | 'electric')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="gasoline">Gasoline</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={fuelPrice}
                  onChange={(event) => setFuelPrice(event.target.value)}
                  className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  title={`Price per ${unitLabel}`}
                />
              </>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <Fuel className="h-4 w-4 text-slate-400" />
                {profile.label} · {fuelType.charAt(0).toUpperCase() + fuelType.slice(1)} · ₱{fuelPrice}/{unitLabel}
              </span>
            )}
            <button
              type="button"
              onClick={isTracking ? pauseTracking : startTracking}
              disabled={isStarting}
              className={`inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition ${isStarting ? 'cursor-wait opacity-70' : 'hover:from-teal-700 hover:to-blue-700'}`}
            >
              {isTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isTracking ? 'Pause Tracking' : isStarting ? 'Starting...' : 'Start Tracking'}
            </button>
            <button
              type="button"
              onClick={finalizeTrip}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <CheckCircle2 className="h-4 w-4" />
              End Trip & Compare
            </button>
            <button
              type="button"
              onClick={resetSession}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Session
            </button>
            {isResearchRole && (
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-medium text-slate-900">
              {isTracking ? 'Tracking is active' : 'Tracking is not active'}
            </div>
            <div className="mt-1">{statusMessage}</div>
            {errorMessage === 'PERMISSION_DENIED' ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                <p className="font-semibold mb-2">📍 Location permission is blocked</p>
                <p className="mb-3 text-red-700">Your browser remembered the block — it won&apos;t ask again automatically. Follow these steps to re-enable it:</p>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-red-800">Android (Chrome)</p>
                    <ol className="mt-1 ml-4 list-decimal space-y-1 text-red-700">
                      <li>Tap the <strong>lock icon</strong> or info icon in the address bar</li>
                      <li>Tap <strong>Permissions → Location</strong></li>
                      <li>Switch it to <strong>Allow</strong></li>
                      <li>Reload this page</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-semibold text-red-800">iPhone / iPad (Safari)</p>
                    <ol className="mt-1 ml-4 list-decimal space-y-1 text-red-700">
                      <li>Open <strong>Settings → Safari → Location</strong></li>
                      <li>Set it to <strong>Ask</strong> or <strong>Allow</strong></li>
                      <li>Or: Settings → Privacy &amp; Security → Location Services → Safari → <strong>While Using the App</strong></li>
                      <li>Reload this page</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-semibold text-red-800">iPhone / iPad (Chrome)</p>
                    <ol className="mt-1 ml-4 list-decimal space-y-1 text-red-700">
                      <li>Open <strong>Settings → Chrome → Location</strong></li>
                      <li>Set to <strong>While Using the App</strong></li>
                      <li>Reload this page</li>
                    </ol>
                  </div>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                >
                  Reload page
                </button>
              </div>
            ) : errorMessage ? (
              <div className="mt-2 text-red-600">{errorMessage}</div>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span className="font-semibold">Accuracy tip: </span>
            Wait a few seconds after pressing Start so GPS can stabilize, and test in open-sky areas when possible.
            The tracker automatically applies filtering in the background while recording live samples.
            {skippedSamples > 0 && (
              <span className="ml-1 font-semibold text-amber-900">
                ({skippedSamples} sample{skippedSamples !== 1 ? 's' : ''} rejected so far.)
              </span>
            )}
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr,1fr]">
            <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,_rgba(13,148,136,0.08),_rgba(59,130,246,0.08)_60%,_rgba(248,250,252,0.95))] p-6">
              <div className="inline-flex items-center gap-2 rounded-md bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                <Activity className="h-4 w-4" />
                Instant vs Smoothed
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Instant (Raw)
                  </div>
                  <div className="mt-1 flex items-end gap-1">
                    <div className="text-3xl font-bold tracking-tight text-slate-900">{instantSpeedKph.toFixed(2)}</div>
                    <div className="pb-1 text-sm font-semibold text-slate-700">km/h</div>
                  </div>
                  <div className="text-xs text-slate-600">{instantSpeedMps.toFixed(3)} m/s</div>
                </div>

                <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
                    Smoothed (Analysis)
                  </div>
                  <div className="mt-1 flex items-end gap-1">
                    <div className="text-3xl font-bold tracking-tight text-slate-900">{currentSpeedKph.toFixed(2)}</div>
                    <div className="pb-1 text-sm font-semibold text-slate-700">km/h</div>
                  </div>
                  <div className="text-xs text-slate-600">{currentSpeedMps.toFixed(3)} m/s · Pace {currentPaceText}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={<Timer className="h-4 w-4" />} label="Elapsed" value={formatDuration(elapsedSeconds)} />
              <MetricCard icon={<LocateFixed className="h-4 w-4" />} label="Accuracy" value={latestAccuracyText || '--'} />
              <MetricCard icon={<Activity className="h-4 w-4" />} label="Average" value={`${averageSpeedKph.toFixed(2)} km/h`} />
              <MetricCard icon={<Gauge className="h-4 w-4" />} label="Max" value={`${maxSpeedKph.toFixed(2)} km/h`} />
              <MetricCard icon={<Activity className="h-4 w-4" />} label="Distance" value={`${(totalDistanceMeters / 1000).toFixed(2)} km`} />
              <MetricCard icon={<Download className="h-4 w-4" />} label="OK / Skipped" value={`${samples.length} / ${skippedSamples}`} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Live VSP</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{liveVspKwPerTon.toFixed(2)}</div>
              <div className="text-xs text-slate-600">kW/ton</div>
              <div className="mt-3 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full ${
                    liveBand === 'eco' ? 'bg-emerald-500' : liveBand === 'moderate' ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (liveVspKwPerTon / 18) * 100))}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {liveBand === 'eco' ? 'Eco Zone (0-4)' : liveBand === 'moderate' ? 'Moderate Zone (4-10)' : 'Wasting Zone (10+)'}
              </div>
            </div>

            <MetricCard
              icon={<Fuel className="h-4 w-4" />}
              label={profile.fuelType === 'electric' ? 'Energy / km' : 'Fuel Burn / km'}
              value={`${liveFuelOrEnergyPerKm.toFixed(3)} ${unitLabel}/km`}
            />
            <MetricCard
              icon={<Download className="h-4 w-4" />}
              label="Cost / km"
              value={`₱${liveCostPerKm.toFixed(2)}/km`}
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              label={profile.fuelType === 'electric' ? 'Running Energy' : 'Running Fuel'}
              value={`${runningFuelOrEnergy.toFixed(3)} ${unitLabel}`}
            />
            <MetricCard
              icon={<Timer className="h-4 w-4" />}
              label="Running Total Cost"
              value={`₱${runningCostPhp.toFixed(2)}`}
            />
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Before Trip Snapshot</div>
              {predictedSummary ? (
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">{predictedSummary.routeLabel}</div>
                  <div>Predicted: ₱{predictedSummary.predictedCostPhp.toFixed(2)}</div>
                  <div>
                    Predicted {predictedSummary.unitLabel}: {predictedSummary.predictedFuelOrEnergy.toFixed(2)} {predictedSummary.unitLabel}
                  </div>
                  <div>Predicted time: {predictedSummary.predictedDurationMinutes.toFixed(1)} min</div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">
                  No predicted route snapshot yet. Analyze routes first, then return here.
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* ── Route context banner ─────────────────────────────────────────────── */}
        {(tripOrigin || tripDestination) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-blue-50 px-5 py-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">
                  Active Route
                </p>
                {predictedSummary?.routeLabel && (
                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {predictedSummary.routeLabel}
                    {tripRouteDescription ? (
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        via {tripRouteDescription}
                      </span>
                    ) : null}
                  </p>
                )}
                {!predictedSummary?.routeLabel && tripRouteDescription && (
                  <p className="mt-0.5 text-base font-bold text-slate-900">{tripRouteDescription}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-teal-500" />
                  {tripOrigin || '—'}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-blue-500" />
                  {tripDestination || '—'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Latest samples table ─────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-slate-900">Latest Samples</h2>
          {isResearchRole && (
            <p className="mt-2 text-sm text-slate-600">
              Only accepted, Kalman-filtered samples appear here.{' '}
              <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">GPS</span>{' '}
              = Doppler from chipset (accurate).{' '}
              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">Zero</span>{' '}
              = no chipset speed available. CSV export has all raw columns including position-delta computed speed.
            </p>
          )}

          {latestRows.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No samples yet. Go outdoors and tap Start Tracking.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Instant km/h</th>
                    <th className="px-3 py-2">Smoothed km/h</th>
                    <th className="px-3 py-2">Smoothed m/s</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Accuracy</th>
                    <th className="px-3 py-2">Δ Dist</th>
                    <th className="px-3 py-2">Lat, Lng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {latestRows.map((sample) => (
                    <tr key={sample.id} className="text-slate-700">
                      <td className="whitespace-nowrap px-3 py-2">
                        {new Date(sample.timestampIso).toLocaleTimeString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {(sample.instantSpeedMps * 3.6).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">
                        {(sample.kalmanSpeedMps * 3.6).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{sample.kalmanSpeedMps.toFixed(3)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          sample.speedSource === 'gps_doppler' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {sample.speedSource === 'gps_doppler' ? 'GPS' : 'Zero'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={sample.positionReliable ? 'text-emerald-700' : 'text-amber-700'}>
                          {formatLocationAccuracy(sample.accuracyMeters) || '--'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{sample.distanceDeltaMeters.toFixed(2)} m</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {sample.latitude.toFixed(6)}, {sample.longitude.toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-slate-900">Before vs After Trip Comparison</h2>
          <p className="mt-2 text-sm text-slate-600">
            End a trip to compare predicted route metrics against actual live GPS + VSP totals.
          </p>

          {!completedTrip ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No completed trip yet. Start tracking, then click End Trip & Compare.
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Estimated</div>
                  {completedTrip.predicted ? (
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">{completedTrip.predicted.routeLabel}</div>
                      <div>Time: {completedTrip.predicted.predictedDurationMinutes.toFixed(1)} min</div>
                      <div>Distance: {completedTrip.predicted.predictedDistanceKm.toFixed(2)} km</div>
                      <div>
                        {completedTrip.fuelType === 'electric' ? 'Energy' : 'Fuel'}: {completedTrip.predicted.predictedFuelOrEnergy.toFixed(2)} {completedTrip.predicted.unitLabel}
                      </div>
                      <div>Cost: ₱{completedTrip.predicted.predictedCostPhp.toFixed(2)}</div>
                      <div>CO₂: {completedTrip.predicted.predictedCo2Kg.toFixed(2)} kg</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-600">No route prediction saved.</div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Actual</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <div>Time: {completedTrip.actual.durationMinutes.toFixed(1)} min</div>
                    <div>Distance: {completedTrip.actual.distanceKm.toFixed(2)} km</div>
                    <div>
                      {completedTrip.fuelType === 'electric' ? 'Energy' : 'Fuel'}: {completedTrip.actual.fuelOrEnergy.toFixed(2)} {completedTrip.fuelType === 'electric' ? 'kWh' : 'L'}
                    </div>
                    <div>Cost: ₱{completedTrip.actual.costPhp.toFixed(2)}</div>
                    <div>CO₂: {completedTrip.actual.co2Kg.toFixed(2)} kg</div>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Accuracy</div>
                  <div className="mt-2 space-y-1 text-sm text-emerald-900">
                    <div>Time: {completedTrip.accuracy.timePct ?? 'N/A'}%</div>
                    <div>Fuel/Energy: {completedTrip.accuracy.fuelPct ?? 'N/A'}%</div>
                    <div>Cost: {completedTrip.accuracy.costPct ?? 'N/A'}%</div>
                  </div>
                  {completedTrip.predicted && (() => {
                    const saved = completedTrip.predicted.predictedCostPhp - completedTrip.actual.costPhp;
                    return (
                      <div className="mt-2 text-xs font-semibold text-emerald-800">
                        {saved >= 0
                          ? `You saved ₱${saved.toFixed(2)} vs estimate ✅`
                          : `₱${Math.abs(saved).toFixed(2)} more than estimated ⚠️`
                        }
                      </div>
                    );
                  })()}
                  {(() => {
                    const pcts = [completedTrip.accuracy.timePct, completedTrip.accuracy.fuelPct, completedTrip.accuracy.costPct].filter((v): v is number => v !== null);
                    const avg = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
                    return avg !== null ? (
                      <div className="mt-1 text-xs text-emerald-700">Prediction accuracy: {avg}%</div>
                    ) : null;
                  })()}
                  <div className="mt-3 text-xs text-emerald-800">{syncStatus}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { resetSession(); navigate('/dashboard'); }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  New Route
                </button>
              </div>
            </>
          )}
        </motion.section>


      </div>
      </div>
      <AssistantPanel chatUrl={chatUrl} chatLoading={chatLoading} />
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}
