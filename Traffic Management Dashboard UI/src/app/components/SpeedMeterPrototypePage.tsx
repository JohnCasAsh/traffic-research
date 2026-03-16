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
type LastPoint = { lat: number; lng: number; timestampMs: number };
type SpeedMeterMode = 'stable' | 'balanced' | 'responsive';

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
};

type ModeConfig = {
  label: string;
  baseKalmanQ: number;
  fastKalmanQ: number;
  adaptiveQDeltaMps: number;
  movementSignificanceFactor: number;
  maxNoiseGateMeters: number;
  stillSpeedThresholdMps: number;
  stillDistanceThresholdMeters: number;
  stopLockMinSamples: number;
  zeroLockSpeedMps: number;
  burstStartDeltaMps: number;
  burstBoostSamples: number;
  burstBlend: number;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

// Positions with an accuracy circle larger than this are discarded from speed
// calculations – they are almost certainly WiFi or cell-tower fixes, not GPS.
const MAX_RELIABLE_ACCURACY_METERS = 30;

// 1-D Kalman measurement noise. Mode-specific process noise is defined below.
// R remains fixed because it reflects GPS measurement noise, not mode preference.
const KALMAN_R = 1.2;

// Drop a reading if it implies a speed jump more than this multiple of current estimate.
const MAX_SPEED_JUMP_FACTOR = 4;

// Skip samples that arrive too fast to produce meaningful time-delta division.
const MIN_DELTA_TIME_SECONDS = 0.5;

// Hard cap – walking/running tests should never exceed ~55 km/h (15 m/s).
const MAX_EXPECTED_SPEED_MPS = 15;

const MAX_REASONABLE_SAMPLE_DISTANCE_METERS = 120;

const MODE_SETTINGS: Record<SpeedMeterMode, ModeConfig> = {
  stable: {
    label: 'Stable',
    baseKalmanQ: 0.4,
    fastKalmanQ: 1.8,
    adaptiveQDeltaMps: 1.2,
    movementSignificanceFactor: 0.45,
    maxNoiseGateMeters: 1.6,
    stillSpeedThresholdMps: 0.28,
    stillDistanceThresholdMeters: 0.65,
    stopLockMinSamples: 3,
    zeroLockSpeedMps: 0.12,
    burstStartDeltaMps: 1.5,
    burstBoostSamples: 1,
    burstBlend: 0.45,
  },
  balanced: {
    label: 'Balanced',
    baseKalmanQ: 0.6,
    fastKalmanQ: 2.8,
    adaptiveQDeltaMps: 0.9,
    movementSignificanceFactor: 0.4,
    maxNoiseGateMeters: 1.2,
    stillSpeedThresholdMps: 0.35,
    stillDistanceThresholdMeters: 0.55,
    stopLockMinSamples: 2,
    zeroLockSpeedMps: 0.15,
    burstStartDeltaMps: 1.1,
    burstBoostSamples: 2,
    burstBlend: 0.65,
  },
  responsive: {
    label: 'Responsive',
    baseKalmanQ: 1.0,
    fastKalmanQ: 4.2,
    adaptiveQDeltaMps: 0.6,
    movementSignificanceFactor: 0.32,
    maxNoiseGateMeters: 0.9,
    stillSpeedThresholdMps: 0.45,
    stillDistanceThresholdMeters: 0.45,
    stopLockMinSamples: 1,
    zeroLockSpeedMps: 0.2,
    burstStartDeltaMps: 0.75,
    burstBoostSamples: 3,
    burstBlend: 0.82,
  },
};

const MODE_OPTIONS: SpeedMeterMode[] = ['stable', 'balanced', 'responsive'];

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

/**
 * 1-D Kalman filter update step.
 * Blends the previous estimate with a new noisy measurement.
 * When Kalman gain is high, we trust the measurement more.
 * When low, we trust our prediction more.
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
    'analysis_mode',
    'distance_delta_meters', 'cumulative_distance_meters',
  ];
  const lines = samples.map((s) => [
    s.timestampIso, s.elapsedSeconds.toFixed(2),
    s.latitude.toFixed(7), s.longitude.toFixed(7),
    s.accuracyMeters.toFixed(2), s.positionReliable ? '1' : '0', s.speedSource,
    s.instantSpeedMps.toFixed(4), (s.instantSpeedMps * 3.6).toFixed(4),
    s.rawSpeedMps.toFixed(4), s.computedSpeedMps.toFixed(4),
    s.kalmanSpeedMps.toFixed(4), (s.kalmanSpeedMps * 3.6).toFixed(4),
    s.analysisMode,
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
    title: 'GPS Doppler Speed (Best Source)',
    color: 'bg-emerald-50 border-emerald-200',
    body: "Your phone's GPS chip measures speed using the Doppler shift of satellite signals — the same principle as radar guns. This is far more accurate than computing speed from two positions, especially at slow walking speeds. This app always prefers it when available.",
  },
  {
    title: 'Position-Delta Speed (Fallback)',
    color: 'bg-blue-50 border-blue-200',
    body: 'When GPS Doppler is unavailable the app computes speed as distance ÷ time between two GPS positions. If you walked 3 m but the accuracy circle is 15 m, the entire reading is noise. This is why you see spikes indoors or near tall buildings.',
  },
  {
    title: 'Kalman Filter (Spike Removal)',
    color: 'bg-violet-50 border-violet-200',
    body: 'A 1-D Kalman filter blends every new GPS reading with the previous estimate, proportional to how trustworthy each is. A sudden 80 km/h reading from a GPS glitch gets heavily discounted rather than shown directly.',
  },
  {
    title: 'Accuracy Gating (30 m Rule)',
    color: 'bg-amber-50 border-amber-200',
    body: 'Any sample where the GPS accuracy circle exceeds 30 m is automatically skipped. This catches WiFi and cell-tower fixes the browser falls back to when satellite reception is poor.',
  },
  {
    title: 'WiFi / Data Speed ≠ Movement Speed',
    color: 'bg-red-50 border-red-200',
    body: "Your WiFi download speed (Mbps) and mobile data connection have nothing to do with how fast you are physically moving. Speed accuracy comes entirely from the GPS chip. A fast 5G connection does not improve location accuracy.",
  },
  {
    title: 'Best Conditions for Thesis Data',
    color: 'bg-teal-50 border-teal-200',
    body: 'Go to an open road or field away from tall buildings. Walk for 20–30 seconds before collecting data so GPS can warm up. Avoid tunnels and dense tree canopy. Check the GPS Good badge before recording your thesis run.',
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
  const burstBoostRemainingRef = useRef(0);

  const [mode, setMode] = useState<SpeedMeterMode>('balanced');
  const [isTracking, setIsTracking] = useState(false);
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

  useEffect(() => {
    modeRef.current = mode;
    modeConfigRef.current = MODE_SETTINGS[mode];
  }, [mode]);

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
    setStatusMessage('Paused. Resume to continue the same session.');
  };

  const startTracking = () => {
    if (isTracking) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Geolocation is not supported in this browser.');
      return;
    }
    setErrorMessage(null);
    setStatusMessage('Live. Walk or run outdoors for best accuracy.');
    sessionStartMsRef.current = Date.now();

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const modeConfig = modeConfigRef.current;
        const nowMs = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        const accuracyMeters = toFiniteNonNegative(position.coords.accuracy);
        const rawSpeedMps = toFiniteNonNegative(position.coords.speed);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        // Always show the live accuracy so the GPS badge updates even when skipping.
        setLatestAccuracyMeters(accuracyMeters);

        const positionReliable = accuracyMeters <= MAX_RELIABLE_ACCURACY_METERS;
        const prev = lastPointRef.current;

        // ── Time-delta gate ────────────────────────────────────────────────────
        if (prev && (nowMs - prev.timestampMs) / 1000 < MIN_DELTA_TIME_SECONDS) return;

        // ── Position-delta speed ───────────────────────────────────────────────
        let computedSpeedMps = 0;
        let distanceDeltaMeters = 0;

        if (prev) {
          const deltaTimeSec = (nowMs - prev.timestampMs) / 1000;
          const rawDist = haversineDistanceMeters({ lat: prev.lat, lng: prev.lng }, { lat, lng });

          if (Number.isFinite(rawDist) && rawDist <= MAX_REASONABLE_SAMPLE_DISTANCE_METERS) {
            // Poor GPS accuracy means MORE position jitter, so the noise gate must
            // be LARGER, not smaller.  Math.max ensures a high-accuracy fix keeps
            // the small base gate while a marginal fix requires proportionally more
            // real movement before we count it.
            // When the GPS chipset provides no Doppler speed (rawSpeedMps===0,
            // common on iPhone) we apply an additional 1.5× multiplier because
            // we have no independent velocity confirmation and must be stricter.
            const noDoppler = rawSpeedMps === 0;
            const movementNoiseThreshold = Math.max(
              modeConfig.maxNoiseGateMeters,
              accuracyMeters * modeConfig.movementSignificanceFactor * (noDoppler ? 1.5 : 1.0),
            );

            // Only count movement that clearly exceeds the GPS noise floor.
            if (rawDist > movementNoiseThreshold) {
              distanceDeltaMeters = rawDist;
            }
          }
          if (deltaTimeSec > 0 && distanceDeltaMeters > 0) {
            computedSpeedMps = distanceDeltaMeters / deltaTimeSec;
          }
        }

        // ── Speed source selection ─────────────────────────────────────────────
        // GPS Doppler (coords.speed) is measured directly by the chipset using
        // satellite signal phase shifts – far more accurate than position-delta
        // maths, especially at slow walking speeds where position noise dominates.
        let speedCandidateMps: number;
        let speedSource: SpeedSample['speedSource'];

        if (rawSpeedMps > 0) {
          speedCandidateMps = rawSpeedMps;
          speedSource = 'gps_doppler';
        } else if (computedSpeedMps > 0) {
          speedCandidateMps = computedSpeedMps;
          speedSource = 'computed';
        } else {
          speedCandidateMps = 0;
          speedSource = 'zero';
        }

        speedCandidateMps = Math.min(speedCandidateMps, MAX_EXPECTED_SPEED_MPS);

        const nearStillBySpeed = speedCandidateMps <= modeConfig.stillSpeedThresholdMps;
        const nearStillByDistance = distanceDeltaMeters <= modeConfig.stillDistanceThresholdMeters;

        if (nearStillBySpeed && nearStillByDistance) {
          stopConfidenceRef.current += 1;
        } else {
          stopConfidenceRef.current = 0;
        }

        if (stopConfidenceRef.current >= modeConfig.stopLockMinSamples) {
          speedCandidateMps = 0;
          speedSource = 'zero';
        }

        // ── Accuracy gate ──────────────────────────────────────────────────────
        // Discard non-zero speed from low-accuracy (WiFi/cell) fixes.
        if (!positionReliable && speedCandidateMps > 0) {
          skippedRef.current += 1;
          setSkippedSamples(skippedRef.current);
          lastPointRef.current = { lat, lng, timestampMs: nowMs };
          return;
        }

        // ── Spike rejection ────────────────────────────────────────────────────
        const prevEstimate = kalmanRef.current.estimate;
        if (prevEstimate > 0.2 && speedCandidateMps > prevEstimate * MAX_SPEED_JUMP_FACTOR) {
          skippedRef.current += 1;
          setSkippedSamples(skippedRef.current);
          return;
        }

        if (
          prevEstimate <= 1.0 &&
          speedCandidateMps >= prevEstimate + modeConfig.burstStartDeltaMps
        ) {
          burstBoostRemainingRef.current = modeConfig.burstBoostSamples;
        }

        // ── Kalman filter ──────────────────────────────────────────────────────
        const measurementDelta = Math.abs(speedCandidateMps - prevEstimate);
        let processNoise =
          measurementDelta >= modeConfig.adaptiveQDeltaMps
            ? modeConfig.fastKalmanQ
            : modeConfig.baseKalmanQ;

        if (burstBoostRemainingRef.current > 0) {
          processNoise = Math.max(processNoise, modeConfig.fastKalmanQ * 1.4);
        }

        kalmanRef.current = kalmanUpdate(kalmanRef.current, speedCandidateMps, processNoise);
        let kalmanSpeedMps = Math.max(0, kalmanRef.current.estimate);

        if (burstBoostRemainingRef.current > 0) {
          if (speedCandidateMps > kalmanSpeedMps) {
            kalmanSpeedMps =
              kalmanSpeedMps * (1 - modeConfig.burstBlend) +
              speedCandidateMps * modeConfig.burstBlend;
            kalmanRef.current = { ...kalmanRef.current, estimate: kalmanSpeedMps };
          }
          burstBoostRemainingRef.current -= 1;
        }

        if (
          stopConfidenceRef.current >= modeConfig.stopLockMinSamples &&
          kalmanSpeedMps <= modeConfig.zeroLockSpeedMps
        ) {
          kalmanRef.current = { ...kalmanRef.current, estimate: 0 };
          kalmanSpeedMps = 0;
        }

        totalDistanceMetersRef.current += distanceDeltaMeters;
        maxSpeedMpsRef.current = Math.max(maxSpeedMpsRef.current, kalmanSpeedMps);

        const elapsedSec = readElapsedSeconds(nowMs);
        const avgMps = elapsedSec > 0 ? totalDistanceMetersRef.current / elapsedSec : 0;

        const sample: SpeedSample = {
          id: `${nowMs}-${Math.random().toString(16).slice(2)}`,
          timestampIso: new Date(nowMs).toISOString(),
          elapsedSeconds: elapsedSec,
          latitude: lat, longitude: lng,
          accuracyMeters, positionReliable, speedSource,
          instantSpeedMps: speedCandidateMps,
          rawSpeedMps, computedSpeedMps, kalmanSpeedMps,
          analysisMode: modeRef.current,
          distanceDeltaMeters,
          cumulativeDistanceMeters: totalDistanceMetersRef.current,
        };

        setElapsedSeconds(elapsedSec);
        setInstantSpeedMps(speedCandidateMps);
        setTotalDistanceMeters(totalDistanceMetersRef.current);
        setCurrentSpeedMps(kalmanSpeedMps);
        setAverageSpeedMps(avgMps);
        setMaxSpeedMps(maxSpeedMpsRef.current);
        setSamples((prev) => [...prev, sample]);
        lastPointRef.current = { lat, lng, timestampMs: nowMs };
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
    burstBoostRemainingRef.current = 0;
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
                spikes. Export CSV for thesis data.
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
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-teal-700 hover:to-blue-700"
            >
              {isTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isTracking ? 'Pause Tracking' : 'Start Tracking'}
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
            <span className="text-xs text-slate-500">Current mode: {activeModeLabel}</span>
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
            Go outdoors in an open area. WiFi-only positioning has 20–100 m error which makes speed
            calculations unreliable — your phone must lock onto GPS satellites (&lt;10 m) for clean
            readings. Samples with accuracy &gt;{MAX_RELIABLE_ACCURACY_METERS} m are automatically skipped.
            Tiny residual movement around 0.03 m/s can still appear from GPS jitter, so near-zero speed
            is auto-snapped to 0 after a short stationary lock.
            Short acceleration bursts are now boosted so speed rises faster when you start moving.
            {skippedSamples > 0 && (
              <span className="ml-1 font-semibold text-amber-900">
                ({skippedSamples} sample{skippedSamples !== 1 ? 's' : ''} skipped so far.)
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
            <span className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">Computed</span>{' '}
            = position-delta (noisier). CSV export has all raw columns.
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
                          sample.speedSource === 'computed' ? 'bg-blue-50 text-blue-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {sample.speedSource === 'gps_doppler' ? 'GPS' :
                           sample.speedSource === 'computed' ? 'Computed' : 'Zero'}
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
