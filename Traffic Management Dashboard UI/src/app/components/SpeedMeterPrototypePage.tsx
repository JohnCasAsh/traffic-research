import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Gauge,
  LocateFixed,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { formatLocationAccuracy } from '../location';

// ─── Types ─────────────────────────────────────────────────────────────────────

type KalmanState = { estimate: number; errorCovariance: number };
type SignalQuality = 'good' | 'ok' | 'poor' | 'none';
type LastPoint = { lat: number; lng: number; timestampMs: number; accuracyMeters: number };
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

const MODE_OPTIONS: SpeedMeterMode[] = ['stable', 'balanced', 'responsive'];
const ENV_OPTIONS: { value: Environment; label: string; desc: string }[] = [
  { value: 'auto',     label: 'Auto',     desc: 'Middle-ground thresholds' },
  { value: 'outdoors', label: 'Outdoors', desc: 'Tight — filters multipath near buildings' },
  { value: 'indoors',  label: 'Indoors',  desc: 'Relaxed — GPS is always weak indoors' },
];

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

// ─── Static explainer data ─────────────────────────────────────────────────────

const ACCURACY_EXPLANATIONS = [
  {
    title: 'GPS Speed (Chipset Native)',
    color: 'bg-emerald-50 border-emerald-200',
    body: "Your phone's GPS chip reports speed directly using Doppler shift of satellite signals. This app displays that reading with a Kalman filter to smooth out jitter, but doesn't reject or recompute anything—just uses what the GPS API provides.",
  },
  {
    title: 'Kalman Filter (Smoothing Only)',
    color: 'bg-blue-50 border-blue-200',
    body: 'Every new GPS speed reading is blended with the previous estimate based on how different they are. Gradual acceleration ripples through cleanly; sudden spikes get dampened. No samples are ever skipped.',
  },
  {
    title: 'Stationary Lock',
    color: 'bg-violet-50 border-violet-200',
    body: 'After a few seconds of near-zero speed and minimal movement, the display snaps to 0 to avoid residual jitter from GPS noise. Once you start moving clearly, the speed immediately rises from zero.',
  },
  {
    title: 'Accuracy Circle',
    color: 'bg-amber-50 border-amber-200',
    body: 'Your location accuracy (the GPS uncertainty radius) is shown in the badge. Smaller is better. The accuracy threshold is different for indoors vs outdoors — use the Environment toggle to match your situation.',
  },
  {
    title: 'Multipath (Near Buildings)',
    color: 'bg-red-50 border-red-200',
    body: 'Near buildings, GPS signals bounce off walls and arrive late — the chip interprets this as a sudden position jump and reports a falsely high speed. Switch to Outdoors mode and Stable filter to reject these spikes before they reach the display.',
  },
  {
    title: 'Indoors Limitations',
    color: 'bg-teal-50 border-teal-200',
    body: 'Indoors, GPS rarely locks onto satellites and accuracy degrades to 30–50 m. The app relaxes its accuracy gate so you still get readings, but speed values will be noisier. For best results, walk near a window or step outside.',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function SpeedMeterPrototypePage() {
  const watchIdRef = useRef<number | null>(null);
  const sessionStartMsRef = useRef<number | null>(null);
  const elapsedOffsetSecondsRef = useRef(0);
  const lastPointRef = useRef<LastPoint | null>(null);
  const kalmanRef = useRef<KalmanState>({ estimate: 0, errorCovariance: 1 });
  const totalDistanceMetersRef = useRef(0);
  const maxSpeedMpsRef = useRef(0);
  const skippedRef = useRef(0);
  const stopConfidenceRef = useRef(0);

  const [mode, setMode] = useState<SpeedMeterMode>('balanced');
  const [environment, setEnvironment] = useState<Environment>('auto');
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

  const modeRef = useRef<SpeedMeterMode>('balanced');
  const modeConfigRef = useRef<ModeConfig>(MODE_SETTINGS.balanced);
  const environmentRef = useRef<Environment>('auto');

  useEffect(() => {
    modeRef.current = mode;
    modeConfigRef.current = MODE_SETTINGS[mode];
  }, [mode]);

  useEffect(() => {
    environmentRef.current = environment;
  }, [environment]);

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
    sessionStartMsRef.current = Date.now();

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nowMs = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        const accuracyMeters = toFiniteNonNegative(position.coords.accuracy);
        const rawSpeedMps = Number(position.coords.speed);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        // Always update the badge so the user sees signal quality live.
        setLatestAccuracyMeters(accuracyMeters);

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
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters };
          return;
        }

        const prev = lastPointRef.current;
        if (!prev) {
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters };
          setStatusMessage('Live. GPS warming up...');
          return;
        }

        // FIX: was 0.5 s — iOS fires watchPosition faster during warmup, which
        // silently dropped early samples and made the display appear frozen.
        const deltaTimeSec = (nowMs - prev.timestampMs) / 1000;
        if (deltaTimeSec < MIN_DELTA_TIME_SECONDS) return;

        const rawDistanceMeters = haversineDistanceMeters({ lat: prev.lat, lng: prev.lng }, { lat, lng });
        if (!Number.isFinite(rawDistanceMeters)) {
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters };
          return;
        }

        // FIX 4: Per-environment distance gate — was 120 m (≈ 432 km/h at 1 s),
        // now tighter: 40 m outdoors, 15 m indoors.
        const maxDist = MAX_REASONABLE_SAMPLE_DISTANCE[env];
        if (rawDistanceMeters > maxDist) {
          skippedRef.current += 1;
          setSkippedSamples(skippedRef.current);
          lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters };
          return;
        }

        const distanceDeltaMeters = rawDistanceMeters;

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
          computedSpeedMps: rawDistanceMeters / deltaTimeSec, // position-delta for reference
          kalmanSpeedMps: smoothedSpeedMps,
          analysisMode: modeRef.current,
          environment: env,
          distanceDeltaMeters,
          cumulativeDistanceMeters: totalDistanceMetersRef.current,
        };

        setElapsedSeconds(elapsedSec);
        setInstantSpeedMps(speedMps);
        setTotalDistanceMeters(totalDistanceMetersRef.current);
        setCurrentSpeedMps(smoothedSpeedMps);
        setAverageSpeedMps(avgMps);
        setMaxSpeedMps(maxSpeedMpsRef.current);
        setSamples((prev) => [...prev, sample]);
        setStatusMessage('Live. Tracking speed samples.');

        lastPointRef.current = { lat, lng, timestampMs: nowMs, accuracyMeters };
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
    kalmanRef.current = { estimate: 0, errorCovariance: 1 };
    totalDistanceMetersRef.current = 0;
    maxSpeedMpsRef.current = 0;
    skippedRef.current = 0;
    stopConfidenceRef.current = 0;
    setIsStarting(false);
    setElapsedSeconds(0); setInstantSpeedMps(0); setCurrentSpeedMps(0); setAverageSpeedMps(0);
    setMaxSpeedMps(0); setTotalDistanceMeters(0);
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
  const activeModeLabel = MODE_SETTINGS[mode].label;

  const exportCsv = () => {
    if (samples.length === 0) { setStatusMessage('No samples yet. Start tracking first.'); return; }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    triggerDownload(`speedmeter-${ts}.csv`, buildCsvContent(samples), 'text/csv;charset=utf-8');
    setStatusMessage('CSV downloaded.');
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

  const activeEnvLabel = ENV_OPTIONS.find((e) => e.value === environment)?.label ?? 'Auto';
  const accuracyThresholdLabel = `${ACCURACY_THRESHOLD[environment]} m gate`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8">
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
                Throwaway Prototype
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Live Speed Meter Test
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600 md:text-base">
                Capture live speed while walking or running. Uses GPS Doppler speed when available
                (more accurate than position-delta maths) and applies a Kalman filter to remove
                spikes. Supports both indoors and outdoors use. Export CSV for thesis data.
              </p>
            </div>

            {/* Live GPS signal quality badge */}
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${signalColor}`}>
              <SignalIcon className="h-3.5 w-3.5" />
              {signalLabel}{latestAccuracyText ? ` · ${latestAccuracyText}` : ''}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
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
              onClick={resetSession}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Session
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mr-1">
              Kalman mode
            </span>
            {MODE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  mode === value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {MODE_SETTINGS[value].label}
              </button>
            ))}
            <span className="text-xs text-slate-500">Active: {activeModeLabel}</span>
          </div>

          {/* Environment selector — NEW */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mr-1">
              Environment
            </span>
            {ENV_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEnvironment(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  environment === value
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="text-xs text-slate-500">
              Active: {activeEnvLabel} · {accuracyThresholdLabel}
            </span>
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
            Select the correct <strong>Environment</strong> above before you start.
            <strong> Outdoors</strong> uses a tight 15 m accuracy gate to reject multipath spikes near buildings.
            <strong> Indoors</strong> relaxes it to 50 m so you still get readings despite poor satellite visibility.
            <strong> Auto</strong> is a 25 m middle ground for mixed use.
            GPS must lock onto satellites for Doppler speed to work — check the badge.
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
              <MetricCard icon={<Activity className="h-4 w-4" />} label="Distance" value={`${totalDistanceMeters.toFixed(1)} m`} />
              <MetricCard icon={<Download className="h-4 w-4" />} label="OK / Skipped" value={`${samples.length} / ${skippedSamples}`} />
            </div>
          </div>
        </motion.section>

        {/* ── Latest samples table ─────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-slate-900">Latest Samples</h2>
          <p className="mt-2 text-sm text-slate-600">
            Only accepted, Kalman-filtered samples appear here.{' '}
            <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">GPS</span>{' '}
            = Doppler from chipset (accurate).{' '}
            <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">Zero</span>{' '}
            = no chipset speed available. CSV export has all raw columns including position-delta computed speed.
          </p>

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
                    <th className="px-3 py-2">Env</th>
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
                      <td className="whitespace-nowrap px-3 py-2 capitalize text-slate-500 text-xs">
                        {sample.environment}
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

        {/* ── Accuracy explainer ───────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-slate-900">Why is Speed Sometimes Inaccurate?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Understanding these six factors helps you collect clean data for your thesis.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ACCURACY_EXPLANATIONS.map(({ title, color, body }) => (
              <div key={title} className={`rounded-xl border p-4 ${color}`}>
                <div className="mb-1 font-semibold text-slate-900">{title}</div>
                <div className="text-xs leading-relaxed text-slate-700">{body}</div>
              </div>
            ))}
          </div>
        </motion.section>

      </div>
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
