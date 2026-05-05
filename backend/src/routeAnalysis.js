const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { fetchWithRetry } = require('./resilientFetch');

const router = express.Router();

const GOOGLE_MAPS_API_KEY = (
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.VITE_GOOGLE_MAPS_API_KEY ||
  ''
).trim();

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const ELEVATION_API_URL = 'https://maps.googleapis.com/maps/api/elevation/json';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ROUTES_FIELD_MASK = [
  'routes.routeLabels',
  'routes.description',
  'routes.distanceMeters',
  'routes.duration',
  'routes.staticDuration',
  'routes.polyline.encodedPolyline',
  'routes.travelAdvisory.speedReadingIntervals',
  'routes.warnings',
  'geocodingResults',
].join(',');
const DEFAULT_FUEL_PRICE_BY_TYPE = {
  gasoline: 62.0,
  diesel: 58.5,
  electric: 10.0,
};
const DEFAULT_ANALYZED_ROUTES = 5;
const MAX_ANALYZED_ROUTES = 8;
const MAX_ROUTE_FETCH_TARGET = 5;
const ELEVATION_SAMPLE_POINTS = 45;
const ELEVATION_ANALYSIS_ROUTE_LIMIT = 6;
const ANALYSIS_CONCURRENCY = 3;
const MAX_DETOUR_DISTANCE_RATIO = 1.8;
const MAX_DETOUR_DURATION_RATIO = 1.9;
const MIN_KEEP_ROUTES = 2;
const MAX_SIMILAR_DISTANCE_KM_DELTA = 0.35;
const MAX_SIMILAR_DURATION_MIN_DELTA = 1.5;
const MAX_SIMILAR_COST_PHP_DELTA = 1.2;
const MAX_SIMILAR_FUEL_LITERS_DELTA = 0.03;
const MAX_SIMILAR_ENERGY_KWH_DELTA = 0.05;
const MAX_SIMILAR_CO2_KG_DELTA = 0.08;
const PRIMARY_ROUTES_FETCH_CONFIG = {
  requestName: 'google_routes_compute_routes_primary',
  timeoutMs: 12000,
  maxAttempts: 2,
};
const SECONDARY_ROUTES_FETCH_CONFIG = {
  requestName: 'google_routes_compute_routes_secondary',
  timeoutMs: 7000,
  maxAttempts: 1,
};
const STEEL_BRIDGE_COORD = { lat: 17.6409, lng: 121.7015 };
const BUNTUN_BRIDGE_COORD = { lat: 17.6185, lng: 121.6889 };
const BRIDGE_MATCH_RADIUS_METERS = 850;
const CAGAYAN_ROUTE_HINTS = [
  'solana',
  'tuguegarao',
  'cagayan',
  'caggay',
  'buntun',
  'steel bridge',
  'tuguegarao-solana',
];
const STEEL_BRIDGE_KEYWORDS = ['steel bridge', 'solana bridge', 'tuguegarao-solana'];
const BUNTUN_BRIDGE_KEYWORDS = ['buntun bridge', 'buntun brg'];
const BRIDGE_KEYWORDS = [...STEEL_BRIDGE_KEYWORDS, ...BUNTUN_BRIDGE_KEYWORDS];
const CO2_FACTORS = {
  gasoline: 2.31,
  diesel: 2.68,
  electric: 0.72,
};
const TRIP_REPORTS_FILE = process.env.TRIP_REPORTS_FILE || './data/trip-reports.json';

let cachedGoogleAccessToken = null;
let cachedGoogleAccessTokenExpiryMs = 0;

function resolveTripReportsPath() {
  if (path.isAbsolute(TRIP_REPORTS_FILE)) {
    return TRIP_REPORTS_FILE;
  }

  return path.join(__dirname, '..', TRIP_REPORTS_FILE);
}

function readTripReports() {
  try {
    const filePath = resolveTripReportsPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTripReports(records) {
  try {
    const filePath = resolveTripReportsPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(records.slice(0, 1000), null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to persist trip reports:', error.message);
  }
}

function loadFirebaseCredentialsFromFilePath(filePath) {
  if (!filePath) {
    return null;
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(__dirname, '..', filePath);

  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) {
      return null;
    }

    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  } catch {
    return null;
  }
}

function getFirebaseServiceAccountCredentials() {
  // Prefer base64-encoded full JSON (most reliable across environments)
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    try {
      const parsed = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      if (parsed.client_email && parsed.private_key) {
        return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
      }
    } catch {}
  }

  const inlineClientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const inlinePrivateKeyRaw = String(process.env.FIREBASE_PRIVATE_KEY || '').trim();

  if (inlineClientEmail && inlinePrivateKeyRaw) {
    return {
      clientEmail: inlineClientEmail,
      privateKey: inlinePrivateKeyRaw
        .replace(/^"|"$/g, '')
        .replace(/\r/g, '')
        .replace(/\\n/g, '\n'),
    };
  }

  return loadFirebaseCredentialsFromFilePath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

async function getGoogleAccessToken() {
  if (
    cachedGoogleAccessToken &&
    Number.isFinite(cachedGoogleAccessTokenExpiryMs) &&
    Date.now() < cachedGoogleAccessTokenExpiryMs - 60_000
  ) {
    return cachedGoogleAccessToken;
  }

  const credentials = getFirebaseServiceAccountCredentials();
  if (!credentials) {
    throw new Error(
      'No Firebase service account credentials are configured for OAuth route analysis.'
    );
  }

  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: credentials.clientEmail,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: GOOGLE_OAUTH_TOKEN_URL,
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + 3600,
    },
    credentials.privateKey,
    {
      algorithm: 'RS256',
      header: { typ: 'JWT' },
    }
  );

  const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const tokenPayload = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    throw new Error(
      `Failed to obtain OAuth token for Routes API${
        tokenPayload?.error ? `: ${tokenPayload.error}` : ''
      }${tokenPayload?.error_description ? ` (${tokenPayload.error_description})` : ''}`
    );
  }

  cachedGoogleAccessToken = tokenPayload.access_token;
  cachedGoogleAccessTokenExpiryMs =
    Date.now() + Math.max(300, Number(tokenPayload.expires_in) || 3600) * 1000;

  return cachedGoogleAccessToken;
}

const VEHICLE_PROFILES = {
  motorcycle: {
    key: 'motorcycle',
    label: 'Motorcycle',
    powertrain: 'ICE',
    massKg: 150,
    idleRateLitersPerMinute: 0.003,
    restartLiters: 0.008,
    engineEfficiency: 0.28,
    fuelType: 'gasoline',
    travelMode: 'TWO_WHEELER',
    // VSP at steady-state gives ~376 km/L for 150 kg; real PH city driving ~35 km/L → 11×
    realWorldFactor: 11,
  },
  tricycle: {
    key: 'tricycle',
    label: 'Tricycle',
    powertrain: 'ICE',
    massKg: 350,
    idleRateLitersPerMinute: 0.004,
    restartLiters: 0.008,
    engineEfficiency: 0.24,
    fuelType: 'gasoline',
    travelMode: 'DRIVE',
    // VSP gives ~138 km/L for 350 kg; real PH city driving ~22 km/L → 6×
    realWorldFactor: 6,
  },
  sedan: {
    key: 'sedan',
    label: 'Sedan / Private Car',
    powertrain: 'ICE',
    massKg: 1200,
    idleRateLitersPerMinute: 0.008,
    restartLiters: 0.008,
    engineEfficiency: 0.26,
    fuelType: 'gasoline',
    travelMode: 'DRIVE',
    // VSP gives ~44 km/L for 1200 kg; real PH city driving ~10 km/L → 4.5×
    realWorldFactor: 4.5,
  },
  private_car: {
    key: 'private_car',
    label: 'Sedan / Private Car',
    powertrain: 'ICE',
    massKg: 1200,
    idleRateLitersPerMinute: 0.008,
    restartLiters: 0.008,
    engineEfficiency: 0.26,
    fuelType: 'gasoline',
    travelMode: 'DRIVE',
    realWorldFactor: 4.5,
  },
  van: {
    key: 'van',
    label: 'Van',
    powertrain: 'ICE',
    massKg: 2000,
    idleRateLitersPerMinute: 0.012,
    restartLiters: 0.008,
    engineEfficiency: 0.28,
    fuelType: 'diesel',
    travelMode: 'DRIVE',
    // VSP gives ~34 km/L for 2000 kg diesel; real PH city ~7 km/L → 5×
    realWorldFactor: 5,
  },
  bus: {
    key: 'bus',
    label: 'Bus',
    powertrain: 'ICE',
    massKg: 8000,
    idleRateLitersPerMinute: 0.025,
    restartLiters: 0.008,
    engineEfficiency: 0.36,
    fuelType: 'diesel',
    travelMode: 'DRIVE',
    // VSP gives ~11 km/L for 8000 kg diesel; real PH city ~4 km/L → 2.75×
    realWorldFactor: 2.75,
  },
  hybrid_car: {
    key: 'hybrid_car',
    label: 'Hybrid Car',
    powertrain: 'HEV',
    massKg: 1350,
    idleRateLitersPerMinute: 0.005,
    restartLiters: 0.006,
    engineEfficiency: 0.38,
    fuelType: 'gasoline',
    travelMode: 'DRIVE',
    // VSP gives ~57 km/L for 1350 kg HEV; real PH city ~17 km/L → 3.5×
    realWorldFactor: 3.5,
  },
  hybrid_van: {
    key: 'hybrid_van',
    label: 'Hybrid Van',
    powertrain: 'HEV',
    massKg: 2100,
    idleRateLitersPerMinute: 0.008,
    restartLiters: 0.006,
    engineEfficiency: 0.36,
    fuelType: 'gasoline',
    travelMode: 'DRIVE',
    realWorldFactor: 4,
  },
  e_trike: {
    key: 'e_trike',
    label: 'E-Trike',
    powertrain: 'BEV',
    massKg: 400,
    idleRateLitersPerMinute: 0,
    restartLiters: 0,
    drivetrainEfficiency: 0.88,
    regenEfficiency: 0.35,
    fuelType: 'electric',
    travelMode: 'DRIVE',
  },
  e_motorcycle: {
    key: 'e_motorcycle',
    label: 'E-Motorcycle',
    powertrain: 'BEV',
    massKg: 170,
    idleRateLitersPerMinute: 0,
    restartLiters: 0,
    drivetrainEfficiency: 0.9,
    regenEfficiency: 0.3,
    fuelType: 'electric',
    travelMode: 'TWO_WHEELER',
  },
  suv: {
    key: 'suv',
    label: 'Van',
    powertrain: 'ICE',
    massKg: 2000,
    idleRateLitersPerMinute: 0.012,
    restartLiters: 0.008,
    engineEfficiency: 0.28,
    fuelType: 'diesel',
    travelMode: 'DRIVE',
    realWorldFactor: 5,
  },
  truck: {
    key: 'truck',
    label: 'Bus',
    powertrain: 'ICE',
    massKg: 8000,
    idleRateLitersPerMinute: 0.025,
    restartLiters: 0.008,
    engineEfficiency: 0.36,
    fuelType: 'diesel',
    travelMode: 'DRIVE',
    realWorldFactor: 2.75,
  },
  electric: {
    key: 'electric',
    label: 'E-Car',
    powertrain: 'BEV',
    massKg: 1600,
    idleRateLitersPerMinute: 0,
    restartLiters: 0,
    drivetrainEfficiency: 0.9,
    regenEfficiency: 0.4,
    fuelType: 'electric',
    travelMode: 'DRIVE',
  },
  hybrid: {
    key: 'hybrid',
    label: 'Hybrid Car',
    powertrain: 'HEV',
    massKg: 1350,
    idleRateLitersPerMinute: 0.005,
    restartLiters: 0.006,
    engineEfficiency: 0.38,
    fuelType: 'gasoline',
    travelMode: 'DRIVE',
    realWorldFactor: 3.5,
  },
  etrike: {
    key: 'etrike',
    label: 'E-Trike',
    powertrain: 'BEV',
    massKg: 400,
    idleRateLitersPerMinute: 0,
    restartLiters: 0,
    drivetrainEfficiency: 0.88,
    regenEfficiency: 0.35,
    fuelType: 'electric',
    travelMode: 'DRIVE',
  },
  emotorcycle: {
    key: 'emotorcycle',
    label: 'E-Motorcycle',
    powertrain: 'BEV',
    massKg: 170,
    idleRateLitersPerMinute: 0,
    restartLiters: 0,
    drivetrainEfficiency: 0.9,
    regenEfficiency: 0.3,
    fuelType: 'electric',
    travelMode: 'TWO_WHEELER',
  },
};

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveRequestedRouteLimit(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_ANALYZED_ROUTES), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ANALYZED_ROUTES;
  }

  return Math.max(1, Math.min(MAX_ANALYZED_ROUTES, parsed));
}

function parseDurationSeconds(durationText) {
  if (typeof durationText !== 'string') {
    return 0;
  }

  const normalized = durationText.trim();
  if (!normalized.endsWith('s')) {
    return 0;
  }

  const parsed = Number(normalized.slice(0, -1));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function haversineDistanceMeters(from, to) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') {
    return [];
  }

  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const latitudeChange = result & 1 ? ~(result >> 1) : result >> 1;
    lat += latitudeChange;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const longitudeChange = result & 1 ? ~(result >> 1) : result >> 1;
    lng += longitudeChange;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}

function normalizeWaypoint(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const coordinateMatch = text.match(
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/
  );

  if (coordinateMatch) {
    const latitude = Number(coordinateMatch[1]);
    const longitude = Number(coordinateMatch[2]);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return {
        location: {
          latLng: {
            latitude,
            longitude,
          },
        },
      };
    }
  }

  return {
    address: text,
  };
}

function normalizeAddressText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isLikelyCagayanTrip(originText, destinationText) {
  const combined = normalizeAddressText(`${originText || ''} ${destinationText || ''}`);
  return includesAnyKeyword(combined, CAGAYAN_ROUTE_HINTS);
}

function isLikelySolanaTrip(originText, destinationText) {
  const originNormalized = normalizeAddressText(originText || '');
  const destinationNormalized = normalizeAddressText(destinationText || '');

  return originNormalized === 'solana' || destinationNormalized === 'solana';
}

function buildIntermediateWaypoint(coordinate) {
  return {
    location: {
      latLng: {
        latitude: coordinate.lat,
        longitude: coordinate.lng,
      },
    },
  };
}

function routePassesNearCoordinate(route, coordinate, radiusMeters = BRIDGE_MATCH_RADIUS_METERS) {
  const decodedPoints = decodePolyline(route?.polyline?.encodedPolyline || '');
  if (!decodedPoints.length) {
    return false;
  }

  return decodedPoints.some((point) => haversineDistanceMeters(point, coordinate) <= radiusMeters);
}

function routeContainsKeyword(route, keywords) {
  const text = normalizeAddressText(
    `${route?.description || ''} ${(Array.isArray(route?.warnings) ? route.warnings.join(' ') : '')}`
  );
  return includesAnyKeyword(text, keywords);
}

function routeUsesSteelBridge(route) {
  return (
    routePassesNearCoordinate(route, STEEL_BRIDGE_COORD) ||
    routeContainsKeyword(route, STEEL_BRIDGE_KEYWORDS)
  );
}

function routeUsesBuntunBridge(route) {
  return (
    routePassesNearCoordinate(route, BUNTUN_BRIDGE_COORD) ||
    routeContainsKeyword(route, BUNTUN_BRIDGE_KEYWORDS)
  );
}

function hasBridgeMatch(route, requiredBridge) {
  if (requiredBridge === 'steel') {
    return routeUsesSteelBridge(route);
  }

  if (requiredBridge === 'buntun') {
    return routeUsesBuntunBridge(route);
  }

  return routeUsesSteelBridge(route) || routeUsesBuntunBridge(route);
}

function getVehicleProfile(vehicleType, fuelType) {
  const normalizedVehicleType = String(vehicleType || 'sedan')
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, '_');
  const fallback = VEHICLE_PROFILES.sedan;
  const baseProfile = VEHICLE_PROFILES[normalizedVehicleType] || fallback;

  return {
    ...baseProfile,
    fuelType:
      String(fuelType || '').trim().toLowerCase() ||
      baseProfile.fuelType ||
      fallback.fuelType,
  };
}

function buildRoutesRequest(origin, destination, vehicleProfile) {
  return {
    origin,
    destination,
    travelMode: vehicleProfile.travelMode,
    routingPreference: 'TRAFFIC_AWARE',
    polylineQuality: 'HIGH_QUALITY',
    polylineEncoding: 'ENCODED_POLYLINE',
    computeAlternativeRoutes: true,
    languageCode: 'en-US',
    regionCode: 'ph',
    extraComputations: ['TRAFFIC_ON_POLYLINE'],
    departureTime: new Date(Date.now() + 60_000).toISOString(),
  };
}

function resolvePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mergeRoutesFetchConfig(config = {}, fallbackRequestName) {
  return {
    requestName: String(config.requestName || fallbackRequestName),
    timeoutMs: resolvePositiveInteger(config.timeoutMs, 15000),
    maxAttempts: resolvePositiveInteger(config.maxAttempts, 2),
  };
}

async function fetchRoutesWithApiKey(requestBody, requestConfig = {}) {
  const mergedConfig = mergeRoutesFetchConfig(
    requestConfig,
    'google_routes_compute_routes'
  );
  const response = await fetchWithRetry(
    ROUTES_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    },
    mergedConfig
  );

  return response.json();
}

async function fetchRoutesWithOAuth(requestBody, requestConfig = {}) {
  const mergedConfig = mergeRoutesFetchConfig(
    requestConfig,
    'google_routes_compute_routes_oauth'
  );
  const accessToken = await getGoogleAccessToken();

  const response = await fetchWithRetry(
    ROUTES_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    },
    mergedConfig
  );

  return response.json();
}

async function fetchRoutes(requestBody, requestConfig = {}) {
  const hasApiKey = Boolean(GOOGLE_MAPS_API_KEY);
  const hasOAuthCredentials = Boolean(getFirebaseServiceAccountCredentials());

  if (!hasApiKey && !hasOAuthCredentials) {
    throw new Error(
      'No Google credentials configured for route analysis (API key or Firebase service account).'
    );
  }

  if (hasApiKey) {
    try {
      return await fetchRoutesWithApiKey(requestBody, requestConfig);
    } catch (apiKeyError) {
      if (!hasOAuthCredentials) {
        throw apiKeyError;
      }

      console.warn(
        'Routes API key request failed, retrying with OAuth service account:',
        apiKeyError.message
      );
    }
  }

  return fetchRoutesWithOAuth(requestBody, requestConfig);
}

function buildRouteFingerprint(route) {
  const encoded = String(route?.polyline?.encodedPolyline || '').trim();
  if (encoded) {
    return `poly:${encoded}`;
  }

  const distanceMeters = Number(route?.distanceMeters || 0);
  const durationSeconds = parseDurationSeconds(route?.duration);
  const staticDurationSeconds = parseDurationSeconds(route?.staticDuration);
  return `fallback:${distanceMeters}:${durationSeconds}:${staticDurationSeconds}`;
}

function buildRouteApproxFingerprint(route) {
  const distanceMeters = Number(route?.distanceMeters || 0);
  const durationSeconds = parseDurationSeconds(route?.duration);
  const staticDurationSeconds = parseDurationSeconds(route?.staticDuration);
  const decodedPoints = decodePolyline(route?.polyline?.encodedPolyline || '');

  const pointIndexes = decodedPoints.length
    ? [
        0,
        Math.floor(decodedPoints.length / 3),
        Math.floor((decodedPoints.length * 2) / 3),
        decodedPoints.length - 1,
      ]
    : [];

  const pointSignature = pointIndexes
    .map((index) => decodedPoints[index])
    .filter(Boolean)
    .map((point) => `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`)
    .join(';');

  const distanceBucket = Math.round(distanceMeters / 120);
  const durationBucket = Math.round(durationSeconds / 45);
  const staticDurationBucket = Math.round(staticDurationSeconds / 45);

  return `${distanceBucket}|${durationBucket}|${staticDurationBucket}|${pointSignature}`;
}

function removeOutlierRoutes(routes, minKeepRoutes = MIN_KEEP_ROUTES) {
  if (!Array.isArray(routes) || routes.length <= minKeepRoutes) {
    return Array.isArray(routes) ? routes : [];
  }

  const distanceValues = routes
    .map((route) => Number(route?.distanceMeters || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const durationValues = routes
    .map((route) => parseDurationSeconds(route?.duration))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!distanceValues.length || !durationValues.length) {
    return routes;
  }

  const minDistance = Math.min(...distanceValues);
  const minDuration = Math.min(...durationValues);

  const filteredRoutes = routes.filter((route) => {
    const distanceMeters = Number(route?.distanceMeters || 0);
    const durationSeconds = parseDurationSeconds(route?.duration);

    if (
      !Number.isFinite(distanceMeters) ||
      !Number.isFinite(durationSeconds) ||
      distanceMeters <= 0 ||
      durationSeconds <= 0
    ) {
      return true;
    }

    const distanceRatio = distanceMeters / minDistance;
    const durationRatio = durationSeconds / minDuration;
    const isOutlier =
      distanceRatio > MAX_DETOUR_DISTANCE_RATIO &&
      durationRatio > MAX_DETOUR_DURATION_RATIO;

    return !isOutlier;
  });

  if (filteredRoutes.length >= minKeepRoutes) {
    return filteredRoutes;
  }

  return [...routes]
    .sort((left, right) => {
      const leftDistance = Number(left?.distanceMeters || Number.POSITIVE_INFINITY);
      const rightDistance = Number(right?.distanceMeters || Number.POSITIVE_INFINITY);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return parseDurationSeconds(left?.duration) - parseDurationSeconds(right?.duration);
    })
    .slice(0, minKeepRoutes);
}

function buildAnalyzedRouteShapeSignature(route) {
  const decodedPoints = decodePolyline(route?.encodedPolyline || '');
  if (!decodedPoints.length) {
    return '';
  }

  const pointIndexes = [
    0,
    Math.floor(decodedPoints.length / 3),
    Math.floor((decodedPoints.length * 2) / 3),
    decodedPoints.length - 1,
  ];

  return pointIndexes
    .map((index) => decodedPoints[index])
    .filter(Boolean)
    .map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`)
    .join(';');
}

function isNearDuplicateAnalyzedRoute(leftRoute, rightRoute, fuelType) {
  if (!leftRoute || !rightRoute) {
    return false;
  }

  const leftShapeSignature = buildAnalyzedRouteShapeSignature(leftRoute);
  const rightShapeSignature = buildAnalyzedRouteShapeSignature(rightRoute);
  const hasComparableShape = Boolean(leftShapeSignature && rightShapeSignature);
  if (hasComparableShape && leftShapeSignature !== rightShapeSignature) {
    return false;
  }

  const distanceDelta = Math.abs(Number(leftRoute.distanceKm || 0) - Number(rightRoute.distanceKm || 0));
  const durationDelta = Math.abs(
    Number(leftRoute.durationMinutes || 0) - Number(rightRoute.durationMinutes || 0)
  );
  const costDelta = Math.abs(
    Number(leftRoute.estimatedCostPhp || 0) - Number(rightRoute.estimatedCostPhp || 0)
  );
  const co2Delta = Math.abs(Number(leftRoute.co2Kg || 0) - Number(rightRoute.co2Kg || 0));

  const unitUsageDelta =
    fuelType === 'electric'
      ? Math.abs(Number(leftRoute.totalEnergyKwh || 0) - Number(rightRoute.totalEnergyKwh || 0))
      : Math.abs(Number(leftRoute.totalFuelLiters || 0) - Number(rightRoute.totalFuelLiters || 0));

  const usageThreshold =
    fuelType === 'electric' ? MAX_SIMILAR_ENERGY_KWH_DELTA : MAX_SIMILAR_FUEL_LITERS_DELTA;

  return (
    distanceDelta <= MAX_SIMILAR_DISTANCE_KM_DELTA &&
    durationDelta <= MAX_SIMILAR_DURATION_MIN_DELTA &&
    costDelta <= MAX_SIMILAR_COST_PHP_DELTA &&
    unitUsageDelta <= usageThreshold &&
    co2Delta <= MAX_SIMILAR_CO2_KG_DELTA
  );
}

function removeNearDuplicateAnalyzedRoutes(routes, fuelType, minKeepRoutes = MIN_KEEP_ROUTES) {
  if (!Array.isArray(routes) || routes.length < 2) {
    return Array.isArray(routes) ? routes : [];
  }

  const uniqueRoutes = [];

  for (const route of routes) {
    const duplicateIndex = uniqueRoutes.findIndex((existingRoute) =>
      isNearDuplicateAnalyzedRoute(existingRoute, route, fuelType)
    );

    if (duplicateIndex === -1) {
      uniqueRoutes.push(route);
      continue;
    }

    const existingRoute = uniqueRoutes[duplicateIndex];
    const preserveExistingGoogle = existingRoute.isGoogleRecommended && !route.isGoogleRecommended;
    if (preserveExistingGoogle) {
      continue;
    }

    const preferIncomingGoogle = route.isGoogleRecommended && !existingRoute.isGoogleRecommended;
    const preferLowerDuration =
      Number(route.durationMinutes || 0) < Number(existingRoute.durationMinutes || 0) - 0.2;
    const nearlySameDuration =
      Math.abs(Number(route.durationMinutes || 0) - Number(existingRoute.durationMinutes || 0)) <=
      0.2;
    const preferLowerCost =
      Number(route.estimatedCostPhp || 0) < Number(existingRoute.estimatedCostPhp || 0);

    if (preferIncomingGoogle || preferLowerDuration || (nearlySameDuration && preferLowerCost)) {
      uniqueRoutes[duplicateIndex] = route;
    }
  }

  if (uniqueRoutes.length >= minKeepRoutes) {
    return uniqueRoutes;
  }

  const seenFingerprints = new Set(
    uniqueRoutes.map((route) => buildAnalyzedRouteShapeSignature(route) || route.id)
  );
  const candidates = [...routes]
    .sort((left, right) => Number(left.durationMinutes || 0) - Number(right.durationMinutes || 0));

  for (const candidate of candidates) {
    if (uniqueRoutes.length >= minKeepRoutes) {
      break;
    }

    const candidateFingerprint = buildAnalyzedRouteShapeSignature(candidate) || candidate.id;
    if (seenFingerprints.has(candidateFingerprint)) {
      continue;
    }

    seenFingerprints.add(candidateFingerprint);
    uniqueRoutes.push(candidate);
  }

  return uniqueRoutes;
}

function addUniqueRoutes(
  targetRoutes,
  sourceRoutes,
  seenFingerprints,
  seenApproxFingerprints,
  maxRoutes = MAX_ANALYZED_ROUTES
) {
  if (!Array.isArray(sourceRoutes)) {
    return;
  }

  for (const route of sourceRoutes) {
    if (!route || typeof route !== 'object') {
      continue;
    }

    const fingerprint = buildRouteFingerprint(route);
    if (seenFingerprints.has(fingerprint)) {
      continue;
    }

    seenFingerprints.add(fingerprint);
    targetRoutes.push(route);

    if (targetRoutes.length >= maxRoutes) {
      return;
    }
  }
}

async function fetchRoutesWithFallbackStrategies(
  baseRequestBody,
  desiredRoutes = DEFAULT_ANALYZED_ROUTES,
  maxRoutes = MAX_ANALYZED_ROUTES,
  routeContext = {}
) {
  const mergedRoutes = [];
  const seenFingerprints = new Set();
  const seenApproxFingerprints = new Set();
  const originText = String(routeContext?.originText || '');
  const destinationText = String(routeContext?.destinationText || '');
  const normalizedTripText = normalizeAddressText(`${originText} ${destinationText}`);
  const explicitBridgeRequest = includesAnyKeyword(normalizedTripText, BRIDGE_KEYWORDS);
  const isSolanaTrip = isLikelySolanaTrip(originText, destinationText);
  const requiredBridge = isSolanaTrip ? 'steel' : explicitBridgeRequest ? 'any' : null;
  const shouldBridgeAlign = Boolean(requiredBridge);
  const hasRequiredBridgeRoute = (routes) => {
    if (!requiredBridge) {
      return true;
    }

    return routes.some((route) => hasBridgeMatch(route, requiredBridge));
  };

  const finalizeRoutes = () => {
    const minKeepRoutes = Math.min(Math.max(MIN_KEEP_ROUTES, 1), desiredRoutes);
    const prunedRoutes = removeOutlierRoutes(mergedRoutes, minKeepRoutes);

    if (
      requiredBridge &&
      !hasRequiredBridgeRoute(prunedRoutes) &&
      hasRequiredBridgeRoute(mergedRoutes)
    ) {
      const firstBridgeRoute = mergedRoutes.find((route) =>
        hasBridgeMatch(route, requiredBridge)
      );

      if (!firstBridgeRoute) {
        return prunedRoutes.slice(0, desiredRoutes);
      }

      const strictFingerprint = buildRouteFingerprint(firstBridgeRoute);
      const routeWithBridge = prunedRoutes.some(
        (route) => buildRouteFingerprint(route) === strictFingerprint
      );

      if (!routeWithBridge) {
        prunedRoutes.push(firstBridgeRoute);
      }
    }

    return prunedRoutes.slice(0, desiredRoutes);
  };

  const primaryPayload = await fetchRoutes(baseRequestBody, PRIMARY_ROUTES_FETCH_CONFIG);
  addUniqueRoutes(
    mergedRoutes,
    primaryPayload?.routes,
    seenFingerprints,
    seenApproxFingerprints,
    maxRoutes
  );

  if (mergedRoutes.length >= desiredRoutes && hasRequiredBridgeRoute(mergedRoutes)) {
    return {
      geocodingResults: primaryPayload?.geocodingResults || null,
      routes: finalizeRoutes(),
    };
  }

  const requestVariants = [
    {
      ...baseRequestBody,
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes: true,
      departureTime: new Date(Date.now() + 60_000).toISOString(),
    },
  ];

  for (const requestVariant of requestVariants) {
    if (mergedRoutes.length >= desiredRoutes && hasRequiredBridgeRoute(mergedRoutes)) {
      break;
    }

    try {
      const payload = await fetchRoutes(requestVariant, SECONDARY_ROUTES_FETCH_CONFIG);
      addUniqueRoutes(
        mergedRoutes,
        payload?.routes,
        seenFingerprints,
        seenApproxFingerprints,
        maxRoutes
      );
    } catch (error) {
      console.warn(
        'Additional route variant failed:',
        requestVariant?.routingPreference || 'unknown',
        error?.message || error
      );
    }
  }

  if (shouldBridgeAlign && !hasRequiredBridgeRoute(mergedRoutes)) {
    const bridgeStrategies = [
      {
        label: 'steel-bridge',
        coordinate: STEEL_BRIDGE_COORD,
        matcher: routeUsesSteelBridge,
      },
      {
        label: 'buntun-bridge',
        coordinate: BUNTUN_BRIDGE_COORD,
        matcher: routeUsesBuntunBridge,
      },
    ].filter((strategy) => (isSolanaTrip ? strategy.label === 'steel-bridge' : true));

    for (const strategy of bridgeStrategies) {
      if (hasRequiredBridgeRoute(mergedRoutes)) {
        break;
      }

      try {
        const bridgePayload = await fetchRoutes(
          {
            ...baseRequestBody,
            computeAlternativeRoutes: false,
            intermediates: [buildIntermediateWaypoint(strategy.coordinate)],
          },
          SECONDARY_ROUTES_FETCH_CONFIG
        );

        const matchingBridgeRoutes = Array.isArray(bridgePayload?.routes)
          ? bridgePayload.routes.filter((route) => strategy.matcher(route))
          : [];

        if (!matchingBridgeRoutes.length) {
          continue;
        }

        if (mergedRoutes.length >= maxRoutes && !hasRequiredBridgeRoute(mergedRoutes)) {
          const removedRoute = mergedRoutes.pop();
          if (removedRoute) {
            seenFingerprints.delete(buildRouteFingerprint(removedRoute));
            const removedApproxFingerprint = buildRouteApproxFingerprint(removedRoute);
            if (removedApproxFingerprint) {
              seenApproxFingerprints.delete(removedApproxFingerprint);
            }
          }
        }

        addUniqueRoutes(
          mergedRoutes,
          matchingBridgeRoutes,
          seenFingerprints,
          seenApproxFingerprints,
          maxRoutes
        );
      } catch (error) {
        console.warn(
          'Bridge-aligned route strategy failed:',
          strategy.label,
          error?.message || error
        );
      }
    }
  }

  if (mergedRoutes.length < desiredRoutes) {
    const routeFallbackStrategies = [
      {
        label: 'avoid-highways',
        buildRequest: () => ({
          ...baseRequestBody,
          computeAlternativeRoutes: false,
          routeModifiers: { avoidHighways: true },
        }),
      },
      {
        label: 'avoid-tolls',
        buildRequest: () => ({
          ...baseRequestBody,
          computeAlternativeRoutes: false,
          routeModifiers: { avoidTolls: true },
        }),
      },
      {
        label: 'traffic-unaware',
        buildRequest: () => {
          const { departureTime, ...requestWithoutDeparture } = baseRequestBody;
          return {
            ...requestWithoutDeparture,
            routingPreference: 'TRAFFIC_UNAWARE',
            computeAlternativeRoutes: false,
          };
        },
      },
    ];

    for (const strategy of routeFallbackStrategies) {
      if (mergedRoutes.length >= desiredRoutes && hasRequiredBridgeRoute(mergedRoutes)) {
        break;
      }

      try {
        const payload = await fetchRoutes(
          strategy.buildRequest(),
          SECONDARY_ROUTES_FETCH_CONFIG
        );

        addUniqueRoutes(
          mergedRoutes,
          payload?.routes,
          seenFingerprints,
          seenApproxFingerprints,
          maxRoutes
        );
      } catch (error) {
        console.warn(
          'Fallback route strategy failed:',
          strategy.label,
          error?.message || error
        );
      }
    }
  }

  if (mergedRoutes.length >= desiredRoutes && hasRequiredBridgeRoute(mergedRoutes)) {
    return {
      geocodingResults: primaryPayload?.geocodingResults || null,
      routes: finalizeRoutes(),
    };
  }

  return {
    geocodingResults: primaryPayload?.geocodingResults || null,
    routes: finalizeRoutes(),
  };
}

function samplePathPoints(points, maxPoints = 80) {
  if (!Array.isArray(points) || points.length <= maxPoints) {
    return Array.isArray(points) ? points : [];
  }

  const sampled = [];
  const lastIndex = points.length - 1;

  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index / (maxPoints - 1)) * lastIndex);
    sampled.push(points[pointIndex]);
  }

  return sampled;
}

async function mapWithConcurrency(items, maxConcurrency, mapper) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const safeConcurrency = Math.max(1, Math.min(maxConcurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: safeConcurrency }, () => worker())
  );

  return results;
}

async function fetchElevations(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return [];
  }

  const sampledPoints = samplePathPoints(points, ELEVATION_SAMPLE_POINTS);
  if (!GOOGLE_MAPS_API_KEY) {
    return sampledPoints.map(() => null);
  }

  const locationText = sampledPoints
    .map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)
    .join('|');

  const url = `${ELEVATION_API_URL}?locations=${encodeURIComponent(locationText)}&key=${encodeURIComponent(
    GOOGLE_MAPS_API_KEY
  )}`;
  let payload = null;
  try {
    const response = await fetchWithRetry(url, undefined, {
      requestName: 'google_elevation_sampled_points',
      timeoutMs: 8000,
      maxAttempts: 1,
    });
    payload = await response.json();
  } catch (error) {
    console.warn('Elevation lookup failed; continuing with flat-grade estimate:', error?.message || error);
    return sampledPoints.map(() => null);
  }

  if (payload.status !== 'OK' || !Array.isArray(payload.results)) {
    return sampledPoints.map(() => null);
  }

  return payload.results.map((item) => toFiniteNumber(item?.elevation));
}

function buildTrafficIndexLookup(route) {
  const intervals = Array.isArray(route?.travelAdvisory?.speedReadingIntervals)
    ? route.travelAdvisory.speedReadingIntervals
    : [];
  const lookup = new Map();

  for (const interval of intervals) {
    const start = Math.max(0, Number(interval?.startPolylinePointIndex) || 0);
    const end = Math.max(start + 1, Number(interval?.endPolylinePointIndex) || start + 1);
    const speedCategory = String(interval?.speed || 'NORMAL').toUpperCase();

    for (let index = start; index < end; index += 1) {
      lookup.set(index, speedCategory);
    }
  }

  return lookup;
}

function getTrafficMultiplier(speedCategory) {
  switch (speedCategory) {
    case 'TRAFFIC_JAM':
      return 0.35;
    case 'SLOW':
      return 0.72;
    default:
      return 1.08;
  }
}

function energyDensityKwhPerLiter(fuelType) {
  if (fuelType === 'diesel') {
    return 10.7;
  }

  return 8.9;
}

function computeTrafficLevel(trafficJamShare, slowShare) {
  if (trafficJamShare >= 0.25 || trafficJamShare + slowShare >= 0.6) {
    return 'heavy';
  }

  if (trafficJamShare >= 0.08 || trafficJamShare + slowShare >= 0.3) {
    return 'moderate';
  }

  return 'low';
}

function mean(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values) {
  if (!values.length) {
    return 0;
  }

  const average = mean(values);
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function analyzeRoute(route, routeIndex, vehicleProfile, fuelPrice, elevations) {
  const encodedPolyline = route?.polyline?.encodedPolyline || '';
  const decodedPoints = decodePolyline(encodedPolyline);
  const pointCount = decodedPoints.length;
  const sampledPoints = samplePathPoints(decodedPoints, elevations.length || pointCount);

  const distanceMeters = Math.max(1, Number(route?.distanceMeters) || 0);
  const durationSeconds = Math.max(1, parseDurationSeconds(route?.duration));
  const staticDurationSeconds = Math.max(1, parseDurationSeconds(route?.staticDuration));
  const averageSpeedMpsBase = distanceMeters / durationSeconds;
  const trafficLookup = buildTrafficIndexLookup(route);

  let movingFuelLiters = 0;
  let movingEnergyKwh = 0;
  let idleSeconds = Math.max(0, durationSeconds - staticDurationSeconds);
  let stopCount = 0;
  let previousSpeedMps = averageSpeedMpsBase;
  let previousSpeedCategory = 'NORMAL';
  let maxVspKwPerTon = 0;
  const vspSamples = [];
  const speedSamplesMps = [];
  let jamDistanceMeters = 0;
  let slowDistanceMeters = 0;

  for (let index = 1; index < sampledPoints.length; index += 1) {
    const previousPoint = sampledPoints[index - 1];
    const nextPoint = sampledPoints[index];
    const segmentDistanceMeters = haversineDistanceMeters(previousPoint, nextPoint);

    if (!Number.isFinite(segmentDistanceMeters) || segmentDistanceMeters < 1) {
      continue;
    }

    const speedCategory = trafficLookup.get(index - 1) || previousSpeedCategory;
    previousSpeedCategory = speedCategory;
    const trafficMultiplier = getTrafficMultiplier(speedCategory);
    const segmentSpeedMps = clamp(averageSpeedMpsBase * trafficMultiplier, 1.2, 33.33);
    const segmentDurationSeconds = segmentDistanceMeters / segmentSpeedMps;
    const accelerationMps2 = (segmentSpeedMps - previousSpeedMps) / Math.max(segmentDurationSeconds, 1);
    previousSpeedMps = segmentSpeedMps;

    let grade = 0;
    if (
      Number.isFinite(elevations[index]) &&
      Number.isFinite(elevations[index - 1]) &&
      segmentDistanceMeters > 0
    ) {
      grade = (elevations[index] - elevations[index - 1]) / segmentDistanceMeters;
      grade = clamp(grade, -0.2, 0.2);
    }

    const vspKwPerTon =
      segmentSpeedMps * (1.1 * accelerationMps2 + 9.81 * grade + 0.132) +
      0.000302 * segmentSpeedMps ** 3;
    maxVspKwPerTon = Math.max(maxVspKwPerTon, vspKwPerTon);
    vspSamples.push(vspKwPerTon);
    speedSamplesMps.push(segmentSpeedMps);

    if (speedCategory === 'TRAFFIC_JAM') {
      jamDistanceMeters += segmentDistanceMeters;
    } else if (speedCategory === 'SLOW') {
      slowDistanceMeters += segmentDistanceMeters;
    }

    if (segmentSpeedMps <= 2.2) {
      stopCount += 1;
    }

    const massTons = vehicleProfile.massKg / 1000;
    const wheelPowerKw = Math.max(0, vspKwPerTon * massTons);

    if (vehicleProfile.powertrain === 'BEV') {
      const drivetrainEfficiency = vehicleProfile.drivetrainEfficiency || 0.9;
      const regenEfficiency = vehicleProfile.regenEfficiency || 0.3;
      const positiveEnergyKwh = (wheelPowerKw * segmentDurationSeconds) / 3600 / drivetrainEfficiency;
      const negativePowerKw = Math.min(0, vspKwPerTon * massTons);
      const recoveredEnergyKwh =
        Math.abs(negativePowerKw) * (segmentDurationSeconds / 3600) * regenEfficiency;
      movingEnergyKwh += Math.max(0, positiveEnergyKwh - recoveredEnergyKwh);
      continue;
    }

    const fuelEnergyKwh =
      (wheelPowerKw * segmentDurationSeconds) /
      3600 /
      Math.max(0.12, vehicleProfile.engineEfficiency || 0.26);
    const fuelLiters = fuelEnergyKwh / energyDensityKwhPerLiter(vehicleProfile.fuelType);
    movingFuelLiters += Math.max(0, fuelLiters);
  }

  idleSeconds = clamp(idleSeconds, 0, durationSeconds * 0.7);
  const idleFuelLiters =
    vehicleProfile.powertrain === 'BEV'
      ? 0
      : vehicleProfile.idleRateLitersPerMinute * (idleSeconds / 60);
  const restartFuelLiters =
    vehicleProfile.powertrain === 'BEV'
      ? 0
      : stopCount * vehicleProfile.restartLiters;

  const idleEnergyKwh =
    vehicleProfile.powertrain === 'BEV' ? (idleSeconds / 3600) * 0.6 : 0;
  // realWorldFactor corrects VSP moving fuel only; idle and restart rates are already calibrated
  const correctedMovingFuelLiters = movingFuelLiters * (vehicleProfile.realWorldFactor || 1);
  const totalFuelLiters = correctedMovingFuelLiters + idleFuelLiters + restartFuelLiters;
  const totalEnergyKwh = movingEnergyKwh + idleEnergyKwh;
  const roundedTotalFuelLiters = Number(totalFuelLiters.toFixed(3));
  const roundedTotalEnergyKwh = Number(totalEnergyKwh.toFixed(3));
  const spendUnits =
    vehicleProfile.powertrain === 'BEV' ? roundedTotalEnergyKwh : roundedTotalFuelLiters;
  const estimatedCostPhp = spendUnits * fuelPrice;
  const co2Kg =
    vehicleProfile.powertrain === 'BEV'
      ? roundedTotalEnergyKwh * CO2_FACTORS.electric
      : roundedTotalFuelLiters *
        (CO2_FACTORS[vehicleProfile.fuelType] || CO2_FACTORS.gasoline);

  const jamShare = distanceMeters > 0 ? jamDistanceMeters / distanceMeters : 0;
  const slowShare = distanceMeters > 0 ? slowDistanceMeters / distanceMeters : 0;
  const trafficDelayMinutes = Math.max(0, (durationSeconds - staticDurationSeconds) / 60);
  const averageSpeedMps = mean(speedSamplesMps);
  const speedStdDev = standardDeviation(speedSamplesMps);
  const speedCv = averageSpeedMps > 0 ? speedStdDev / averageSpeedMps : 0;
  const stabilityScore = Math.round(clamp((1 - speedCv) * 100, 0, 100));
  const trafficScore = Math.round(clamp((1 - jamShare * 1.4 - slowShare * 0.7) * 100, 0, 100));
  const vspAverage = mean(vspSamples);
  const ecoBandShare = vspSamples.length
    ? vspSamples.filter((value) => value < 4).length / vspSamples.length
    : 0;
  const moderateBandShare = vspSamples.length
    ? vspSamples.filter((value) => value >= 4 && value < 10).length / vspSamples.length
    : 0;
  const wasteBandShare = vspSamples.length
    ? vspSamples.filter((value) => value >= 10).length / vspSamples.length
    : 0;

  return {
    id: `route-${routeIndex + 1}`,
    index: routeIndex,
    isGoogleRecommended: routeIndex === 0,
    label: `Route ${routeIndex + 1}`,
    description:
      routeIndex === 0
        ? 'Recommended by Google'
        : String(route?.description || '').trim() ||
          (Array.isArray(route?.routeLabels) && route.routeLabels.includes('FUEL_EFFICIENT')
            ? 'Fuel-efficient reference route'
            : `Recommendation ${routeIndex + 1}`),
    routeLabels: Array.isArray(route?.routeLabels) ? route.routeLabels : [],
    encodedPolyline,
    warnings: Array.isArray(route?.warnings) ? route.warnings : [],
    distanceMeters,
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    durationSeconds,
    durationMinutes: Number((durationSeconds / 60).toFixed(1)),
    staticDurationSeconds,
    staticDurationMinutes: Number((staticDurationSeconds / 60).toFixed(1)),
    trafficDelayMinutes: Number(trafficDelayMinutes.toFixed(1)),
    trafficLevel: computeTrafficLevel(jamShare, slowShare),
    trafficScore,
    speedStabilityScore: stabilityScore,
    averageSpeedKph: Number((averageSpeedMps * 3.6).toFixed(1)),
    movingFuelLiters: Number(movingFuelLiters.toFixed(3)),
    idleFuelLiters: Number(idleFuelLiters.toFixed(3)),
    restartFuelLiters: Number(restartFuelLiters.toFixed(3)),
    totalFuelLiters: roundedTotalFuelLiters,
    totalEnergyKwh: roundedTotalEnergyKwh,
    estimatedCostPhp: Number(estimatedCostPhp.toFixed(2)),
    co2Kg: Number(co2Kg.toFixed(3)),
    stopCount,
    idleMinutes: Number((idleSeconds / 60).toFixed(1)),
    vsp: {
      averageKwPerTon: Number(vspAverage.toFixed(2)),
      maxKwPerTon: Number(maxVspKwPerTon.toFixed(2)),
      ecoShare: Number((ecoBandShare * 100).toFixed(1)),
      moderateShare: Number((moderateBandShare * 100).toFixed(1)),
      wasteShare: Number((wasteBandShare * 100).toFixed(1)),
    },
    componentScores: {
      time: 0,
      fuel: 0,
      traffic: trafficScore,
      speedStability: stabilityScore,
    },
  };
}

function assignEfficiencyScores(routes) {
  const durationValues = routes.map((route) => route.durationSeconds);
  const costValues = routes.map((route) => route.estimatedCostPhp);
  const trafficDelayValues = routes.map((route) => route.trafficDelayMinutes);
  const minDuration = Math.min(...durationValues);
  const maxDuration = Math.max(...durationValues);
  const minCost = Math.min(...costValues);
  const maxCost = Math.max(...costValues);
  const minTrafficDelay = Math.min(...trafficDelayValues);
  const maxTrafficDelay = Math.max(...trafficDelayValues);

  for (const route of routes) {
    const timeScore =
      maxDuration === minDuration
        ? 100
        : 100 - ((route.durationSeconds - minDuration) / (maxDuration - minDuration)) * 100;
    const fuelScore =
      maxCost === minCost
        ? 100
        : 100 - ((route.estimatedCostPhp - minCost) / (maxCost - minCost)) * 100;
    const trafficPenaltyScore =
      maxTrafficDelay === minTrafficDelay
        ? route.componentScores.traffic
        : 100 -
          ((route.trafficDelayMinutes - minTrafficDelay) /
            (maxTrafficDelay - minTrafficDelay)) *
            100;

    route.componentScores.time = Math.round(clamp(timeScore, 0, 100));
    route.componentScores.fuel = Math.round(clamp(fuelScore, 0, 100));
    route.componentScores.traffic = Math.round(
      clamp((route.componentScores.traffic + trafficPenaltyScore) / 2, 0, 100)
    );

    route.efficiencyScore = Math.round(
      clamp(
        route.componentScores.time * 0.25 +
          route.componentScores.fuel * 0.35 +
          route.componentScores.traffic * 0.25 +
          route.componentScores.speedStability * 0.15,
        0,
        100
      )
    );
  }

  routes.sort((left, right) => {
    if (right.efficiencyScore !== left.efficiencyScore) {
      return right.efficiencyScore - left.efficiencyScore;
    }

    return left.estimatedCostPhp - right.estimatedCostPhp;
  });

  for (const [index, route] of routes.entries()) {
    route.rank = index + 1;
    route.isRecommended = index === 0;
  }

  return routes;
}

router.post('/trips', (req, res) => {
  const payload = req.body && typeof req.body === 'object' ? req.body : null;
  if (!payload) {
    return res.status(400).json({ error: 'Trip payload is required.' });
  }

  const existing = readTripReports();
  const record = {
    id: String(payload.id || `${Date.now()}`),
    savedAt: new Date().toISOString(),
    ...payload,
  };

  existing.unshift(record);
  writeTripReports(existing);

  return res.status(201).json({
    message: 'Trip report saved.',
    id: record.id,
  });
});

router.get('/trips', (req, res) => {
  const requestedLimit = Number.parseInt(String(req.query.limit || '50'), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(200, requestedLimit))
    : 50;
  const records = readTripReports().slice(0, limit);
  res.json({
    count: records.length,
    records,
  });
});

router.post('/analyze', async (req, res) => {
  const origin = normalizeWaypoint(req.body?.origin);
  const destination = normalizeWaypoint(req.body?.destination);
  const requestedRouteLimit = resolveRequestedRouteLimit(req.body?.routeLimit);
  const effectiveRouteLimit = Math.max(
    1,
    Math.min(requestedRouteLimit, MAX_ROUTE_FETCH_TARGET)
  );
  const fuelPrice =
    toFiniteNumber(req.body?.fuelPrice) ||
    DEFAULT_FUEL_PRICE_BY_TYPE[String(req.body?.fuelType || '').toLowerCase()] ||
    DEFAULT_FUEL_PRICE_BY_TYPE.gasoline;
  const vehicleProfile = getVehicleProfile(req.body?.vehicleType, req.body?.fuelType);

  if (!origin || !destination) {
    return res.status(400).json({
      error: 'origin and destination are required.',
    });
  }

  if (!GOOGLE_MAPS_API_KEY && !getFirebaseServiceAccountCredentials()) {
    return res.status(500).json({
      error:
        'Google credentials are not configured on the backend (API key or Firebase service account required).',
    });
  }

  try {
    const routesPayload = await fetchRoutesWithFallbackStrategies(
      buildRoutesRequest(origin, destination, vehicleProfile),
      effectiveRouteLimit,
      effectiveRouteLimit,
      {
        originText: req.body?.origin,
        destinationText: req.body?.destination,
      }
    );
    const rawRoutes = Array.isArray(routesPayload?.routes)
      ? routesPayload.routes.slice(0, effectiveRouteLimit)
      : [];

    if (!rawRoutes.length) {
      return res.status(404).json({
        error: 'No routes were returned by Google Routes API.',
      });
    }

    const analyzedRoutes = await mapWithConcurrency(
      rawRoutes,
      ANALYSIS_CONCURRENCY,
      async (rawRoute, index) => {
        const decodedPolyline = decodePolyline(rawRoute?.polyline?.encodedPolyline || '');
        const shouldFetchElevation = index < ELEVATION_ANALYSIS_ROUTE_LIMIT;
        const elevations = shouldFetchElevation
          ? await fetchElevations(decodedPolyline)
          : samplePathPoints(decodedPolyline, ELEVATION_SAMPLE_POINTS).map(() => null);

        return analyzeRoute(rawRoute, index, vehicleProfile, fuelPrice, elevations);
      }
    );

    const deduplicatedAnalyzedRoutes = removeNearDuplicateAnalyzedRoutes(
      analyzedRoutes,
      vehicleProfile.fuelType,
      Math.min(MIN_KEEP_ROUTES, effectiveRouteLimit)
    ).map((route, index) => ({
      ...route,
      id: `route-${index + 1}`,
      index,
      label: `Route ${index + 1}`,
    }));

    if (!deduplicatedAnalyzedRoutes.length) {
      return res.status(404).json({
        error: 'No distinct routes remained after route quality filtering.',
      });
    }

    const rankedRoutes = assignEfficiencyScores(deduplicatedAnalyzedRoutes);
    const recommendedRoute = rankedRoutes[0];

    res.json({
      generatedAt: new Date().toISOString(),
      request: {
        origin: req.body?.origin,
        destination: req.body?.destination,
        vehicleType: req.body?.vehicleType || vehicleProfile.key,
        vehicleLabel: vehicleProfile.label,
        fuelType: vehicleProfile.fuelType,
        fuelPrice: Number(fuelPrice.toFixed(2)),
        currency: 'PHP',
      },
      recommendedRouteId: recommendedRoute.id,
      routes: rankedRoutes,
      geocodingResults: routesPayload?.geocodingResults || null,
    });
  } catch (error) {
    console.error('Route analysis failed:', error);
    res.status(502).json({
      error: 'Failed to compute route analysis.',
      details: error.message,
    });
  }
});

module.exports = {
  routeAnalysisRouter: router,
  VEHICLE_PROFILES,
};
