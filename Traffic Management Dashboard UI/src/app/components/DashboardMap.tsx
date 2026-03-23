import { useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';
import { useLocationConsent } from '../LocationConsentContext';
import {
  parseCoordinateInput,
} from '../location';

const DEFAULT_CENTER = { lat: 17.6132, lng: 121.7270 }; // Tuguegarao City
const DEFAULT_ZOOM = 12;
const MAX_INITIAL_TRACKING_ACCURACY_METERS = 400;
const MAX_STEADY_TRACKING_ACCURACY_METERS = 200;
const MIN_MOVEMENT_FOR_WEAK_SIGNAL_METERS = 35;
const MAX_ROUTE_OPTIONS = 5;
const MAX_ALLOWED_FORCED_DETOUR_RATIO = 2.5;
const MAX_ALLOWED_BRIDGE_DETOUR_RATIO = 1.7;
const BRIDGE_MATCH_RADIUS_DEGREES = 0.0065;
const STEEL_BRIDGE_COORD = { lat: 17.6409, lng: 121.7015 };
const BUNTUN_BRIDGE_COORD = { lat: 17.6185, lng: 121.6889 };
const SOLANA_TOWN_CENTER_COORD = { lat: 17.6528, lng: 121.6907 };
const TIMED_BRIDGE_KEYWORDS = [
  'tuguegarao solana steel brg',
  'tuguegarao-solana steel bridge',
  'tuguegarao solana steel bridge',
  'steel brg',
  'steel bridge',
  'solana steel brg',
  'steal brg',
  'steal bridge',
];
const SECOND_BRIDGE_KEYWORDS = ['buntun bridge', 'buntun brg'];
const ALL_BRIDGE_KEYWORDS = [...TIMED_BRIDGE_KEYWORDS, ...SECOND_BRIDGE_KEYWORDS];
const CAGAYAN_AREA_HINTS = [
  'caggay',
  'tuguegarao',
  'solana',
  'cagayan',
  'buntun',
  'steel bridge',
  // Cagayan province municipalities and common barangays
  'piat', 'carig', 'aparri', 'abulug', 'alcala', 'allacapan', 'baggao',
  'ballesteros', 'buguey', 'calayan', 'claveria', 'enrile', 'gattaran',
  'gonzaga', 'iguig', 'lasam', 'lal-lo', 'pamplona', 'penablanca',
  'peñablanca', 'santa ana', 'santa praxedes', 'santa teresita', 'tuao',
  'amulung', 'calabayog', 'magapit', 'linao', 'nassiping', 'ugac',
];
const CAGAYAN_ROUTE_BOUNDS = {
  minLat: 17.1,
  maxLat: 18.8,
  minLng: 121.3,
  maxLng: 122.8,
};
const LOCAL_LOCATION_ALIASES: Record<string, string> = {
  bunton: 'Buntun Bridge, Tuguegarao City, Cagayan, Philippines',
  buntun: 'Buntun Bridge, Tuguegarao City, Cagayan, Philippines',
  'buntun bridge': 'Buntun Bridge, Tuguegarao City, Cagayan, Philippines',
  'buntun brg': 'Buntun Bridge, Tuguegarao City, Cagayan, Philippines',
  solana: 'Solana, Cagayan, Philippines',
  'solana bridge': 'Tuguegarao-Solana Steel Bridge, Tuguegarao, Cagayan, Philippines',
  'steel bridge': 'Tuguegarao-Solana Steel Bridge, Tuguegarao, Cagayan, Philippines',
  tuguegarao: 'Tuguegarao City, Cagayan, Philippines',
  'tuguegarao city': 'Tuguegarao City, Cagayan, Philippines',
};
const LOCAL_LOCATION_COORDINATE_ALIASES: Record<string, { lat: number; lng: number }> = {
  bunton: BUNTUN_BRIDGE_COORD,
  buntun: BUNTUN_BRIDGE_COORD,
  'buntun bridge': BUNTUN_BRIDGE_COORD,
  'buntun brg': BUNTUN_BRIDGE_COORD,
  solana: SOLANA_TOWN_CENTER_COORD,
  'solana bridge': STEEL_BRIDGE_COORD,
  'steel bridge': STEEL_BRIDGE_COORD,
};

type WaypointCandidate = string | { lat: number; lng: number };
type ForcedBridgeWaypoint = {
  label: string;
  expectedBridge: 'steel' | 'buntun';
  waypointCandidates: WaypointCandidate[];
};

const FORCED_BRIDGE_WAYPOINTS = [
  {
    label: 'Via Tuguegarao-Solana Steel Bridge',
    expectedBridge: 'steel',
    waypointCandidates: [
      STEEL_BRIDGE_COORD,
      'Tuguegarao-Solana Steel Bridge, Tuguegarao, Cagayan',
      'Solana Steel Bridge, Cagayan',
    ],
  },
  {
    label: 'Via Buntun Bridge',
    expectedBridge: 'buntun',
    waypointCandidates: [BUNTUN_BRIDGE_COORD, 'Buntun Bridge, Tuguegarao, Cagayan'],
  },
] as ForcedBridgeWaypoint[];

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function includesAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function haversineDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isWithinCagayanRouteBounds(point: { lat: number; lng: number }) {
  return (
    point.lat >= CAGAYAN_ROUTE_BOUNDS.minLat &&
    point.lat <= CAGAYAN_ROUTE_BOUNDS.maxLat &&
    point.lng >= CAGAYAN_ROUTE_BOUNDS.minLng &&
    point.lng <= CAGAYAN_ROUTE_BOUNDS.maxLng
  );
}

function compactAddressText(value: string) {
  return normalizeText(value)
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveRouteEndpoint(value: string) {
  return parseCoordinateInput(value) || value;
}

function applyLocalAddressHint(routeInput: WaypointCandidate, useCagayanHint: boolean): WaypointCandidate {
  if (typeof routeInput !== 'string') {
    return routeInput;
  }

  const trimmedInput = routeInput.trim();
  if (!trimmedInput) {
    return routeInput;
  }

  const compactInput = compactAddressText(trimmedInput);
  const aliasedValue = LOCAL_LOCATION_ALIASES[compactInput];
  if (aliasedValue) {
    return aliasedValue;
  }

  if (!useCagayanHint) {
    return trimmedInput;
  }

  if (
    trimmedInput.includes(',') ||
    compactInput.includes('philippines') ||
    compactInput.includes('cagayan')
  ) {
    return trimmedInput;
  }

  // Only append the Cagayan hint for known Cagayan place names.
  // Without this guard, destinations like "manila", "baguio", "laoag" would become
  // "manila, Cagayan, Philippines" and resolve to a barangay instead of the real city.
  if (!includesAnyKeyword(compactInput, CAGAYAN_AREA_HINTS)) {
    return trimmedInput;
  }

  return `${trimmedInput}, Cagayan, Philippines`;
}

function buildRouteLocationCandidates(
  routeInput: WaypointCandidate,
  useCagayanHint: boolean
): WaypointCandidate[] {
  if (typeof routeInput !== 'string') {
    return [routeInput];
  }

  const trimmedInput = routeInput.trim();
  if (!trimmedInput) {
    return [routeInput];
  }

  const compactInput = compactAddressText(trimmedInput);
  const candidates: WaypointCandidate[] = [];

  const coordinateAlias = LOCAL_LOCATION_COORDINATE_ALIASES[compactInput];
  if (coordinateAlias) {
    candidates.push(coordinateAlias);
  }

  const textAlias = LOCAL_LOCATION_ALIASES[compactInput];
  if (textAlias) {
    candidates.push(textAlias);
  }

  candidates.push(applyLocalAddressHint(trimmedInput, useCagayanHint));
  candidates.push(trimmedInput);

  const seenFingerprints = new Set<string>();
  const deduplicatedCandidates: WaypointCandidate[] = [];
  for (const candidate of candidates) {
    const fingerprint =
      typeof candidate === 'string'
        ? `s:${candidate.trim().toLowerCase()}`
        : `c:${candidate.lat.toFixed(6)},${candidate.lng.toFixed(6)}`;

    if (seenFingerprints.has(fingerprint)) {
      continue;
    }

    seenFingerprints.add(fingerprint);
    deduplicatedCandidates.push(candidate);
  }

  return deduplicatedCandidates;
}

function isLikelyCagayanTrip(origin: string, destination: string) {
  const combined = `${normalizeText(origin)} ${normalizeText(destination)}`;
  const originPoint = parseCoordinateInput(origin);
  const destinationPoint = parseCoordinateInput(destination);

  const hasTextHint =
    includesAnyKeyword(combined, CAGAYAN_AREA_HINTS) ||
    includesAnyKeyword(combined, ALL_BRIDGE_KEYWORDS);
  const hasCoordinateHint =
    (originPoint ? isWithinCagayanRouteBounds(originPoint) : false) ||
    (destinationPoint ? isWithinCagayanRouteBounds(destinationPoint) : false);

  return hasTextHint || hasCoordinateHint;
}


function routeContainsKeyword(route: any, keywords: string[]) {
  const summaryText = String(route?.summary || '').toLowerCase();
  const stepsText = (route?.legs || [])
    .flatMap((leg: any) => leg?.steps || [])
    .map((step: any) => String(step?.html_instructions || step?.instructions || ''))
    .join(' ')
    .toLowerCase();

  const searchableText = `${summaryText} ${stepsText}`;
  return includesAnyKeyword(searchableText, keywords);
}

function getPointLatLng(point: any) {
  const lat = typeof point?.lat === 'function' ? point.lat() : point?.lat;
  const lng = typeof point?.lng === 'function' ? point.lng() : point?.lng;

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return null;
  }

  return { lat: Number(lat), lng: Number(lng) };
}

function routePassesNearCoordinate(route: any, target: { lat: number; lng: number }) {
  const overviewPoints = (route?.overview_path || [])
    .map((point: any) => getPointLatLng(point))
    .filter(Boolean) as Array<{ lat: number; lng: number }>;

  const stepPoints = (route?.legs || [])
    .flatMap((leg: any) => leg?.steps || [])
    .flatMap((step: any) => step?.path || [])
    .map((point: any) => getPointLatLng(point))
    .filter(Boolean) as Array<{ lat: number; lng: number }>;

  return [...overviewPoints, ...stepPoints].some(
    (point) =>
      Math.abs(point.lat - target.lat) <= BRIDGE_MATCH_RADIUS_DEGREES &&
      Math.abs(point.lng - target.lng) <= BRIDGE_MATCH_RADIUS_DEGREES
  );
}

function routeUsesTimedBridge(route: any) {
  return routeContainsKeyword(route, TIMED_BRIDGE_KEYWORDS) || routePassesNearCoordinate(route, STEEL_BRIDGE_COORD);
}

function routeUsesSecondBridge(route: any) {
  return routeContainsKeyword(route, SECOND_BRIDGE_KEYWORDS) || routePassesNearCoordinate(route, BUNTUN_BRIDGE_COORD);
}

// Returns true when a route initially travels significantly in the OPPOSITE
// direction from the destination — the hallmark of a "joyride" route.
// e.g. origin=Solana (lat 17.65), destination=Claveria (north, lat 18.3):
//   a route that starts south toward Buntun Bridge (lat 17.618) backtracks
//   0.032° (~3.6 km) before heading north — clearly wrong, drop it.
function routeHasDirectionalBacktrack(
  route: any,
  backtrackThresholdDeg = 0.008
): boolean {
  const leg = route?.legs?.[0];
  if (!leg) return false;

  const startPoint = getPointLatLng(leg.start_location);
  const endPoint = getPointLatLng(leg.end_location);
  if (!startPoint || !endPoint) return false;

  // Only apply to trips with a clear north-south component (> ~5.5 km lat diff)
  const latDiff = endPoint.lat - startPoint.lat;
  if (Math.abs(latDiff) < 0.05) return false;

  const goingNorth = latDiff > 0;
  const overviewPath: any[] = Array.isArray(route?.overview_path) ? route.overview_path : [];
  const checkCount = Math.min(Math.ceil(overviewPath.length * 0.15) + 2, 20);
  const initialPoints = overviewPath
    .slice(0, checkCount)
    .map((p: any) => getPointLatLng(p))
    .filter(Boolean) as { lat: number; lng: number }[];

  if (initialPoints.length < 3) return false;

  if (goingNorth) {
    const minLat = initialPoints.reduce((m, p) => Math.min(m, p.lat), startPoint.lat);
    return startPoint.lat - minLat > backtrackThresholdDeg;
  } else {
    const maxLat = initialPoints.reduce((m, p) => Math.max(m, p.lat), startPoint.lat);
    return maxLat - startPoint.lat > backtrackThresholdDeg;
  }
}

function buildRouteFingerprint(route: any) {
  const primaryLeg = route?.legs?.[0];
  const distanceValue = primaryLeg?.distance?.value ?? 'na';
  const durationValue = primaryLeg?.duration?.value ?? 'na';
  const summaryValue = String(route?.summary || '').toLowerCase();
  const pathValue = (route?.overview_path || [])
    .slice(0, 8)
    .map((point: any) => {
      const lat = typeof point?.lat === 'function' ? point.lat() : point?.lat;
      const lng = typeof point?.lng === 'function' ? point.lng() : point?.lng;
      return `${Number(lat || 0).toFixed(4)},${Number(lng || 0).toFixed(4)}`;
    })
    .join(';');

  return `${summaryValue}|${distanceValue}|${durationValue}|${pathValue}`;
}

type RouteSummary = {
  routeLabel: string;
  summaryText: string;
  distanceText: string;
  durationText: string;
  usesSteelBridge: boolean;
  usesSecondBridge: boolean;
};

type RouteOption = RouteSummary & {
  routeId: string;
  directionsResult: any;
  resultRouteIndex: number;
};

function compareRouteOptionsByShortest(a: RouteOption, b: RouteOption) {
  const legA = a?.directionsResult?.routes?.[a.resultRouteIndex]?.legs?.[0];
  const legB = b?.directionsResult?.routes?.[b.resultRouteIndex]?.legs?.[0];

  const distanceA = Number(legA?.distance?.value ?? Number.POSITIVE_INFINITY);
  const distanceB = Number(legB?.distance?.value ?? Number.POSITIVE_INFINITY);
  const durationA = Number(legA?.duration?.value ?? Number.POSITIVE_INFINITY);
  const durationB = Number(legB?.duration?.value ?? Number.POSITIVE_INFINITY);

  if (distanceA !== distanceB) {
    return distanceA - distanceB;
  }

  if (durationA !== durationB) {
    return durationA - durationB;
  }

  return a.summaryText.localeCompare(b.summaryText);
}

type TrafficLevel = 'low' | 'moderate' | 'heavy';

type LiveTrackingVehicle = {
  vehicleId: string;
  lat: number;
  lng: number;
  speedKph: number;
  heading: number | null;
  updatedAt: string;
  isCongested: boolean;
  trafficLevel: TrafficLevel;
  recentPath?: Array<{
    lat: number;
    lng: number;
    speedKph: number;
    timestamp: string;
  }>;
};

type LiveTrackingAlert = {
  vehicleId: string;
  message: string;
  lat: number;
  lng: number;
  speedKph: number;
  startedAt: string;
  updatedAt: string;
  durationMs?: number;
  durationMinutes?: number;
};

type LiveTrackingSnapshot = {
  generatedAt: string;
  vehicles: LiveTrackingVehicle[];
  alerts: LiveTrackingAlert[];
};

type DashboardMapProps = {
  origin: string;
  destination: string;
  liveTrackingEnabled?: boolean;
};

export function DashboardMap({
  origin,
  destination,
  liveTrackingEnabled = false,
}: DashboardMapProps) {
  const { currentLocation, setCurrentLocation } = useLocationConsent();
  
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const liveMarkersRef = useRef<Map<string, any>>(new Map());
  const livePolylinesRef = useRef<Map<string, any[]>>(new Map());
  const currentLocationMarkerRef = useRef<any>(null);
  const lastAcceptedLocationRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);

  const [isMapActivated, setIsMapActivated] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [bridgeStatusMessage, setBridgeStatusMessage] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamFailureCount, setStreamFailureCount] = useState(0);
  const [trackingStatusMessage, setTrackingStatusMessage] = useState<string | null>(null);
  const [activeTrafficAlerts, setActiveTrafficAlerts] = useState<LiveTrackingAlert[]>([]);
  const [trafficLevelCounts, setTrafficLevelCounts] = useState({ low: 0, moderate: 0, heavy: 0 });

  const mapsApiKey = useMemo(() => {
    return (
      (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
        ?.VITE_GOOGLE_MAPS_API_KEY || ''
    ).trim();
  }, []);

  const apiBaseUrl = useMemo(() => {
    const raw = (
      import.meta as ImportMeta & {
        env?: { VITE_API_URL?: string };
      }
    ).env?.VITE_API_URL;

    return String(raw || '')
      .trim()
      .replace(/\/$/, '');
  }, []);

  const localVehicleId = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'web-driver';
    }

    const storageKey = 'tm_live_tracking_vehicle_id';
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const generated =
      window.crypto?.randomUUID?.() || `web-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
  }, []);

  const normalizedOrigin = origin.trim();
  const normalizedDestination = destination.trim();

  const clearCurrentLocationOverlay = () => {
    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setMap(null);
      currentLocationMarkerRef.current = null;
    }
  };

  const updateCurrentLocationOverlay = (
    latitude: number,
    longitude: number,
    recenter = false
  ) => {
    const gmaps = (window as any).google?.maps;
    if (!gmaps || !mapRef.current || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const map = mapRef.current;
    const position = { lat: latitude, lng: longitude };

    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setPosition(position);
    } else {
      currentLocationMarkerRef.current = new gmaps.Marker({
        map,
        position,
        title: 'Your current location',
        zIndex: 1305,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#2563eb',
          fillOpacity: 0.95,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
    }

    if (recenter) {
      map.panTo(position);
      const currentZoom = Number(map.getZoom() || DEFAULT_ZOOM);
      map.setZoom(Math.max(currentZoom, 16));
    }
  };

  useEffect(() => {
    if (!isMapActivated) {
      return;
    }

    if (!mapsApiKey) {
      setConfigurationError(
        'Google Maps is not configured yet. Add VITE_GOOGLE_MAPS_API_KEY to the frontend environment settings.'
      );
      return;
    }

    let disposed = false;

    async function setupMap() {
      try {
        setOptions({
          key: mapsApiKey,
          v: 'weekly',
        });

        await importLibrary('maps');
        await importLibrary('routes');

        if (disposed || !mapContainerRef.current) {
          return;
        }

        const gmaps = (window as any).google?.maps;
        if (!gmaps) {
          throw new Error('Google Maps runtime not available.');
        }

        const map = new gmaps.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        const directionsRenderer = new gmaps.DirectionsRenderer({
          map,
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#0ea5e9',
            strokeWeight: 6,
            strokeOpacity: 0.95,
          },
        });

        mapRef.current = map;
        directionsServiceRef.current = new gmaps.DirectionsService();
        directionsRendererRef.current = directionsRenderer;
        setConfigurationError(null);
        setMapReady(true);
      } catch (error: any) {
        console.error('Google Maps setup error:', error);
        setConfigurationError(
          error?.message || 'Unable to load Google Maps. Check API key and allowed domains.'
        );
      }
    }

    setupMap();

    return () => {
      disposed = true;
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      clearCurrentLocationOverlay();
      mapRef.current = null;
      directionsServiceRef.current = null;
      directionsRendererRef.current = null;
      setMapReady(false);
    };
  }, [isMapActivated, mapsApiKey]);

  useEffect(() => {
    if (
      !isMapActivated ||
      !mapReady ||
      !directionsServiceRef.current ||
      !directionsRendererRef.current
    ) {
      return;
    }

    if (!normalizedOrigin || !normalizedDestination) {
      directionsRendererRef.current.set('directions', null);
      setRouteSummary(null);
      setRouteOptions([]);
      setSelectedRouteId(null);
      setRouteError(null);
      setRouteNotice(null);
      setBridgeStatusMessage(null);
      setIsRouting(false);
      return;
    }

    let cancelled = false;
    setRouteError(null);
    const debounceHandle = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      const fetchRouteOptions = async () => {
        try {
          setIsRouting(true);

          const gmaps = (window as any).google?.maps;
          if (!gmaps) {
            throw new Error('Google Maps runtime not available.');
          }

          const resolvedOrigin = resolveRouteEndpoint(normalizedOrigin);
          const resolvedDestination = resolveRouteEndpoint(normalizedDestination);
          const isCagayanTrip = isLikelyCagayanTrip(normalizedOrigin, normalizedDestination);
          const bridgeRequested = includesAnyKeyword(
            normalizeText(`${normalizedOrigin} ${normalizedDestination}`),
            ALL_BRIDGE_KEYWORDS
          );
          const steelBridgeExplicitRequest = includesAnyKeyword(
            normalizeText(`${normalizedOrigin} ${normalizedDestination}`),
            TIMED_BRIDGE_KEYWORDS
          );
          const shouldPrioritizeBridgeRoutes = isCagayanTrip || bridgeRequested;
          const routingOriginCandidates = buildRouteLocationCandidates(
            resolvedOrigin,
            shouldPrioritizeBridgeRoutes
          );
          const routingDestinationCandidates = buildRouteLocationCandidates(
            resolvedDestination,
            shouldPrioritizeBridgeRoutes
          );
          const drivingOptions = gmaps.TrafficModel
            ? {
                departureTime: new Date(),
                trafficModel: gmaps.TrafficModel.BEST_GUESS,
              }
            : { departureTime: new Date() };

          const requestDefaults = {
            travelMode: gmaps.TravelMode.DRIVING,
            unitSystem: gmaps.UnitSystem.METRIC,
            drivingOptions,
            region: 'ph',
          };

          const planningRequestDefaults = {
            destination: resolvedDestination,
            travelMode: gmaps.TravelMode.DRIVING,
            unitSystem: gmaps.UnitSystem.METRIC,
            region: 'ph',
          };

          const requestPairs: Array<{ origin: WaypointCandidate; destination: WaypointCandidate }> = [];
          for (const originCandidate of routingOriginCandidates.slice(0, 3)) {
            for (const destinationCandidate of routingDestinationCandidates.slice(0, 3)) {
              requestPairs.push({ origin: originCandidate, destination: destinationCandidate });
            }
          }

          if (requestPairs.length === 0) {
            throw new Error('No valid route candidates available for this trip.');
          }

          setBridgeStatusMessage(
            'Steel bridge hours: 6:00 AM – 6:00 PM (PH time). Plan your trip accordingly.'
          );

          const nextRouteOptions: RouteOption[] = [];
          const seenRouteFingerprints = new Set<string>();
          let steelRouteIncludedCount = 0;
          const addRouteOption = (
            result: any,
            routeIndex: number,
            fallbackLabel: string,
            expectedBridge?: 'steel' | 'buntun'
          ) => {
            const route = result?.routes?.[routeIndex];
            if (!route) {
              return false;
            }

            const usesSteelBridge = routeUsesTimedBridge(route);
            const usesSecondBridge = routeUsesSecondBridge(route);

            const fingerprint = buildRouteFingerprint(route);
            if (seenRouteFingerprints.has(fingerprint)) {
              return false;
            }

            seenRouteFingerprints.add(fingerprint);
            const routeNumber = nextRouteOptions.length + 1;
            const summary = String(route?.summary || fallbackLabel);
            const summaryLower = summary.toLowerCase();
            let summaryText = summary;

            if (usesSteelBridge && !summaryLower.includes('steel bridge')) {
              summaryText = `${summaryText} (Steel Bridge)`;
            }

            if (usesSecondBridge && !summaryLower.includes('buntun bridge')) {
              summaryText = `${summaryText} (Buntun Bridge)`;
            }

            if (usesSteelBridge) {
              steelRouteIncludedCount += 1;
            }

            const primaryLeg = route?.legs?.[0];
            nextRouteOptions.push({
              routeId: `route-${routeNumber}`,
              routeLabel: `Route ${routeNumber}`,
              summaryText,
              distanceText: primaryLeg?.distance?.text || 'N/A',
              durationText: primaryLeg?.duration?.text || 'N/A',
              usesSteelBridge,
              usesSecondBridge,
              directionsResult: result,
              resultRouteIndex: routeIndex,
            });

            return true;
          };

          const isReasonableAlternative = (
            route: any,
            baselineDistanceValue: number | null,
            baselineDurationValue: number | null,
            ratio = MAX_ALLOWED_FORCED_DETOUR_RATIO
          ) => {
            if (baselineDistanceValue == null || baselineDurationValue == null) {
              return true;
            }

            const routeLeg = route?.legs?.[0];
            const distanceValue = Number(routeLeg?.distance?.value ?? NaN);
            const durationValue = Number(routeLeg?.duration?.value ?? NaN);
            if (!Number.isFinite(distanceValue) || !Number.isFinite(durationValue)) {
              return true;
            }

            return (
              distanceValue <= baselineDistanceValue * ratio &&
              durationValue <= baselineDurationValue * ratio
            );
          };

          let primaryResult: any = null;
          let lastRouteLookupError: any = null;
          let activeRoutePair = requestPairs[0];
          let bestPrimaryDistance = Number.POSITIVE_INFINITY;
          let bestPrimaryDuration = Number.POSITIVE_INFINITY;
          for (const pair of requestPairs) {
            try {
              const candidateResult = await directionsServiceRef.current.route({
                ...requestDefaults,
                origin: pair.origin,
                destination: pair.destination,
                provideRouteAlternatives: true,
              });

              if (cancelled) {
                return;
              }

              const candidateLeg = candidateResult?.routes?.[0]?.legs?.[0];
              const candidateDistance = Number(
                candidateLeg?.distance?.value ?? Number.POSITIVE_INFINITY
              );
              const candidateDuration = Number(
                candidateLeg?.duration?.value ?? Number.POSITIVE_INFINITY
              );

              if (
                !primaryResult ||
                candidateDistance < bestPrimaryDistance ||
                (candidateDistance === bestPrimaryDistance && candidateDuration < bestPrimaryDuration)
              ) {
                primaryResult = candidateResult;
                activeRoutePair = pair;
                bestPrimaryDistance = candidateDistance;
                bestPrimaryDuration = candidateDuration;
              }
            } catch (error) {
              lastRouteLookupError = error;
            }
          }

          if (!primaryResult) {
            throw lastRouteLookupError || new Error('Unable to resolve a route from local candidates.');
          }

          const baseRequest = {
            ...requestDefaults,
            origin: activeRoutePair.origin,
            destination: activeRoutePair.destination,
          };

          const planningRequest = {
            ...planningRequestDefaults,
            origin: activeRoutePair.origin,
            destination: activeRoutePair.destination,
          };

          const baselineLeg = primaryResult?.routes?.[0]?.legs?.[0];
          const baselineDistanceValue = Number(
            baselineLeg?.distance?.value != null ? baselineLeg.distance.value : NaN
          );
          const baselineDurationValue = Number(
            baselineLeg?.duration?.value != null ? baselineLeg.duration.value : NaN
          );
          const safeBaselineDistance = Number.isFinite(baselineDistanceValue)
            ? baselineDistanceValue
            : null;
          const safeBaselineDuration = Number.isFinite(baselineDurationValue)
            ? baselineDurationValue
            : null;

          const primaryRouteCount = Number(primaryResult?.routes?.length || 0);
          for (let routeIndex = 0; routeIndex < primaryRouteCount; routeIndex += 1) {
            if (!primaryResult?.routes?.[routeIndex]) {
              break;
            }

            addRouteOption(primaryResult, routeIndex, `Alternative ${routeIndex + 1}`);
          }

          // Detect Solana trips: when destination or origin text resolves to Solana,
          // force the Steel Bridge waypoint so it always appears as a route option.
          // Google Maps doesn't return the Steel Bridge naturally for plain "solana" queries.
          const isSolanaTrip =
            compactAddressText(normalizedDestination) === 'solana' ||
            compactAddressText(normalizedOrigin) === 'solana';

          if (bridgeRequested || isSolanaTrip) {
            const bridgesToForce = bridgeRequested
              ? FORCED_BRIDGE_WAYPOINTS
              : FORCED_BRIDGE_WAYPOINTS.filter((b) => b.expectedBridge === 'steel');
            for (const bridgeRoute of bridgesToForce) {
              for (const waypointCandidate of bridgeRoute.waypointCandidates) {
                try {
                  const forcedBridgeResult = await directionsServiceRef.current.route({
                    ...planningRequest,
                    provideRouteAlternatives: false,
                    waypoints: [{ location: waypointCandidate as any, stopover: false }],
                  });

                  if (cancelled) {
                    return;
                  }

                  const forcedRoute = forcedBridgeResult?.routes?.[0];
                  if (
                    !isReasonableAlternative(
                      forcedRoute,
                      safeBaselineDistance,
                      safeBaselineDuration,
                      MAX_ALLOWED_BRIDGE_DETOUR_RATIO
                    )
                  ) {
                    continue;
                  }

                  const wasAdded = addRouteOption(forcedBridgeResult, 0, bridgeRoute.label);

                  if (wasAdded) {
                    break;
                  }
                } catch {
                  // Try the next waypoint candidate for this bridge.
                }
              }
            }
          }

          const fallbackStrategies = [
            { avoidHighways: true, label: 'Avoid highways' },
            { avoidTolls: true, label: 'Avoid tolls' },
            { avoidFerries: true, label: 'Avoid ferries' },
            { avoidHighways: true, avoidTolls: true, label: 'Avoid highways and tolls' },
            { avoidHighways: true, avoidFerries: true, label: 'Avoid highways and ferries' },
            { avoidTolls: true, avoidFerries: true, label: 'Avoid tolls and ferries' },
            { avoidHighways: true, avoidTolls: true, avoidFerries: true, label: 'Backroads only' },
          ];

          for (const strategy of fallbackStrategies) {
            try {
              const fallbackResult = await directionsServiceRef.current.route({
                ...baseRequest,
                provideRouteAlternatives: false,
                ...strategy,
              });

              if (cancelled) {
                return;
              }

              const fallbackRoute = fallbackResult?.routes?.[0];
              if (
                !isReasonableAlternative(
                  fallbackRoute,
                  safeBaselineDistance,
                  safeBaselineDuration
                )
              ) {
                continue;
              }

              addRouteOption(fallbackResult, 0, strategy.label);
            } catch {
              // Continue trying other fallback combinations.
            }
          }

          if (nextRouteOptions.length === 0) {
            directionsRendererRef.current.set('directions', null);
            setRouteSummary(null);
            setRouteOptions([]);
            setSelectedRouteId(null);
            setRouteNotice(null);
            setRouteError('No driving route was returned for this trip.');
            return;
          }

          const routeNotes: string[] = [];

          if (steelBridgeExplicitRequest && steelRouteIncludedCount === 0) {
            routeNotes.push(
              'Steel Bridge route could not be generated from current Google road data for this request. Try a nearby origin/destination pin for that bridge.'
            );
          }

          setRouteNotice(routeNotes.length > 0 ? routeNotes.join(' ') : null);

          let normalizedRouteOptions = [...nextRouteOptions].sort(compareRouteOptionsByShortest);

          // Drop bridge routes only when a genuinely road-only (no bridge) alternative is
          // shorter. Bridge-vs-bridge comparisons are intentionally kept so the user always
          // has a fallback: e.g. for Solana trips both the Steel Bridge (shortest) and the
          // Buntun Bridge (backup) remain visible. Bridge routes are still removed when a
          // direct road is available — preventing joyrides to Laoag/Claveria via Solana.
          if (!bridgeRequested) {
            const routeDistMeters = (r: RouteOption) =>
              Number(
                r.directionsResult?.routes?.[r.resultRouteIndex]?.legs?.[0]?.distance?.value ??
                  Number.POSITIVE_INFINITY
              );

            const shortestNoBridgeRoute = normalizedRouteOptions
              .filter((r) => !r.usesSteelBridge && !r.usesSecondBridge)
              .reduce((best, r) => Math.min(best, routeDistMeters(r)), Number.POSITIVE_INFINITY);

            if (Number.isFinite(shortestNoBridgeRoute)) {
              normalizedRouteOptions = normalizedRouteOptions.filter((r) => {
                if (!r.usesSteelBridge && !r.usesSecondBridge) return true;
                return routeDistMeters(r) <= shortestNoBridgeRoute * MAX_ALLOWED_BRIDGE_DETOUR_RATIO;
              });
            }
          }

          // Drop routes that start travelling significantly in the WRONG direction.
          // e.g. Solana→Claveria: a route going south to Buntun Bridge first backtracks
          // ~3 km before heading north — that's a joyride, not an efficient route.
          // This replaces the old distance/duration ratio filter which was too aggressive
          // and incorrectly dropped good direct alternatives (leaving only joyrides).
          if (!bridgeRequested) {
            const hasForwardRoute = normalizedRouteOptions.some((r) => {
              const route = r.directionsResult?.routes?.[r.resultRouteIndex];
              return !routeHasDirectionalBacktrack(route);
            });
            if (hasForwardRoute) {
              normalizedRouteOptions = normalizedRouteOptions.filter((r) => {
                const route = r.directionsResult?.routes?.[r.resultRouteIndex];
                return !routeHasDirectionalBacktrack(route);
              });
            }
          }

          normalizedRouteOptions = normalizedRouteOptions.slice(0, MAX_ROUTE_OPTIONS);

          const relabeledRouteOptions = normalizedRouteOptions.map((option, index) => ({
            ...option,
            routeId: `route-${index + 1}`,
            routeLabel: `Route ${index + 1}`,
          }));

          setRouteError(null);
          setRouteOptions(relabeledRouteOptions);
          setSelectedRouteId(relabeledRouteOptions[0].routeId);
          setRouteSummary(relabeledRouteOptions[0]);
        } catch (error: any) {
          if (cancelled) {
            return;
          }

          console.error('Google Maps route error:', error);
          directionsRendererRef.current.set('directions', null);
          setRouteSummary(null);
          setRouteOptions([]);
          setSelectedRouteId(null);
          setRouteNotice(null);
          setRouteError('Unable to plot this route. Check the addresses and try again.');
        } finally {
          if (!cancelled) {
            setIsRouting(false);
          }
        }
      };

      void fetchRouteOptions();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceHandle);
    };
  }, [isMapActivated, mapReady, normalizedOrigin, normalizedDestination]);

  useEffect(() => {
    if (
      !isMapActivated ||
      !mapReady ||
      !directionsRendererRef.current ||
      routeOptions.length === 0
    ) {
      return;
    }

    const activeRoute = routeOptions.find((option) => option.routeId === selectedRouteId) || routeOptions[0];
    directionsRendererRef.current.setDirections(activeRoute.directionsResult);
    directionsRendererRef.current.setRouteIndex(activeRoute.resultRouteIndex);
    setRouteSummary(activeRoute);
  }, [isMapActivated, mapReady, routeOptions, selectedRouteId]);

  useEffect(() => {
    if (!isMapActivated || !mapReady || !apiBaseUrl || !mapRef.current) {
      return;
    }

    const gmaps = (window as any).google?.maps;
    if (!gmaps) {
      return;
    }

    const clearMarkers = () => {
      for (const marker of liveMarkersRef.current.values()) {
        marker.setMap(null);
      }
      liveMarkersRef.current.clear();

      for (const polylineList of livePolylinesRef.current.values()) {
        for (const polyline of polylineList) {
          polyline.setMap(null);
        }
      }
      livePolylinesRef.current.clear();

      setTrafficLevelCounts({ low: 0, moderate: 0, heavy: 0 });
    };

    const buildMarkerIcon = (vehicle: LiveTrackingVehicle) => {
      const isLocalVehicle = vehicle.vehicleId === localVehicleId;
      let fillColor = '#22c55e';
      if (vehicle.trafficLevel === 'moderate') {
        fillColor = '#f97316';
      }
      if (vehicle.trafficLevel === 'heavy') {
        fillColor = '#ef4444';
      }
      if (isLocalVehicle) {
        fillColor = '#0ea5e9';
      }

      return {
        path: gmaps.SymbolPath.CIRCLE,
        scale: isLocalVehicle ? 8 : 7,
        fillColor,
        fillOpacity: 0.95,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      };
    };

    const getSegmentTrafficLevel = (speedKph: number): TrafficLevel => {
      if (speedKph <= 8) {
        return 'heavy';
      }

      if (speedKph <= 25) {
        return 'moderate';
      }

      return 'low';
    };

    const buildPolylineColor = (trafficLevel: TrafficLevel) => {
      if (trafficLevel === 'heavy') {
        return '#ef4444';
      }

      if (trafficLevel === 'moderate') {
        return '#f97316';
      }

      return '#22c55e';
    };

    const syncVehicleMarkers = (vehicles: LiveTrackingVehicle[]) => {
      const visibleVehicleIds = new Set<string>();
      const nextCounts = { low: 0, moderate: 0, heavy: 0 };

      for (const vehicle of vehicles) {
        if (vehicle.vehicleId === localVehicleId) {
          continue;
        }

        if (!Number.isFinite(vehicle.lat) || !Number.isFinite(vehicle.lng)) {
          continue;
        }

        if (vehicle.trafficLevel === 'heavy') {
          nextCounts.heavy += 1;
        } else if (vehicle.trafficLevel === 'moderate') {
          nextCounts.moderate += 1;
        } else {
          nextCounts.low += 1;
        }

        visibleVehicleIds.add(vehicle.vehicleId);
        const markerPosition = { lat: vehicle.lat, lng: vehicle.lng };
        const markerTitle =
          vehicle.vehicleId === localVehicleId
            ? `Your vehicle (${Math.round(vehicle.speedKph)} km/h)`
            : `Vehicle ${vehicle.vehicleId.slice(0, 6)} (${Math.round(vehicle.speedKph)} km/h)`;

        const existingMarker = liveMarkersRef.current.get(vehicle.vehicleId);
        if (existingMarker) {
          existingMarker.setPosition(markerPosition);
          existingMarker.setIcon(buildMarkerIcon(vehicle));
          existingMarker.setTitle(markerTitle);
        } else {
          const marker = new gmaps.Marker({
            map: mapRef.current,
            position: markerPosition,
            title: markerTitle,
            icon: buildMarkerIcon(vehicle),
            zIndex: vehicle.vehicleId === localVehicleId ? 1200 : 1100,
          });

          liveMarkersRef.current.set(vehicle.vehicleId, marker);
        }

        const existingSegmentPolylines = livePolylinesRef.current.get(vehicle.vehicleId) || [];
        for (const segmentLine of existingSegmentPolylines) {
          segmentLine.setMap(null);
        }

        const pathPoints = (vehicle.recentPath || [])
          .map((point) => {
            const lat = Number(point.lat);
            const lng = Number(point.lng);
            const speedKph = Number(point.speedKph);
            const timestamp = Date.parse(String(point.timestamp || ''));

            return {
              lat,
              lng,
              speedKph: Number.isFinite(speedKph) ? speedKph : 0,
              timestamp: Number.isFinite(timestamp) ? timestamp : 0,
            };
          })
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
          .sort((a, b) => a.timestamp - b.timestamp);

        const nextSegmentPolylines: any[] = [];
        for (let index = 1; index < pathPoints.length; index += 1) {
          const previousPoint = pathPoints[index - 1];
          const nextPoint = pathPoints[index];

          if (
            Math.abs(previousPoint.lat - nextPoint.lat) < 0.000001 &&
            Math.abs(previousPoint.lng - nextPoint.lng) < 0.000001
          ) {
            continue;
          }

          const averageSpeedKph = (previousPoint.speedKph + nextPoint.speedKph) / 2;
          const segmentTrafficLevel = getSegmentTrafficLevel(averageSpeedKph);
          const segmentLine = new gmaps.Polyline({
            map: mapRef.current,
            path: [
              { lat: previousPoint.lat, lng: previousPoint.lng },
              { lat: nextPoint.lat, lng: nextPoint.lng },
            ],
            strokeColor: buildPolylineColor(segmentTrafficLevel),
            strokeOpacity: 0.8,
            strokeWeight: 5,
            zIndex: 850,
          });

          nextSegmentPolylines.push(segmentLine);
        }

        if (nextSegmentPolylines.length > 0) {
          livePolylinesRef.current.set(vehicle.vehicleId, nextSegmentPolylines);
        } else {
          livePolylinesRef.current.delete(vehicle.vehicleId);
        }
      }

      for (const [vehicleId, marker] of liveMarkersRef.current.entries()) {
        if (visibleVehicleIds.has(vehicleId)) {
          continue;
        }

        marker.setMap(null);
        liveMarkersRef.current.delete(vehicleId);
      }

      for (const [vehicleId, polylineList] of livePolylinesRef.current.entries()) {
        if (visibleVehicleIds.has(vehicleId)) {
          continue;
        }

        for (const polyline of polylineList) {
          polyline.setMap(null);
        }
        livePolylinesRef.current.delete(vehicleId);
      }

      setTrafficLevelCounts(nextCounts);
    };

    let disposed = false;
    const stream = new EventSource(`${apiBaseUrl}/api/tracking/stream`);

    const onSnapshot = (event: MessageEvent) => {
      if (disposed) {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as LiveTrackingSnapshot;

        // PRIVACY: Only show vehicles on map if user has explicitly enabled Live Tracking
        if (liveTrackingEnabled) {
          syncVehicleMarkers(payload.vehicles || []);
          setActiveTrafficAlerts((payload.alerts || []).slice(0, 3));
        }

        setStreamConnected(true);
        setStreamFailureCount(0);
      } catch (error) {
        console.error('Live tracking snapshot parse error:', error);
      }
    };

    const onCongestionAlert = (event: MessageEvent) => {
      if (disposed) {
        return;
      }

      // PRIVACY: Only show alerts if user has explicitly enabled Live Tracking
      if (!liveTrackingEnabled) {
        return;
      }

      try {
        const alert = JSON.parse(event.data) as LiveTrackingAlert;
        setActiveTrafficAlerts((current) => {
          const withoutVehicle = current.filter((item) => item.vehicleId !== alert.vehicleId);
          return [alert, ...withoutVehicle].slice(0, 3);
        });
      } catch {
        // Ignore malformed alert payloads.
      }
    };

    const onCongestionClear = (event: MessageEvent) => {
      if (disposed) {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as { vehicleId?: string };
        if (!payload.vehicleId) {
          return;
        }

        setActiveTrafficAlerts((current) =>
          current.filter((alert) => alert.vehicleId !== payload.vehicleId)
        );
      } catch {
        // Ignore malformed clear payloads.
      }
    };

    stream.addEventListener('snapshot', onSnapshot as EventListener);
    stream.addEventListener('congestion-alert', onCongestionAlert as EventListener);
    stream.addEventListener('congestion-clear', onCongestionClear as EventListener);
    stream.onerror = () => {
      if (!disposed) {
        setStreamConnected(false);
        setStreamFailureCount((prev) => prev + 1);
      }
    };

    return () => {
      disposed = true;
      stream.close();
      setStreamConnected(false);
      setStreamFailureCount(0);
      setActiveTrafficAlerts([]);
      clearMarkers();
    };
  }, [apiBaseUrl, isMapActivated, localVehicleId, mapReady, liveTrackingEnabled]);

  useEffect(() => {
    if (!isMapActivated) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setTrackingStatusMessage('Browser geolocation is not supported on this device.');
      return;
    }

    setTrackingStatusMessage(
      liveTrackingEnabled
        ? 'Live tracking enabled. Sharing location updates.'
        : 'Live location active (private mode).'
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = position.coords;
        const latitude = Number(coords.latitude);
        const longitude = Number(coords.longitude);
        const accuracy = Number(coords.accuracy);
        const speedMps = Number(coords.speed);
        const speedKph = Number.isFinite(speedMps) && speedMps > 0 ? speedMps * 3.6 : 0;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return;
        }

        const normalizedAccuracy = Number.isFinite(accuracy) ? accuracy : 0;
        const previousLocation = lastAcceptedLocationRef.current;

        if (!previousLocation && normalizedAccuracy > MAX_INITIAL_TRACKING_ACCURACY_METERS) {
          setTrackingStatusMessage('Waiting for a more stable GPS signal...');
          return;
        }

        let nextLatitude = latitude;
        let nextLongitude = longitude;

        if (previousLocation) {
          const driftMeters = haversineDistanceMeters(
            { lat: previousLocation.lat, lng: previousLocation.lng },
            { lat: latitude, lng: longitude }
          );
          const weakSignal = normalizedAccuracy > MAX_STEADY_TRACKING_ACCURACY_METERS;
          const movingFast = Number.isFinite(speedMps) && speedMps >= 2;

          if (weakSignal && !movingFast && driftMeters < MIN_MOVEMENT_FOR_WEAK_SIGNAL_METERS) {
            setTrackingStatusMessage(
              liveTrackingEnabled
                ? 'GPS weak. Holding last stable location while sharing stays active.'
                : 'GPS weak. Holding last stable location.'
            );
            return;
          }

          if (weakSignal && !movingFast) {
            // Smooth weak-signal drift so the marker does not jump around while stationary.
            nextLatitude = previousLocation.lat + (latitude - previousLocation.lat) * 0.3;
            nextLongitude = previousLocation.lng + (longitude - previousLocation.lng) * 0.3;
          }
        }

        lastAcceptedLocationRef.current = {
          lat: nextLatitude,
          lng: nextLongitude,
          accuracy: normalizedAccuracy,
        };

        setCurrentLocation({
          lat: nextLatitude,
          lng: nextLongitude,
          accuracy: normalizedAccuracy,
          timestamp: Date.now(),
        });

        updateCurrentLocationOverlay(nextLatitude, nextLongitude, false);

        if (!liveTrackingEnabled || !apiBaseUrl) {
          return;
        }

        fetch(`${apiBaseUrl}/api/tracking/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vehicleId: localVehicleId,
            lat: nextLatitude,
            lng: nextLongitude,
            speedKph,
            heading: Number.isFinite(Number(coords.heading)) ? Number(coords.heading) : null,
            shareLocation: true,
          }),
        }).catch(() => {
          setTrackingStatusMessage('Live tracking is on, but location sync failed. Retrying...');
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setTrackingStatusMessage('Location permission was denied.');
          return;
        }

        setTrackingStatusMessage('Unable to read live location right now. Retrying automatically...');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 6000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [apiBaseUrl, isMapActivated, liveTrackingEnabled, localVehicleId, setCurrentLocation]);

  const changeZoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const currentZoom = Number(map.getZoom() || DEFAULT_ZOOM);
    map.setZoom(Math.max(3, Math.min(20, currentZoom + delta)));
  };

  const openLiveMap = () => {
    setIsMapActivated(true);
    setRouteError(null);
    setRouteNotice(null);
    setConfigurationError(null);
  };

  return (
    <div className="relative h-full min-h-[600px] overflow-hidden">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {!isMapActivated && (
        <motion.button
          type="button"
          onClick={openLiveMap}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.995 }}
          className="absolute inset-0 z-20 text-left"
        >
          <img
            src="https://images.unsplash.com/photo-1532594722383-b75fb8381b55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb3V0ZSUyMG1hcCUyMG5hdmlnYXRpb258ZW58MXx8fHwxNzczMjAxNjAyfDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Map Navigation"
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100/80 to-slate-200/80 flex items-center justify-center p-6">
            <div className="text-center">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
              >
                <MapPin className="w-10 h-10 text-teal-600" />
              </motion.div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">Interactive Map View</h3>
              <p className="text-slate-500 max-w-sm mb-4">
                Enter origin and destination to view route analysis on the interactive map
              </p>
              <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow border border-slate-200">
                Click to open live Google Map
              </span>
            </div>
          </div>
        </motion.button>
      )}

      {isMapActivated && !configurationError && !mapReady && (
        <div className="absolute inset-0 bg-slate-100/70 flex items-center justify-center p-6 z-20 pointer-events-none">
          <div className="max-w-md text-center">
            <MapPin className="w-10 h-10 text-teal-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800 mb-1">Opening Google Map</h3>
            <p className="text-slate-600 text-sm">Loading map libraries and preparing the live view...</p>
          </div>
        </div>
      )}

      {isMapActivated && configurationError && (
        <div className="absolute inset-0 bg-slate-100/95 flex items-center justify-center p-6 z-20">
          <div className="max-w-md text-center">
            <MapPin className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Map Not Available</h3>
            <p className="text-slate-600">{configurationError}</p>
          </div>
        </div>
      )}

      {isMapActivated &&
        mapReady &&
        !configurationError &&
        !normalizedOrigin &&
        !normalizedDestination && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 shadow"
        >
          Enter origin and destination to preview your route.
        </motion.div>
      )}

      {isMapActivated && routeSummary && (
        <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur rounded-lg shadow-lg border border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="text-xs font-medium text-slate-500">{routeSummary.routeLabel}</div>
            {routeOptions.length > 1 && (
              <div className="flex items-center gap-1">
                {routeOptions.map((option, index) => {
                  const isActive = option.routeId === selectedRouteId;

                  return (
                    <button
                      key={option.routeId}
                      type="button"
                      onClick={() => setSelectedRouteId(option.routeId)}
                      className={`h-6 min-w-6 rounded-full border px-2 text-[10px] font-semibold transition-colors ${isActive ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mb-2 max-w-[240px] truncate text-xs text-slate-500" title={routeSummary.summaryText}>
            {routeSummary.summaryText}
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="font-semibold">{routeSummary.distanceText}</span>
            <span className="text-slate-300">|</span>
            <span>{routeSummary.durationText}</span>
          </div>
          {bridgeStatusMessage && routeSummary.usesSteelBridge && (
            <div className="mt-2 max-w-[260px] text-[10px] text-sky-700">
              {bridgeStatusMessage}
            </div>
          )}
        </div>
      )}

      {isMapActivated && isRouting && !configurationError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-4 py-2 text-xs font-medium">
          Calculating route on Google Maps...
        </div>
      )}

      {isMapActivated && routeError && !configurationError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-50 border border-red-200 text-red-700 rounded-full px-4 py-2 text-xs font-medium">
          {routeError}
        </div>
      )}

      {isMapActivated && routeNotice && !configurationError && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-4 py-2 text-xs font-medium">
          {routeNotice}
        </div>
      )}

      {isMapActivated && liveTrackingEnabled && !configurationError && (
        <div className="absolute top-20 right-4 z-20 max-w-[260px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow">
          <div className="font-semibold text-slate-800">Live Tracking</div>
          <div className={streamConnected ? 'text-emerald-700' : streamFailureCount >= 3 ? 'text-red-600' : 'text-amber-700'}>
            {streamConnected
              ? 'Traffic feed connected'
              : streamFailureCount >= 3
              ? 'Backend offline — live data unavailable'
              : 'Connecting traffic feed...'}
          </div>
          {trackingStatusMessage && streamConnected && (
            <div className="mt-1 text-slate-600">{trackingStatusMessage}</div>
          )}
        </div>
      )}

      {isMapActivated && activeTrafficAlerts.length > 0 && !configurationError && (
        <div className="absolute bottom-4 right-4 z-20 max-w-[280px] rounded-lg border border-red-200 bg-white/95 px-3 py-3 shadow">
          <div className="mb-2 text-xs font-semibold text-red-700">Live Congestion Alerts</div>
          <div className="space-y-2">
            {activeTrafficAlerts.slice(0, 3).map((alert) => (
              <div key={`${alert.vehicleId}-${alert.updatedAt}`} className="rounded border border-red-100 bg-red-50 px-2 py-1">
                <div className="text-[11px] font-medium text-red-800">{alert.message}</div>
                <div className="text-[10px] text-red-700">
                  Vehicle {alert.vehicleId.slice(0, 6)} | {Math.round(alert.speedKph)} km/h
                </div>
                {typeof alert.durationMinutes === 'number' && (
                  <div className="text-[10px] text-red-700">
                    In traffic for {alert.durationMinutes.toFixed(1)} min
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!configurationError && (
        <>
          {isMapActivated && (
            <div className="absolute top-4 right-4 space-y-2 z-20">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => changeZoom(1)}
              className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors"
              aria-label="Zoom in"
              type="button"
            >
              <span className="text-xl">+</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => changeZoom(-1)}
              className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors"
              aria-label="Zoom out"
              type="button"
            >
              <span className="text-xl">−</span>
            </motion.button>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 border border-slate-200 z-20"
          >
            <div className="text-xs font-medium text-slate-700 mb-2">Traffic Legend</div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <motion.div
                  animate={{ scaleX: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-6 h-1.5 bg-green-500 rounded-full"
                />
                <span className="text-xs text-slate-600">Low Traffic ({trafficLevelCounts.low})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-1.5 bg-orange-500 rounded-full" />
                <span className="text-xs text-slate-600">Moderate ({trafficLevelCounts.moderate})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-1.5 bg-red-500 rounded-full" />
                <span className="text-xs text-slate-600">Heavy Traffic ({trafficLevelCounts.heavy})</span>
              </div>
            </div>
            <p className="mt-2 max-w-[190px] text-[10px] text-slate-500">
              Local roads missing from Google data may not appear in generated routes.
            </p>
          </motion.div>
        </>
      )}
    </div>
  );
}
