import { useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';
import {
  formatLocationAccuracy,
  MAX_LIVE_TRACKING_ACCURACY_METERS,
  parseCoordinateInput,
} from '../location';

const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 }; // Manila
const DEFAULT_ZOOM = 12;
const LOCAL_TRAFFIC_STREAM_RADIUS_KM = 5;
const TRAFFIC_STREAM_RECENTER_METERS = 800;
const MAX_ROUTE_OPTIONS = 3;
const MAX_ALLOWED_FORCED_DETOUR_RATIO = 1.4;
const BRIDGE_OPEN_HOUR = 6; // 6:00 AM
const BRIDGE_CLOSE_HOUR = 18; // 6:00 PM
const BRIDGE_MATCH_RADIUS_DEGREES = 0.004;
const STEEL_BRIDGE_COORD = { lat: 17.6409, lng: 121.7015 };
const BUNTUN_BRIDGE_COORD = { lat: 17.6185, lng: 121.6889 };
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
const CAGAYAN_AREA_HINTS = ['caggay', 'tuguegarao', 'solana', 'cagayan'];

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

function isLikelyCagayanTrip(origin: string, destination: string) {
  const combined = `${normalizeText(origin)} ${normalizeText(destination)}`;
  return includesAnyKeyword(combined, CAGAYAN_AREA_HINTS);
}

function getManilaHour() {
  const hourText = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila',
  }).format(new Date());
  const hour = Number.parseInt(hourText, 10);

  return Number.isFinite(hour) ? hour : new Date().getHours();
}

function isBridgeOpenNow() {
  const hour = getManilaHour();
  return hour >= BRIDGE_OPEN_HOUR && hour < BRIDGE_CLOSE_HOUR;
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

function distanceBetweenPointsMeters(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);
  const startLatRadians = toRadians(start.lat);
  const endLatRadians = toRadians(end.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLatRadians) * Math.cos(endLatRadians) * Math.sin(deltaLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
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

export function DashboardMap({ origin, destination, liveTrackingEnabled = false }: DashboardMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const liveMarkersRef = useRef<Map<string, any>>(new Map());
  const livePolylinesRef = useRef<Map<string, any[]>>(new Map());

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
  const [bridgeOpenNow, setBridgeOpenNow] = useState(true);
  const [streamConnected, setStreamConnected] = useState(false);
  const [trackingStatusMessage, setTrackingStatusMessage] = useState<string | null>(null);
  const [activeTrafficAlerts, setActiveTrafficAlerts] = useState<LiveTrackingAlert[]>([]);
  const [trafficLevelCounts, setTrafficLevelCounts] = useState({ low: 0, moderate: 0, heavy: 0 });
  const [localTrackingPosition, setLocalTrackingPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [trafficStreamAnchor, setTrafficStreamAnchor] = useState<{ lat: number; lng: number } | null>(null);

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
  const resolvedOrigin = useMemo(
    () => parseCoordinateInput(normalizedOrigin) || normalizedOrigin,
    [normalizedOrigin]
  );
  const resolvedDestination = useMemo(
    () => parseCoordinateInput(normalizedDestination) || normalizedDestination,
    [normalizedDestination]
  );
  const originCoordinate = useMemo(() => parseCoordinateInput(normalizedOrigin), [normalizedOrigin]);
  const activeRouteOption = useMemo(
    () => routeOptions.find((option) => option.routeId === selectedRouteId) || routeOptions[0] || null,
    [routeOptions, selectedRouteId]
  );
  const routeStartCoordinate = useMemo(() => {
    const startLocation = activeRouteOption?.directionsResult?.routes?.[activeRouteOption.resultRouteIndex]?.legs?.[0]?.start_location;
    return getPointLatLng(startLocation);
  }, [activeRouteOption]);
  const trafficFocusCoordinate = localTrackingPosition || originCoordinate || routeStartCoordinate;

  useEffect(() => {
    if (!trafficFocusCoordinate) {
      setTrafficStreamAnchor(null);
      return;
    }

    setTrafficStreamAnchor((currentAnchor) => {
      if (!currentAnchor) {
        return trafficFocusCoordinate;
      }

      const movedMeters = distanceBetweenPointsMeters(currentAnchor, trafficFocusCoordinate);
      if (movedMeters < TRAFFIC_STREAM_RECENTER_METERS) {
        return currentAnchor;
      }

      return trafficFocusCoordinate;
    });
  }, [trafficFocusCoordinate]);

  const trafficStreamUrl = useMemo(() => {
    if (!apiBaseUrl || !trafficStreamAnchor) {
      return null;
    }

    const query = new URLSearchParams({
      lat: trafficStreamAnchor.lat.toFixed(6),
      lng: trafficStreamAnchor.lng.toFixed(6),
      radiusKm: String(LOCAL_TRAFFIC_STREAM_RADIUS_KM),
    });

    return `${apiBaseUrl}/api/tracking/stream?${query.toString()}`;
  }, [apiBaseUrl, trafficStreamAnchor]);

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

          const isCagayanTrip = isLikelyCagayanTrip(normalizedOrigin, normalizedDestination);
          const drivingOptions = gmaps.TrafficModel
            ? {
                departureTime: new Date(),
                trafficModel: gmaps.TrafficModel.BEST_GUESS,
              }
            : { departureTime: new Date() };

          const baseRequest = {
            origin: resolvedOrigin,
            destination: resolvedDestination,
            travelMode: gmaps.TravelMode.DRIVING,
            unitSystem: gmaps.UnitSystem.METRIC,
            drivingOptions,
          };

          const planningRequest = {
            origin: resolvedOrigin,
            destination: resolvedDestination,
            travelMode: gmaps.TravelMode.DRIVING,
            unitSystem: gmaps.UnitSystem.METRIC,
          };

          const bridgeIsOpen = isBridgeOpenNow();
          setBridgeOpenNow(bridgeIsOpen);
          setBridgeStatusMessage(
            bridgeIsOpen
              ? 'Bridge schedule: Steel bridge open 6:00 AM to 6:00 PM (PH time).'
              : 'Bridge schedule: Steel bridge closed now (opens at 6:00 AM, PH time).'
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
            if (nextRouteOptions.length >= MAX_ROUTE_OPTIONS) {
              return false;
            }

            const route = result?.routes?.[routeIndex];
            if (!route) {
              return false;
            }

            const usesSteelBridge = routeUsesTimedBridge(route);
            const usesSecondBridge = routeUsesSecondBridge(route);

            if (expectedBridge === 'steel' && !usesSteelBridge) {
              return false;
            }

            if (expectedBridge === 'buntun' && !usesSecondBridge) {
              return false;
            }

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

            if (usesSteelBridge && !bridgeIsOpen && !summaryLower.includes('closed')) {
              summaryText = `${summaryText} (Bridge Closed Now)`;
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
            baselineDurationValue: number | null
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
              distanceValue <= baselineDistanceValue * MAX_ALLOWED_FORCED_DETOUR_RATIO &&
              durationValue <= baselineDurationValue * MAX_ALLOWED_FORCED_DETOUR_RATIO
            );
          };

          const primaryResult = await directionsServiceRef.current.route({
            ...baseRequest,
            provideRouteAlternatives: true,
          });

          if (cancelled) {
            return;
          }

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

          for (let routeIndex = 0; routeIndex < MAX_ROUTE_OPTIONS; routeIndex += 1) {
            if (!primaryResult?.routes?.[routeIndex]) {
              break;
            }

            addRouteOption(primaryResult, routeIndex, `Alternative ${routeIndex + 1}`);
          }

          if (isCagayanTrip) {
            for (const bridgeRoute of FORCED_BRIDGE_WAYPOINTS) {
              if (nextRouteOptions.length >= MAX_ROUTE_OPTIONS) {
                break;
              }

              for (const waypointCandidate of bridgeRoute.waypointCandidates) {
                if (nextRouteOptions.length >= MAX_ROUTE_OPTIONS) {
                  break;
                }

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
                      safeBaselineDuration
                    )
                  ) {
                    continue;
                  }

                  const wasAdded = addRouteOption(
                    forcedBridgeResult,
                    0,
                    bridgeRoute.label,
                    bridgeRoute.expectedBridge
                  );

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
          ];

          for (const strategy of fallbackStrategies) {
            if (nextRouteOptions.length >= MAX_ROUTE_OPTIONS) {
              break;
            }

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

          if (isCagayanTrip && steelRouteIncludedCount === 0) {
            routeNotes.push(
              'Steel Bridge route could not be generated from current Google road data for this request. Try a nearby origin/destination pin for that bridge.'
            );
          }

          setRouteNotice(routeNotes.length > 0 ? routeNotes.join(' ') : null);

          let normalizedRouteOptions = nextRouteOptions.slice(0, MAX_ROUTE_OPTIONS);
          if (!bridgeIsOpen) {
            normalizedRouteOptions = [...normalizedRouteOptions].sort((a, b) => {
              if (a.usesSteelBridge === b.usesSteelBridge) {
                return 0;
              }

              return a.usesSteelBridge ? 1 : -1;
            });
          }

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

    if (!trafficStreamUrl) {
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
      setActiveTrafficAlerts([]);
      setStreamConnected(false);
      return;
    }

    let disposed = false;
    const stream = new EventSource(trafficStreamUrl);

    const onSnapshot = (event: MessageEvent) => {
      if (disposed) {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as LiveTrackingSnapshot;
        syncVehicleMarkers(payload.vehicles || []);
        setActiveTrafficAlerts((payload.alerts || []).slice(0, 3));
        setStreamConnected(true);
      } catch (error) {
        console.error('Live tracking snapshot parse error:', error);
      }
    };

    const onCongestionAlert = (event: MessageEvent) => {
      if (disposed) {
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
      }
    };

    return () => {
      disposed = true;
      stream.close();
      setStreamConnected(false);
      setActiveTrafficAlerts([]);
      clearMarkers();
    };
  }, [apiBaseUrl, isMapActivated, localVehicleId, mapReady, trafficStreamUrl]);

  useEffect(() => {
    if (!liveTrackingEnabled) {
      setTrackingStatusMessage(null);
      return;
    }

    if (!apiBaseUrl) {
      setTrackingStatusMessage('Live tracking unavailable: VITE_API_URL is not configured.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setTrackingStatusMessage('Live tracking unavailable: browser geolocation is not supported.');
      return;
    }

    setTrackingStatusMessage('Live tracking enabled. Sharing location updates.');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = position.coords;
        const accuracyMeters = Number(coords.accuracy);
        if (
          Number.isFinite(accuracyMeters) &&
          accuracyMeters > MAX_LIVE_TRACKING_ACCURACY_METERS
        ) {
          const accuracyText = formatLocationAccuracy(accuracyMeters);
          setTrackingStatusMessage(
            accuracyText
              ? `Waiting for a more accurate GPS fix before sharing live updates. Current accuracy is about ${accuracyText}.`
              : 'Waiting for a more accurate GPS fix before sharing live updates.'
          );
          return;
        }

        const speedMps = Number(coords.speed);
        const speedKph = Number.isFinite(speedMps) && speedMps > 0 ? speedMps * 3.6 : 0;

        setLocalTrackingPosition({
          lat: coords.latitude,
          lng: coords.longitude,
        });

        setTrackingStatusMessage('Live tracking enabled. Sharing location updates.');

        fetch(`${apiBaseUrl}/api/tracking/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vehicleId: localVehicleId,
            lat: coords.latitude,
            lng: coords.longitude,
            speedKph,
            heading: Number.isFinite(Number(coords.heading)) ? Number(coords.heading) : null,
          }),
        }).catch(() => {
          setTrackingStatusMessage('Live tracking is on, but location sync failed. Retrying...');
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setTrackingStatusMessage('PERMISSION_DENIED');
          return;
        }

        setTrackingStatusMessage('Unable to read your location right now. Live tracking will retry automatically.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [apiBaseUrl, liveTrackingEnabled, localVehicleId]);

  useEffect(() => {
    if (liveTrackingEnabled) {
      return;
    }

    setLocalTrackingPosition(null);
  }, [liveTrackingEnabled]);

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
            <div className={`mt-2 max-w-[260px] text-[10px] ${bridgeOpenNow ? 'text-emerald-700' : 'text-amber-700'}`}>
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

      {isMapActivated && liveTrackingEnabled && !configurationError && (
        <div className="absolute top-20 right-4 z-20 max-w-[260px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow">
          <div className="font-semibold text-slate-800">Live Tracking</div>
          <div className={streamConnected ? 'text-emerald-700' : 'text-amber-700'}>
            {streamConnected ? 'Traffic feed connected' : 'Connecting traffic feed...'}
          </div>
          {trackingStatusMessage === 'PERMISSION_DENIED' ? (
            <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[10px] text-red-800">
              <div className="mb-1 font-semibold">Location permission is blocked.</div>
              <div className="mb-1 font-medium">To re-enable:</div>
              <div className="font-semibold">Android (Chrome):</div>
              <div>Tap the lock icon in the address bar → Permissions → Location → Allow</div>
              <div className="mt-1 font-semibold">iPhone/iPad (Safari):</div>
              <div>Settings → Safari → Location → Ask or Allow</div>
              <div className="mt-1 font-semibold">iPhone/iPad (Chrome):</div>
              <div>Settings → Chrome → Location → While Using</div>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 w-full rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white"
              >
                Reload after granting permission
              </button>
            </div>
          ) : trackingStatusMessage ? (
            <div className="mt-1 text-slate-600">{trackingStatusMessage}</div>
          ) : null}
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
