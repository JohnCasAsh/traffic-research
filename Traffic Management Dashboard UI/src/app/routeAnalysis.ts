export type TrafficLevel = 'low' | 'moderate' | 'heavy';

export type RouteMetrics = {
  id: string;
  rank: number;
  isGoogleRecommended?: boolean;
  label: string;
  description: string;
  encodedPolyline?: string;
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

export type RouteAnalysisResponse = {
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

export type RouteAnalysisRequest = {
  origin: string;
  destination: string;
  vehicleType: string;
  fuelType: string;
  fuelPrice: number;
  routeLimit: number;
};

export const ROUTE_ANALYSIS_ROUTE_LIMIT = 5;

export function buildApiBaseUrl() {
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

function normalizeText(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function toFuelPriceNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildRouteAnalysisRequest(input: {
  origin: string;
  destination: string;
  vehicleType: string;
  fuelType: string;
  fuelPrice: string | number;
  routeLimit?: number;
}): RouteAnalysisRequest {
  return {
    origin: String(input.origin || '').trim(),
    destination: String(input.destination || '').trim(),
    vehicleType: String(input.vehicleType || '').trim(),
    fuelType: String(input.fuelType || '').trim(),
    fuelPrice: toFuelPriceNumber(input.fuelPrice),
    routeLimit: Math.max(1, Math.min(ROUTE_ANALYSIS_ROUTE_LIMIT, Number(input.routeLimit) || ROUTE_ANALYSIS_ROUTE_LIMIT)),
  };
}

export function buildRouteAnalysisRequestKey(request: {
  origin: string;
  destination: string;
  vehicleType: string;
  fuelType: string;
  fuelPrice: string | number;
  routeLimit?: number;
}) {
  const normalizedFuelPrice = toFuelPriceNumber(request.fuelPrice).toFixed(2);
  const normalizedRouteLimit = Math.max(
    1,
    Math.min(ROUTE_ANALYSIS_ROUTE_LIMIT, Number(request.routeLimit) || ROUTE_ANALYSIS_ROUTE_LIMIT)
  );

  return [
    normalizeText(request.origin),
    normalizeText(request.destination),
    normalizeText(request.vehicleType),
    normalizeText(request.fuelType),
    normalizedFuelPrice,
    String(normalizedRouteLimit),
  ].join('|');
}

export function doesAnalysisMatchRequest(
  analysis: RouteAnalysisResponse | null | undefined,
  request: RouteAnalysisRequest
) {
  if (!analysis?.request) {
    return false;
  }

  const analysisFuelPrice = toFuelPriceNumber(analysis.request.fuelPrice);
  const requestFuelPrice = toFuelPriceNumber(request.fuelPrice);

  return (
    normalizeText(analysis.request.origin) === normalizeText(request.origin) &&
    normalizeText(analysis.request.destination) === normalizeText(request.destination) &&
    normalizeText(analysis.request.vehicleType) === normalizeText(request.vehicleType) &&
    normalizeText(analysis.request.fuelType) === normalizeText(request.fuelType) &&
    Math.abs(analysisFuelPrice - requestFuelPrice) < 0.01
  );
}

export async function fetchRouteAnalysis(
  apiBaseUrl: string,
  request: RouteAnalysisRequest,
  signal?: AbortSignal
): Promise<RouteAnalysisResponse> {
  const response = await fetch(`${apiBaseUrl}/api/routes/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  const rawPayload = await response.text();
  let payload: unknown = null;

  try {
    payload = JSON.parse(rawPayload);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorPayload = payload as { details?: string; error?: string } | null;
    throw new Error(errorPayload?.details || errorPayload?.error || 'Failed to analyze routes.');
  }

  return payload as RouteAnalysisResponse;
}
