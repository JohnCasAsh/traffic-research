const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();

const TRACKING_TTL_MS = Number.parseInt(process.env.TRACKING_TTL_MS || '1800000', 10);
const CONGESTION_SPEED_KPH = Number.parseFloat(process.env.CONGESTION_SPEED_KPH || '8');
const CONGESTION_CLEAR_SPEED_KPH = Number.parseFloat(process.env.CONGESTION_CLEAR_SPEED_KPH || '14');
const CONGESTION_MIN_DURATION_MS = Number.parseInt(
  process.env.CONGESTION_MIN_DURATION_MS || '120000',
  10
);
const TRACKING_DEFAULT_RADIUS_KM = Number.parseFloat(process.env.TRACKING_DEFAULT_RADIUS_KM || '3');
const TRACKING_HISTORY_WINDOW_MS = Number.parseInt(
  process.env.TRACKING_HISTORY_WINDOW_MS || '600000',
  10
);
const TRACKING_HISTORY_MAX_POINTS = Number.parseInt(
  process.env.TRACKING_HISTORY_MAX_POINTS || '40',
  10
);
const TRACKING_MIN_POINT_DISTANCE_METERS = Number.parseFloat(
  process.env.TRACKING_MIN_POINT_DISTANCE_METERS || '20'
);
const TRACKING_MIN_POINT_INTERVAL_MS = Number.parseInt(
  process.env.TRACKING_MIN_POINT_INTERVAL_MS || '10000',
  10
);
const TRACKING_SEGMENT_RETENTION_MS = Number.parseInt(
  process.env.TRACKING_SEGMENT_RETENTION_MS || '2592000000',
  10
);
const TRACKING_SEGMENT_MAX_ITEMS = Number.parseInt(
  process.env.TRACKING_SEGMENT_MAX_ITEMS || '120000',
  10
);
const TRACKING_HISTORY_DEFAULT_MINUTES = Number.parseInt(
  process.env.TRACKING_HISTORY_DEFAULT_MINUTES || '60',
  10
);
const TRACKING_HISTORY_MAX_MINUTES = Number.parseInt(
  process.env.TRACKING_HISTORY_MAX_MINUTES || '1440',
  10
);
const TRACKING_HISTORY_DEFAULT_LIMIT = Number.parseInt(
  process.env.TRACKING_HISTORY_DEFAULT_LIMIT || '1000',
  10
);
const TRACKING_HISTORY_MAX_LIMIT = Number.parseInt(
  process.env.TRACKING_HISTORY_MAX_LIMIT || '5000',
  10
);
const TRACKING_ANALYTICS_DEFAULT_DAYS = Number.parseInt(
  process.env.TRACKING_ANALYTICS_DEFAULT_DAYS || '30',
  10
);
const TRACKING_ANALYTICS_MAX_DAYS = Number.parseInt(
  process.env.TRACKING_ANALYTICS_MAX_DAYS || '365',
  10
);
const TRACKING_LOCAL_STORE_ENABLED = process.env.TRACKING_LOCAL_STORE_ENABLED !== 'false';
const TRACKING_LOCAL_STORE_PATH = process.env.TRACKING_LOCAL_STORE_PATH || './data/live-tracking-store.json';
const TRACKING_LOCAL_FLUSH_MS = Number.parseInt(
  process.env.TRACKING_LOCAL_FLUSH_MS || '5000',
  10
);
const STREAM_HEARTBEAT_MS = 25000;
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const vehicleStates = new Map();
const activeAlerts = new Map();
const historicalSegments = [];
const sseClients = new Set();
let persistTimer = null;
let persistDirty = false;

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(radLat1) * Math.cos(radLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return 6371 * c;
}

function sendSse(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function isWithinTrackingFilter(filterOptions, lat, lng) {
  const filterLat = toFiniteNumber(filterOptions?.lat);
  const filterLng = toFiniteNumber(filterOptions?.lng);
  const radiusKm = toFiniteNumber(filterOptions?.radiusKm) || TRACKING_DEFAULT_RADIUS_KM;

  if (filterLat == null || filterLng == null) {
    return true;
  }

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return false;
  }

  return haversineDistanceKm(filterLat, filterLng, Number(lat), Number(lng)) <= radiusKm;
}

function filterSnapshotForClient(snapshot, filterOptions) {
  const filterLat = toFiniteNumber(filterOptions?.lat);
  const filterLng = toFiniteNumber(filterOptions?.lng);
  if (filterLat == null || filterLng == null) {
    return snapshot;
  }

  const vehicles = Array.isArray(snapshot?.vehicles)
    ? snapshot.vehicles.filter((vehicle) =>
        isWithinTrackingFilter(filterOptions, vehicle?.lat, vehicle?.lng)
      )
    : [];
  const visibleVehicleIds = new Set(vehicles.map((vehicle) => vehicle.vehicleId));
  const alerts = Array.isArray(snapshot?.alerts)
    ? snapshot.alerts.filter((alert) => visibleVehicleIds.has(alert?.vehicleId))
    : [];

  return {
    ...snapshot,
    vehicles,
    alerts,
  };
}

function shouldSendEventToClient(eventName, payload, filterOptions) {
  if (eventName === 'snapshot' || eventName === 'congestion-clear') {
    return true;
  }

  if (eventName === 'congestion-alert') {
    return isWithinTrackingFilter(filterOptions, payload?.lat, payload?.lng);
  }

  if (eventName === 'tracking-update') {
    return isWithinTrackingFilter(filterOptions, payload?.vehicle?.lat, payload?.vehicle?.lng);
  }

  return true;
}

function broadcastSse(eventName, payload) {
  for (const client of sseClients) {
    try {
      if (!shouldSendEventToClient(eventName, payload, client.filterOptions)) {
        continue;
      }

      const eventPayload =
        eventName === 'snapshot' ? filterSnapshotForClient(payload, client.filterOptions) : payload;

      sendSse(client.res, eventName, eventPayload);
    } catch {
      clearInterval(client.heartbeatId);
      sseClients.delete(client);
    }
  }
}

function computeTrafficLevelFromSpeed(speedKph) {
  if (speedKph <= CONGESTION_SPEED_KPH) {
    return 'heavy';
  }

  if (speedKph <= 25) {
    return 'moderate';
  }

  return 'low';
}

function computeTrafficLevel(state) {
  if (state.isCongested) {
    return 'heavy';
  }

  return computeTrafficLevelFromSpeed(state.speedKph);
}

function serializeVehicle(state) {
  return {
    vehicleId: state.vehicleId,
    lat: state.lat,
    lng: state.lng,
    speedKph: state.speedKph,
    heading: state.heading,
    updatedAt: new Date(state.updatedAt).toISOString(),
    isCongested: state.isCongested,
    trafficLevel: computeTrafficLevel(state),
    recentPath: (state.recentPath || []).map((point) => ({
      lat: point.lat,
      lng: point.lng,
      speedKph: point.speedKph,
      timestamp: new Date(point.timestamp).toISOString(),
    })),
  };
}

function serializeAlert(alert) {
  const startedAtMs = Number(alert.startedAt);
  const updatedAtMs = Number(alert.updatedAt);
  const normalizedStartedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
  const normalizedUpdatedAtMs = Number.isFinite(updatedAtMs)
    ? updatedAtMs
    : normalizedStartedAtMs;
  const durationMs = Math.max(0, normalizedUpdatedAtMs - normalizedStartedAtMs);

  return {
    vehicleId: alert.vehicleId,
    message: alert.message,
    lat: alert.lat,
    lng: alert.lng,
    speedKph: alert.speedKph,
    startedAt: new Date(normalizedStartedAtMs).toISOString(),
    updatedAt: new Date(normalizedUpdatedAtMs).toISOString(),
    durationMs,
    durationMinutes: Number((durationMs / 60000).toFixed(1)),
  };
}

function serializeTrafficSegment(segment) {
  return {
    vehicleId: segment.vehicleId,
    startLat: segment.startLat,
    startLng: segment.startLng,
    endLat: segment.endLat,
    endLng: segment.endLng,
    speedKph: segment.speedKph,
    trafficLevel: segment.trafficLevel,
    startedAt: new Date(segment.startedAt).toISOString(),
    endedAt: new Date(segment.endedAt).toISOString(),
  };
}

function resolveLocalStorePath() {
  if (path.isAbsolute(TRACKING_LOCAL_STORE_PATH)) {
    return TRACKING_LOCAL_STORE_PATH;
  }

  return path.join(__dirname, '..', TRACKING_LOCAL_STORE_PATH);
}

function toTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidGeoPoint(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function serializePersistableVehicleState(state) {
  return {
    vehicleId: state.vehicleId,
    lat: state.lat,
    lng: state.lng,
    speedKph: state.speedKph,
    heading: state.heading,
    updatedAt: state.updatedAt,
    isCongested: Boolean(state.isCongested),
    lowSpeedStartedAt: toTimestamp(state.lowSpeedStartedAt),
    congestionSince: toTimestamp(state.congestionSince),
    recentPath: Array.isArray(state.recentPath)
      ? state.recentPath
          .map((point) => ({
            lat: Number(point.lat),
            lng: Number(point.lng),
            speedKph: Math.max(0, Number(point.speedKph) || 0),
            timestamp: Number(point.timestamp),
          }))
          .filter((point) => isValidGeoPoint(point.lat, point.lng) && Number.isFinite(point.timestamp))
      : [],
  };
}

function serializePersistableAlert(alert) {
  return {
    vehicleId: alert.vehicleId,
    message: alert.message,
    lat: alert.lat,
    lng: alert.lng,
    speedKph: alert.speedKph,
    startedAt: alert.startedAt,
    updatedAt: alert.updatedAt,
  };
}

function serializePersistableSegment(segment) {
  return {
    vehicleId: segment.vehicleId,
    startLat: segment.startLat,
    startLng: segment.startLng,
    endLat: segment.endLat,
    endLng: segment.endLng,
    speedKph: segment.speedKph,
    trafficLevel: segment.trafficLevel,
    startedAt: segment.startedAt,
    endedAt: segment.endedAt,
  };
}

function hydrateVehicleState(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const vehicleId = String(entry.vehicleId || '').trim();
  const lat = Number(entry.lat);
  const lng = Number(entry.lng);
  if (!vehicleId || !isValidGeoPoint(lat, lng)) {
    return null;
  }

  const updatedAt = toTimestamp(entry.updatedAt) || Date.now();
  const headingValue = toFiniteNumber(entry.heading);
  const recentPath = Array.isArray(entry.recentPath)
    ? entry.recentPath
        .map((point) => ({
          lat: Number(point?.lat),
          lng: Number(point?.lng),
          speedKph: Math.max(0, Number(point?.speedKph) || 0),
          timestamp: Number(point?.timestamp),
        }))
        .filter((point) => isValidGeoPoint(point.lat, point.lng) && Number.isFinite(point.timestamp))
    : [];

  return {
    vehicleId,
    lat,
    lng,
    speedKph: Math.max(0, Number(entry.speedKph) || 0),
    heading: headingValue,
    updatedAt,
    isCongested: Boolean(entry.isCongested),
    lowSpeedStartedAt: toTimestamp(entry.lowSpeedStartedAt),
    congestionSince: toTimestamp(entry.congestionSince),
    recentPath,
  };
}

function hydrateAlert(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const vehicleId = String(entry.vehicleId || '').trim();
  const lat = Number(entry.lat);
  const lng = Number(entry.lng);
  const startedAt = toTimestamp(entry.startedAt);
  const updatedAt = toTimestamp(entry.updatedAt);

  if (!vehicleId || !isValidGeoPoint(lat, lng) || !startedAt || !updatedAt) {
    return null;
  }

  return {
    vehicleId,
    message: String(entry.message || `Congestion detected for vehicle ${vehicleId}`),
    lat,
    lng,
    speedKph: Math.max(0, Number(entry.speedKph) || 0),
    startedAt,
    updatedAt,
  };
}

function hydrateSegment(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const vehicleId = String(entry.vehicleId || '').trim();
  const startLat = Number(entry.startLat);
  const startLng = Number(entry.startLng);
  const endLat = Number(entry.endLat);
  const endLng = Number(entry.endLng);
  const startedAt = toTimestamp(entry.startedAt);
  const endedAt = toTimestamp(entry.endedAt);

  if (
    !vehicleId ||
    !isValidGeoPoint(startLat, startLng) ||
    !isValidGeoPoint(endLat, endLng) ||
    !startedAt ||
    !endedAt
  ) {
    return null;
  }

  const speedKph = Math.max(0, Number(entry.speedKph) || 0);
  const knownTrafficLevel = String(entry.trafficLevel || '').trim();
  const trafficLevel = ['low', 'moderate', 'heavy'].includes(knownTrafficLevel)
    ? knownTrafficLevel
    : computeTrafficLevelFromSpeed(speedKph);

  return {
    vehicleId,
    startLat,
    startLng,
    endLat,
    endLng,
    speedKph,
    trafficLevel,
    startedAt,
    endedAt: Math.max(startedAt, endedAt),
  };
}

const resolvedLocalStorePath = resolveLocalStorePath();

function loadLocalStore() {
  if (!TRACKING_LOCAL_STORE_ENABLED) {
    return;
  }

  if (!fs.existsSync(resolvedLocalStorePath)) {
    return;
  }

  try {
    const fileContent = fs.readFileSync(resolvedLocalStorePath, 'utf8');
    const parsed = JSON.parse(fileContent);

    vehicleStates.clear();
    activeAlerts.clear();
    historicalSegments.length = 0;

    const persistedVehicleStates = Array.isArray(parsed?.vehicleStates) ? parsed.vehicleStates : [];
    for (const rawState of persistedVehicleStates) {
      const hydratedState = hydrateVehicleState(rawState);
      if (hydratedState) {
        vehicleStates.set(hydratedState.vehicleId, hydratedState);
      }
    }

    const persistedAlerts = Array.isArray(parsed?.activeAlerts) ? parsed.activeAlerts : [];
    for (const rawAlert of persistedAlerts) {
      const hydratedAlert = hydrateAlert(rawAlert);
      if (hydratedAlert) {
        activeAlerts.set(hydratedAlert.vehicleId, hydratedAlert);
      }
    }

    const persistedSegments = Array.isArray(parsed?.historicalSegments)
      ? parsed.historicalSegments
      : [];
    for (const rawSegment of persistedSegments) {
      const hydratedSegment = hydrateSegment(rawSegment);
      if (hydratedSegment) {
        historicalSegments.push(hydratedSegment);
      }
    }

    const nowMs = Date.now();
    pruneStaleVehicles(nowMs);
    pruneHistoricalSegments(nowMs);

    console.log(
      `Live tracking local store loaded: ${vehicleStates.size} vehicles, ${activeAlerts.size} alerts, ${historicalSegments.length} segments.`
    );
  } catch (error) {
    console.error('Failed to load live tracking local store:', error.message);
  }
}

function persistLocalStore() {
  if (!TRACKING_LOCAL_STORE_ENABLED) {
    return;
  }

  persistDirty = false;

  try {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      vehicleStates: Array.from(vehicleStates.values()).map(serializePersistableVehicleState),
      activeAlerts: Array.from(activeAlerts.values()).map(serializePersistableAlert),
      historicalSegments: historicalSegments.map(serializePersistableSegment),
    };

    fs.mkdirSync(path.dirname(resolvedLocalStorePath), { recursive: true });
    fs.writeFileSync(resolvedLocalStorePath, JSON.stringify(payload), 'utf8');
  } catch (error) {
    console.error('Failed to persist live tracking local store:', error.message);
  }
}

function scheduleLocalStorePersist() {
  if (!TRACKING_LOCAL_STORE_ENABLED) {
    return;
  }

  persistDirty = true;
  if (persistTimer) {
    return;
  }

  const delayMs = Number.isFinite(TRACKING_LOCAL_FLUSH_MS)
    ? Math.max(1000, TRACKING_LOCAL_FLUSH_MS)
    : 5000;

  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (persistDirty) {
      persistLocalStore();
    }
  }, delayMs);

  if (typeof persistTimer.unref === 'function') {
    persistTimer.unref();
  }
}

function pruneHistoricalSegments(nowMs) {
  let changed = false;
  const lowerTimestamp = nowMs - TRACKING_SEGMENT_RETENTION_MS;
  for (let index = historicalSegments.length - 1; index >= 0; index -= 1) {
    const segment = historicalSegments[index];
    if (segment.endedAt >= lowerTimestamp) {
      continue;
    }

    historicalSegments.splice(index, 1);
    changed = true;
  }

  if (historicalSegments.length > TRACKING_SEGMENT_MAX_ITEMS) {
    historicalSegments.splice(0, historicalSegments.length - TRACKING_SEGMENT_MAX_ITEMS);
    changed = true;
  }

  return changed;
}

function pruneStaleVehicles(nowMs) {
  let removedCount = 0;

  for (const [vehicleId, state] of vehicleStates.entries()) {
    if (nowMs - state.updatedAt <= TRACKING_TTL_MS) {
      continue;
    }

    vehicleStates.delete(vehicleId);
    removedCount += 1;

    if (activeAlerts.has(vehicleId)) {
      activeAlerts.delete(vehicleId);
      broadcastSse('congestion-clear', {
        vehicleId,
        clearedAt: new Date(nowMs).toISOString(),
        reason: 'stale-tracker',
      });
    }
  }

  return removedCount;
}

function buildSnapshot(filterOptions = {}) {
  const nowMs = Date.now();
  const removedCount = pruneStaleVehicles(nowMs);
  if (removedCount > 0) {
    scheduleLocalStorePersist();
  }

  const sourceVehicles = Array.from(vehicleStates.values()).map(serializeVehicle);
  const sourceAlerts = Array.from(activeAlerts.values()).map(serializeAlert);

  const lat = toFiniteNumber(filterOptions.lat);
  const lng = toFiniteNumber(filterOptions.lng);
  const radiusKm = toFiniteNumber(filterOptions.radiusKm) || TRACKING_DEFAULT_RADIUS_KM;

  if (lat == null || lng == null) {
    return {
      generatedAt: new Date(nowMs).toISOString(),
      vehicles: sourceVehicles,
      alerts: sourceAlerts,
      historySegmentCount: historicalSegments.length,
    };
  }

  const vehicles = sourceVehicles.filter((vehicle) => {
    const distanceKm = haversineDistanceKm(lat, lng, vehicle.lat, vehicle.lng);
    return distanceKm <= radiusKm;
  });

  const visibleVehicleIds = new Set(vehicles.map((vehicle) => vehicle.vehicleId));
  const alerts = sourceAlerts.filter((alert) => visibleVehicleIds.has(alert.vehicleId));

  return {
    generatedAt: new Date(nowMs).toISOString(),
    vehicles,
    alerts,
    historySegmentCount: historicalSegments.length,
  };
}

function buildCongestionAlert(state, nowMs) {
  return {
    vehicleId: state.vehicleId,
    lat: state.lat,
    lng: state.lng,
    speedKph: state.speedKph,
    startedAt: state.congestionSince || nowMs,
    updatedAt: nowMs,
    message: `Congestion detected for vehicle ${state.vehicleId}`,
  };
}

function appendHistoryPoint(state, nowMs) {
  if (!Array.isArray(state.recentPath)) {
    state.recentPath = [];
  }

  let segmentSource = null;

  const nextPoint = {
    lat: state.lat,
    lng: state.lng,
    speedKph: state.speedKph,
    timestamp: nowMs,
  };

  const lastPoint = state.recentPath[state.recentPath.length - 1];
  if (!lastPoint) {
    state.recentPath.push(nextPoint);
  } else {
    const distanceMeters =
      haversineDistanceKm(lastPoint.lat, lastPoint.lng, nextPoint.lat, nextPoint.lng) * 1000;
    const elapsedMs = nowMs - Number(lastPoint.timestamp || 0);

    if (
      distanceMeters >= TRACKING_MIN_POINT_DISTANCE_METERS ||
      elapsedMs >= TRACKING_MIN_POINT_INTERVAL_MS
    ) {
      state.recentPath.push(nextPoint);
      segmentSource = {
        from: lastPoint,
        to: nextPoint,
      };
    }
  }

  const lowerTimestamp = nowMs - TRACKING_HISTORY_WINDOW_MS;
  state.recentPath = state.recentPath.filter((point) => Number(point.timestamp || 0) >= lowerTimestamp);

  if (state.recentPath.length > TRACKING_HISTORY_MAX_POINTS) {
    state.recentPath = state.recentPath.slice(-TRACKING_HISTORY_MAX_POINTS);
  }

  return segmentSource;
}

function buildTrafficSegment(vehicleId, segmentSource, nowMs) {
  if (!segmentSource?.from || !segmentSource?.to) {
    return null;
  }

  const startLat = Number(segmentSource.from.lat);
  const startLng = Number(segmentSource.from.lng);
  const endLat = Number(segmentSource.to.lat);
  const endLng = Number(segmentSource.to.lng);

  if (
    !Number.isFinite(startLat) ||
    !Number.isFinite(startLng) ||
    !Number.isFinite(endLat) ||
    !Number.isFinite(endLng)
  ) {
    return null;
  }

  const speedSamples = [Number(segmentSource.from.speedKph), Number(segmentSource.to.speedKph)].filter(
    (speed) => Number.isFinite(speed) && speed >= 0
  );
  const speedKph =
    speedSamples.length > 0
      ? speedSamples.reduce((total, value) => total + value, 0) / speedSamples.length
      : 0;

  const startedAt = Number(segmentSource.from.timestamp);
  const endedAt = Number(segmentSource.to.timestamp);

  return {
    vehicleId,
    startLat,
    startLng,
    endLat,
    endLng,
    speedKph,
    trafficLevel: computeTrafficLevelFromSpeed(speedKph),
    startedAt: Number.isFinite(startedAt) ? startedAt : nowMs,
    endedAt: Number.isFinite(endedAt) ? endedAt : nowMs,
  };
}

loadLocalStore();

process.on('beforeExit', () => {
  persistLocalStore();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    persistLocalStore();
    process.exit(0);
  });
}

setInterval(() => {
  const nowMs = Date.now();
  const removedCount = pruneStaleVehicles(nowMs);
  const historyChanged = pruneHistoricalSegments(nowMs);
  if (removedCount > 0 || historyChanged) {
    scheduleLocalStorePersist();
  }

  if (removedCount > 0) {
    broadcastSse('snapshot', buildSnapshot());
  }
}, 60000).unref?.();

router.get('/snapshot', (req, res) => {
  const snapshot = buildSnapshot({
    lat: req.query.lat,
    lng: req.query.lng,
    radiusKm: req.query.radiusKm,
  });

  res.json(snapshot);
});

router.get('/alerts', (req, res) => {
  const snapshot = buildSnapshot({
    lat: req.query.lat,
    lng: req.query.lng,
    radiusKm: req.query.radiusKm,
  });

  res.json({ generatedAt: snapshot.generatedAt, alerts: snapshot.alerts });
});

router.get('/history', (req, res) => {
  const nowMs = Date.now();
  const staleRemovedCount = pruneStaleVehicles(nowMs);
  const historyChanged = pruneHistoricalSegments(nowMs);
  if (staleRemovedCount > 0 || historyChanged) {
    scheduleLocalStorePersist();
  }

  const requestedMinutes = Number.parseInt(
    String(req.query.minutes || TRACKING_HISTORY_DEFAULT_MINUTES),
    10
  );
  const historyMinutes = Number.isFinite(requestedMinutes)
    ? Math.max(1, Math.min(TRACKING_HISTORY_MAX_MINUTES, requestedMinutes))
    : TRACKING_HISTORY_DEFAULT_MINUTES;
  const requestedLimit = Number.parseInt(
    String(req.query.limit || TRACKING_HISTORY_DEFAULT_LIMIT),
    10
  );
  const responseLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(TRACKING_HISTORY_MAX_LIMIT, requestedLimit))
    : TRACKING_HISTORY_DEFAULT_LIMIT;

  const sinceMs = nowMs - historyMinutes * 60000;
  const lat = toFiniteNumber(req.query.lat);
  const lng = toFiniteNumber(req.query.lng);
  const radiusKm = toFiniteNumber(req.query.radiusKm) || TRACKING_DEFAULT_RADIUS_KM;
  const requestedVehicleId = String(req.query.vehicleId || '').trim();

  let segments = historicalSegments.filter((segment) => segment.endedAt >= sinceMs);

  if (requestedVehicleId) {
    segments = segments.filter((segment) => segment.vehicleId === requestedVehicleId);
  }

  if (lat != null && lng != null) {
    segments = segments.filter((segment) => {
      const startDistance = haversineDistanceKm(lat, lng, segment.startLat, segment.startLng);
      const endDistance = haversineDistanceKm(lat, lng, segment.endLat, segment.endLng);
      return Math.min(startDistance, endDistance) <= radiusKm;
    });
  }

  if (segments.length > responseLimit) {
    segments = segments.slice(-responseLimit);
  }

  res.json({
    generatedAt: new Date(nowMs).toISOString(),
    minutes: historyMinutes,
    count: segments.length,
    segments: segments.map(serializeTrafficSegment),
  });
});

router.get('/analytics', (req, res) => {
  const nowMs = Date.now();
  const staleRemovedCount = pruneStaleVehicles(nowMs);
  const historyChanged = pruneHistoricalSegments(nowMs);
  if (staleRemovedCount > 0 || historyChanged) {
    scheduleLocalStorePersist();
  }

  const requestedDays = Number.parseInt(
    String(req.query.days || TRACKING_ANALYTICS_DEFAULT_DAYS),
    10
  );
  const analyticsDays = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(TRACKING_ANALYTICS_MAX_DAYS, requestedDays))
    : TRACKING_ANALYTICS_DEFAULT_DAYS;
  const sinceMs = nowMs - analyticsDays * 86400000;

  const lat = toFiniteNumber(req.query.lat);
  const lng = toFiniteNumber(req.query.lng);
  const radiusKm = toFiniteNumber(req.query.radiusKm) || TRACKING_DEFAULT_RADIUS_KM;
  const requestedVehicleId = String(req.query.vehicleId || '').trim();

  let segments = historicalSegments.filter((segment) => segment.endedAt >= sinceMs);

  if (requestedVehicleId) {
    segments = segments.filter((segment) => segment.vehicleId === requestedVehicleId);
  }

  if (lat != null && lng != null) {
    segments = segments.filter((segment) => {
      const startDistance = haversineDistanceKm(lat, lng, segment.startLat, segment.startLng);
      const endDistance = haversineDistanceKm(lat, lng, segment.endLat, segment.endLng);
      return Math.min(startDistance, endDistance) <= radiusKm;
    });
  }

  const dayBuckets = Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    dayLabel: DAY_LABELS[dayIndex],
    segmentCount: 0,
    heavyCount: 0,
    moderateCount: 0,
    lowCount: 0,
    totalSpeedKph: 0,
    speedSampleCount: 0,
    totalDurationMs: 0,
  }));
  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    segmentCount: 0,
    heavyCount: 0,
    moderateCount: 0,
    lowCount: 0,
    totalSpeedKph: 0,
    speedSampleCount: 0,
    totalDurationMs: 0,
  }));

  let totalSpeedKph = 0;
  let totalSpeedSamples = 0;
  let totalDurationMs = 0;
  let heavyCount = 0;
  let moderateCount = 0;
  let lowCount = 0;

  for (const segment of segments) {
    const endedAtMs = toTimestamp(segment.endedAt) || nowMs;
    const startedAtMs = toTimestamp(segment.startedAt) || endedAtMs;
    const durationMs = Math.max(0, endedAtMs - startedAtMs);
    const speedKph = Math.max(0, Number(segment.speedKph) || 0);
    const trafficLevel = ['low', 'moderate', 'heavy'].includes(segment.trafficLevel)
      ? segment.trafficLevel
      : computeTrafficLevelFromSpeed(speedKph);

    const dayIndex = new Date(endedAtMs).getUTCDay();
    const hour = new Date(endedAtMs).getUTCHours();
    const dayBucket = dayBuckets[dayIndex];
    const hourBucket = hourBuckets[hour];

    dayBucket.segmentCount += 1;
    hourBucket.segmentCount += 1;

    dayBucket.totalDurationMs += durationMs;
    hourBucket.totalDurationMs += durationMs;
    totalDurationMs += durationMs;

    dayBucket.totalSpeedKph += speedKph;
    dayBucket.speedSampleCount += 1;
    hourBucket.totalSpeedKph += speedKph;
    hourBucket.speedSampleCount += 1;
    totalSpeedKph += speedKph;
    totalSpeedSamples += 1;

    if (trafficLevel === 'heavy') {
      dayBucket.heavyCount += 1;
      hourBucket.heavyCount += 1;
      heavyCount += 1;
      continue;
    }

    if (trafficLevel === 'moderate') {
      dayBucket.moderateCount += 1;
      hourBucket.moderateCount += 1;
      moderateCount += 1;
      continue;
    }

    dayBucket.lowCount += 1;
    hourBucket.lowCount += 1;
    lowCount += 1;
  }

  const byDay = dayBuckets.map((bucket) => ({
    dayIndex: bucket.dayIndex,
    dayLabel: bucket.dayLabel,
    segmentCount: bucket.segmentCount,
    heavyCount: bucket.heavyCount,
    moderateCount: bucket.moderateCount,
    lowCount: bucket.lowCount,
    averageSpeedKph: bucket.speedSampleCount
      ? Number((bucket.totalSpeedKph / bucket.speedSampleCount).toFixed(1))
      : null,
    averageSegmentMinutes: bucket.segmentCount
      ? Number((bucket.totalDurationMs / bucket.segmentCount / 60000).toFixed(1))
      : null,
  }));

  const byHour = hourBuckets.map((bucket) => ({
    hour: bucket.hour,
    segmentCount: bucket.segmentCount,
    heavyCount: bucket.heavyCount,
    moderateCount: bucket.moderateCount,
    lowCount: bucket.lowCount,
    averageSpeedKph: bucket.speedSampleCount
      ? Number((bucket.totalSpeedKph / bucket.speedSampleCount).toFixed(1))
      : null,
    averageSegmentMinutes: bucket.segmentCount
      ? Number((bucket.totalDurationMs / bucket.segmentCount / 60000).toFixed(1))
      : null,
  }));

  const busiestDay = byDay.reduce((best, current) => {
    if (!best || current.segmentCount > best.segmentCount) {
      return current;
    }
    return best;
  }, null);

  const busiestHour = byHour.reduce((best, current) => {
    if (!best || current.segmentCount > best.segmentCount) {
      return current;
    }
    return best;
  }, null);

  res.json({
    generatedAt: new Date(nowMs).toISOString(),
    timezone: 'UTC',
    days: analyticsDays,
    segmentCount: segments.length,
    averageSpeedKph: totalSpeedSamples
      ? Number((totalSpeedKph / totalSpeedSamples).toFixed(1))
      : null,
    averageSegmentMinutes: segments.length
      ? Number((totalDurationMs / segments.length / 60000).toFixed(1))
      : null,
    trafficLevelBreakdown: {
      heavy: heavyCount,
      moderate: moderateCount,
      low: lowCount,
    },
    busiestDay:
      busiestDay && busiestDay.segmentCount > 0
        ? {
            dayIndex: busiestDay.dayIndex,
            dayLabel: busiestDay.dayLabel,
            segmentCount: busiestDay.segmentCount,
          }
        : null,
    busiestHour:
      busiestHour && busiestHour.segmentCount > 0
        ? {
            hour: busiestHour.hour,
            segmentCount: busiestHour.segmentCount,
          }
        : null,
    byDay,
    byHour,
  });
});

router.post('/update', (req, res) => {
  const nowMs = Date.now();
  const staleRemovedCount = pruneStaleVehicles(nowMs);
  if (staleRemovedCount > 0) {
    scheduleLocalStorePersist();
  }

  const vehicleId = String(req.body?.vehicleId || '').trim();
  const lat = toFiniteNumber(req.body?.lat);
  const lng = toFiniteNumber(req.body?.lng);
  const speedKph = Math.max(0, toFiniteNumber(req.body?.speedKph) || 0);
  const heading = toFiniteNumber(req.body?.heading);

  if (!vehicleId) {
    return res.status(400).json({ error: 'vehicleId is required' });
  }

  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat and lng are required numbers' });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng values are out of range' });
  }

  const previous = vehicleStates.get(vehicleId);
  const state = previous || {
    vehicleId,
    lat,
    lng,
    speedKph,
    heading,
    updatedAt: nowMs,
    isCongested: false,
    lowSpeedStartedAt: null,
    congestionSince: null,
    recentPath: [],
  };

  state.vehicleId = vehicleId;
  state.lat = lat;
  state.lng = lng;
  state.speedKph = speedKph;
  state.heading = heading;
  state.updatedAt = nowMs;
  const segmentSource = appendHistoryPoint(state, nowMs);

  const historicalSegment = buildTrafficSegment(vehicleId, segmentSource, nowMs);
  if (historicalSegment) {
    historicalSegments.push(historicalSegment);
    const historyChanged = pruneHistoricalSegments(nowMs);
    if (historyChanged) {
      scheduleLocalStorePersist();
    }
  }

  const wasCongested = Boolean(state.isCongested);

  if (speedKph <= CONGESTION_SPEED_KPH) {
    if (!state.lowSpeedStartedAt) {
      state.lowSpeedStartedAt = nowMs;
    }

    if (nowMs - state.lowSpeedStartedAt >= CONGESTION_MIN_DURATION_MS) {
      state.isCongested = true;
      if (!state.congestionSince) {
        state.congestionSince = nowMs;
      }
    }
  } else if (speedKph >= CONGESTION_CLEAR_SPEED_KPH) {
    state.lowSpeedStartedAt = null;
    state.isCongested = false;
    state.congestionSince = null;
  }

  vehicleStates.set(vehicleId, state);

  const isCongestedNow = Boolean(state.isCongested);
  if (!wasCongested && isCongestedNow) {
    const alert = buildCongestionAlert(state, nowMs);
    activeAlerts.set(vehicleId, alert);
    broadcastSse('congestion-alert', serializeAlert(alert));
  } else if (wasCongested && !isCongestedNow) {
    activeAlerts.delete(vehicleId);
    broadcastSse('congestion-clear', {
      vehicleId,
      clearedAt: new Date(nowMs).toISOString(),
      reason: 'speed-recovered',
    });
  } else if (isCongestedNow && activeAlerts.has(vehicleId)) {
    const activeAlert = activeAlerts.get(vehicleId);
    activeAlert.lat = state.lat;
    activeAlert.lng = state.lng;
    activeAlert.speedKph = state.speedKph;
    activeAlert.startedAt = state.congestionSince || activeAlert.startedAt || nowMs;
    activeAlert.updatedAt = nowMs;
    activeAlert.message = `Congestion detected for vehicle ${state.vehicleId}`;
    activeAlerts.set(vehicleId, activeAlert);
  }

  const serializedVehicle = serializeVehicle(state);
  broadcastSse('tracking-update', { vehicle: serializedVehicle });
  broadcastSse('snapshot', buildSnapshot());
  scheduleLocalStorePersist();

  res.json({
    ok: true,
    vehicle: serializedVehicle,
    activeAlert: activeAlerts.has(vehicleId) ? serializeAlert(activeAlerts.get(vehicleId)) : null,
  });
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const client = {
    res,
    filterOptions: {
      lat: req.query.lat,
      lng: req.query.lng,
      radiusKm: req.query.radiusKm,
    },
    heartbeatId: setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        // Connection cleanup is handled in req close.
      }
    }, STREAM_HEARTBEAT_MS),
  };

  sseClients.add(client);
  sendSse(res, 'snapshot', filterSnapshotForClient(buildSnapshot(), client.filterOptions));

  req.on('close', () => {
    clearInterval(client.heartbeatId);
    sseClients.delete(client);
  });
});

module.exports = {
  liveTrackingRouter: router,
};
