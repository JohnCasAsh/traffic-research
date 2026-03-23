const express = require('express');
const { fetchWithRetry } = require('./resilientFetch');

const router = express.Router();

const GOOGLE_MAPS_API_KEY = (
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.VITE_GOOGLE_MAPS_API_KEY ||
  ''
).trim();

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const ELEVATION_API_URL = 'https://maps.googleapis.com/maps/api/elevation/json';
const DEFAULT_FUEL_PRICE_BY_TYPE = {
  gasoline: 62.0,
  diesel: 58.5,
  electric: 10.0,
};
const CO2_FACTORS = {
  gasoline: 2.31,
  diesel: 2.68,
  electric: 0.72,
};

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
    requestedReferenceRoutes: ['FUEL_EFFICIENT'],
    extraComputations: ['TRAFFIC_ON_POLYLINE'],
    departureTime: new Date().toISOString(),
  };
}

async function fetchRoutes(requestBody) {
  const response = await fetchWithRetry(
    ROUTES_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': [
          'routes.routeLabels',
          'routes.description',
          'routes.distanceMeters',
          'routes.duration',
          'routes.staticDuration',
          'routes.polyline.encodedPolyline',
          'routes.travelAdvisory.speedReadingIntervals',
          'routes.warnings',
          'geocodingResults',
        ].join(','),
      },
      body: JSON.stringify(requestBody),
    },
    {
      requestName: 'google_routes_compute_routes',
      timeoutMs: 15000,
    }
  );

  return response.json();
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

async function fetchElevations(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return [];
  }

  const sampledPoints = samplePathPoints(points, 60);
  const locationText = sampledPoints
    .map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)
    .join('|');

  const url = `${ELEVATION_API_URL}?locations=${encodeURIComponent(locationText)}&key=${encodeURIComponent(
    GOOGLE_MAPS_API_KEY
  )}`;
  const response = await fetchWithRetry(url, undefined, {
    requestName: 'google_elevation_sampled_points',
    timeoutMs: 15000,
  });
  const payload = await response.json();

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
  const totalFuelLiters = movingFuelLiters + idleFuelLiters + restartFuelLiters;
  const totalEnergyKwh = movingEnergyKwh + idleEnergyKwh;
  const spendUnits =
    vehicleProfile.powertrain === 'BEV' ? totalEnergyKwh : totalFuelLiters;
  const estimatedCostPhp = spendUnits * fuelPrice;
  const co2Kg =
    vehicleProfile.powertrain === 'BEV'
      ? totalEnergyKwh * CO2_FACTORS.electric
      : totalFuelLiters * (CO2_FACTORS[vehicleProfile.fuelType] || CO2_FACTORS.gasoline);

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
    label:
      routeIndex === 0 ? 'Recommended by Google' : `Alternative Route ${routeIndex}`,
    description:
      String(route?.description || '').trim() ||
      (Array.isArray(route?.routeLabels) && route.routeLabels.includes('FUEL_EFFICIENT')
        ? 'Fuel-efficient reference route'
        : `Alternative route ${routeIndex + 1}`),
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
    totalFuelLiters: Number(totalFuelLiters.toFixed(3)),
    totalEnergyKwh: Number(totalEnergyKwh.toFixed(3)),
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

function buildFallbackResponse({
  origin,
  destination,
  vehicleType,
  vehicleProfile,
  fuelPrice,
  reason,
}) {
  const templates = [
    {
      label: 'Balanced City Route',
      description: 'Fallback estimate generated while live Google route analysis is unavailable.',
      distanceKm: 16.8,
      durationMinutes: 42,
      trafficDelayMinutes: 7,
      trafficLevel: 'moderate',
      speedStability: 76,
    },
    {
      label: 'Fastest Main Road',
      description: 'Lower travel time but typically heavier traffic queues.',
      distanceKm: 18.3,
      durationMinutes: 39,
      trafficDelayMinutes: 11,
      trafficLevel: 'heavy',
      speedStability: 63,
    },
    {
      label: 'Lower Traffic Bypass',
      description: 'Smoother speed profile with a longer route distance.',
      distanceKm: 19.5,
      durationMinutes: 44,
      trafficDelayMinutes: 4,
      trafficLevel: 'low',
      speedStability: 84,
    },
  ];

  const baselineConsumptionPerKm = vehicleProfile.fuelType === 'electric' ? 0.14 : 0.085;

  const routes = templates.map((item, index) => {
    const trafficMultiplier = item.trafficLevel === 'heavy' ? 1.15 : item.trafficLevel === 'moderate' ? 1.05 : 0.95;
    const unitsUsed = item.distanceKm * baselineConsumptionPerKm * trafficMultiplier;
    const estimatedCostPhp = unitsUsed * fuelPrice;
    const co2Kg = vehicleProfile.fuelType === 'electric' ? unitsUsed * CO2_FACTORS.electric : unitsUsed * CO2_FACTORS[vehicleProfile.fuelType];

    return {
      id: `fallback-route-${index + 1}`,
      rank: index + 1,
      label: item.label,
      description: item.description,
      distanceKm: item.distanceKm,
      durationMinutes: item.durationMinutes,
      staticDurationMinutes: Math.max(1, item.durationMinutes - item.trafficDelayMinutes),
      trafficDelayMinutes: item.trafficDelayMinutes,
      trafficLevel: item.trafficLevel,
      estimatedCostPhp: Number(estimatedCostPhp.toFixed(2)),
      totalFuelLiters: vehicleProfile.fuelType === 'electric' ? 0 : Number(unitsUsed.toFixed(3)),
      totalEnergyKwh: vehicleProfile.fuelType === 'electric' ? Number(unitsUsed.toFixed(3)) : 0,
      efficiencyScore: 0,
      co2Kg: Number(co2Kg.toFixed(2)),
      isRecommended: false,
      warnings: [reason, 'Fallback estimate only'],
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

  const rankedRoutes = assignEfficiencyScores(routes);
  const recommendedRoute = rankedRoutes[0];

  return {
    generatedAt: new Date().toISOString(),
    request: {
      origin: origin?.original,
      destination: destination?.original,
      vehicleType: vehicleType || vehicleProfile.key,
      vehicleLabel: vehicleProfile.label,
      fuelType: vehicleProfile.fuelType,
      fuelPrice: Number(fuelPrice.toFixed(2)),
      currency: 'PHP',
    },
    recommendedRouteId: recommendedRoute.id,
    routes: rankedRoutes,
    geocodingResults: null,
    fallback: true,
    fallbackReason: reason,
  };
}

router.post('/analyze', async (req, res) => {
  const origin = normalizeWaypoint(req.body?.origin);
  const destination = normalizeWaypoint(req.body?.destination);
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

  if (!GOOGLE_MAPS_API_KEY) {
    return res.json(
      buildFallbackResponse({
        origin,
        destination,
        vehicleType: req.body?.vehicleType,
        vehicleProfile,
        fuelPrice,
        reason: 'Google Maps API key is not configured on the backend.',
      })
    );
  }

  try {
    const routesPayload = await fetchRoutes(buildRoutesRequest(origin, destination, vehicleProfile));
    const rawRoutes = Array.isArray(routesPayload?.routes) ? routesPayload.routes.slice(0, 3) : [];

    if (!rawRoutes.length) {
      return res.status(404).json({
        error: 'No routes were returned by Google Routes API.',
      });
    }

    const analyzedRoutes = [];
    for (let index = 0; index < rawRoutes.length; index += 1) {
      const rawRoute = rawRoutes[index];
      const decodedPolyline = decodePolyline(rawRoute?.polyline?.encodedPolyline || '');
      const elevations = await fetchElevations(decodedPolyline);
      analyzedRoutes.push(
        analyzeRoute(rawRoute, index, vehicleProfile, fuelPrice, elevations)
      );
    }

    const rankedRoutes = assignEfficiencyScores(analyzedRoutes);
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
    res.json(
      buildFallbackResponse({
        origin,
        destination,
        vehicleType: req.body?.vehicleType,
        vehicleProfile,
        fuelPrice,
        reason: `Failed to compute live route analysis: ${error.message}`,
      })
    );
  }
});

module.exports = {
  routeAnalysisRouter: router,
  VEHICLE_PROFILES,
};
