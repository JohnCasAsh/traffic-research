const express = require('express');

const router = express.Router();

const TRACKING_TTL_MS = Number.parseInt(process.env.TRACKING_TTL_MS || '180000', 10);
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
  process.env.TRACKING_SEGMENT_RETENTION_MS || '86400000',
  10
);
const TRACKING_SEGMENT_MAX_ITEMS = Number.parseInt(
  process.env.TRACKING_SEGMENT_MAX_ITEMS || '25000',
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
const STREAM_HEARTBEAT_MS = 25000;

const vehicleStates = new Map();
const activeAlerts = new Map();
const historicalSegments = [];
const sseClients = new Set();

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

function broadcastSse(eventName, payload) {
  for (const client of sseClients) {
    try {
      sendSse(client.res, eventName, payload);
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
  return {
    vehicleId: alert.vehicleId,
    message: alert.message,
    lat: alert.lat,
    lng: alert.lng,
    speedKph: alert.speedKph,
    startedAt: new Date(alert.startedAt).toISOString(),
    updatedAt: new Date(alert.updatedAt).toISOString(),
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

function pruneHistoricalSegments(nowMs) {
  const lowerTimestamp = nowMs - TRACKING_SEGMENT_RETENTION_MS;
  for (let index = historicalSegments.length - 1; index >= 0; index -= 1) {
    const segment = historicalSegments[index];
    if (segment.endedAt >= lowerTimestamp) {
      continue;
    }

    historicalSegments.splice(index, 1);
  }

  if (historicalSegments.length > TRACKING_SEGMENT_MAX_ITEMS) {
    historicalSegments.splice(0, historicalSegments.length - TRACKING_SEGMENT_MAX_ITEMS);
  }
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
  pruneStaleVehicles(nowMs);

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

setInterval(() => {
  const nowMs = Date.now();
  const removedCount = pruneStaleVehicles(nowMs);
  pruneHistoricalSegments(nowMs);
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
  pruneStaleVehicles(nowMs);
  pruneHistoricalSegments(nowMs);

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

router.post('/update', (req, res) => {
  const nowMs = Date.now();
  pruneStaleVehicles(nowMs);

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
    pruneHistoricalSegments(nowMs);
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
    activeAlert.updatedAt = nowMs;
    activeAlerts.set(vehicleId, activeAlert);
  }

  const serializedVehicle = serializeVehicle(state);
  broadcastSse('tracking-update', { vehicle: serializedVehicle });
  broadcastSse('snapshot', buildSnapshot());

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
    heartbeatId: setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        // Connection cleanup is handled in req close.
      }
    }, STREAM_HEARTBEAT_MS),
  };

  sseClients.add(client);
  sendSse(res, 'snapshot', buildSnapshot());

  req.on('close', () => {
    clearInterval(client.heartbeatId);
    sseClients.delete(client);
  });
});

module.exports = {
  liveTrackingRouter: router,
};
