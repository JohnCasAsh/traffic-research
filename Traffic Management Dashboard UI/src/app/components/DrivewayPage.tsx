/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Car, MapPin, Clock, ArrowLeft, Navigation, ChevronRight, AlertCircle, Gauge } from 'lucide-react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { useLocationConsent } from '../LocationConsentContext';

const MAPS_API_KEY = (
  (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
    ?.VITE_GOOGLE_MAPS_API_KEY || ''
).trim();

const TUGUEGARAO = { lat: 17.6128, lng: 121.7270 };

type RouteOption = {
  distance: string;
  duration: string;
  durationSecs: number;
  summary: string;
  steps: { instruction: string; distance: string }[];
};

export function DrivewayPage() {
  const [searchParams] = useSearchParams();
  const destLat = parseFloat(searchParams.get('dest_lat') || '0');
  const destLng = parseFloat(searchParams.get('dest_lng') || '0');
  const destName = decodeURIComponent(searchParams.get('dest_name') || '');
  const originLat = parseFloat(searchParams.get('origin_lat') || '0');
  const originLng = parseFloat(searchParams.get('origin_lng') || '0');
  const hasManualOrigin = !!(originLat && originLng);
  const hasDestination = !!(destLat && destLng);

  const { currentLocation, setCurrentLocation } = useLocationConsent();
  const [gpsMsg, setGpsMsg] = useState('Getting GPS…');
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [routeError, setRouteError] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapInitRef = useRef(false);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const routeCalcRef = useRef(false);

  useEffect(() => {
    if (mapInitRef.current || !mapContainerRef.current) return;
    mapInitRef.current = true;
    setOptions({ key: MAPS_API_KEY, v: 'weekly' });

    Promise.all([importLibrary('maps'), importLibrary('routes')]).then(([mapsLib, routesLib]) => {
      const { Map } = mapsLib as typeof google.maps;
      const { DirectionsRenderer } = routesLib as typeof google.maps;

      mapRef.current = new Map(mapContainerRef.current!, {
        center: hasDestination ? { lat: destLat, lng: destLng } : TUGUEGARAO,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      rendererRef.current = new DirectionsRenderer({
        polylineOptions: { strokeColor: '#2563eb', strokeWeight: 5, strokeOpacity: 0.9 },
        suppressMarkers: false,
      });
      rendererRef.current.setMap(mapRef.current);
      setMapReady(true);
    }).catch(() => setRouteError('Failed to load map. Please refresh.'));
  }, []);

  const calculateRoute = (origin: { lat: number; lng: number } | null) => {
    if (!mapRef.current || !hasDestination || routeCalcRef.current) return;
    routeCalcRef.current = true;
    setCalculating(true);
    setRouteError('');

    const service = new google.maps.DirectionsService();
    const originLatLng = origin ?? TUGUEGARAO;

    service.route(
      {
        origin: new google.maps.LatLng(originLatLng.lat, originLatLng.lng),
        destination: new google.maps.LatLng(destLat, destLng),
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        routeCalcRef.current = false;
        setCalculating(false);

        if (status === google.maps.DirectionsStatus.OK && result && result.routes.length > 0) {
          rendererRef.current?.setDirections(result);
          rendererRef.current?.setRouteIndex(0);

          const options: RouteOption[] = result.routes.map((route) => {
            const leg = route.legs[0];
            return {
              distance: leg.distance?.text || '—',
              duration: leg.duration?.text || '—',
              durationSecs: leg.duration?.value ?? 0,
              summary: route.summary || '',
              steps: (leg.steps || []).map((s) => ({
                instruction: s.instructions?.replace(/<[^>]*>/g, '') || '',
                distance: s.distance?.text || '',
              })),
            };
          });

          setRouteOptions(options);
          setSelectedIndex(0);
          mapRef.current?.fitBounds(result.routes[0].bounds);
        } else {
          setRouteError('Could not calculate driving route. Try again.');
        }
      }
    );
  };

  const selectRoute = (idx: number) => {
    setSelectedIndex(idx);
    rendererRef.current?.setRouteIndex(idx);
  };

  // GPS watcher — auto-start
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsMsg('');
        setCurrentLocation({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, timestamp: Date.now(),
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) { setGpsMsg('Location permission was denied.'); return; }
        setGpsMsg('Unable to get location. Retrying…');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 6000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [setCurrentLocation]);

  useEffect(() => {
    if (!mapReady || !hasDestination) return;
    const origin = currentLocation ?? (hasManualOrigin ? { lat: originLat, lng: originLng } : null);
    calculateRoute(origin);
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !hasDestination || !currentLocation || routeOptions.length > 0) return;
    routeCalcRef.current = false;
    calculateRoute(currentLocation);
  }, [currentLocation]);

  const activeRoute = routeOptions[selectedIndex] ?? null;

  if (!hasDestination) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto">
            <Car className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Driveway</h1>
            <p className="text-sm text-slate-500 mt-1">Driving directions to any parking spot or gas station</p>
          </div>
          <Link
            to="/commuter-dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            <MapPin className="w-4 h-4" /> Pick a Destination
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Left panel ── */}
      <div className="w-full md:w-72 md:flex-shrink-0 flex flex-col bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-hidden md:h-full" style={{ maxHeight: '55vh' }}>

        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
          <Link
            to="/commuter-dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm">Driving Routes</p>
              <p className="text-xs text-slate-500 truncate">To: {destName}</p>
            </div>
          </div>
        </div>

        {/* GPS status */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentLocation ? 'bg-blue-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          <span className="text-xs text-slate-500 truncate">
            {currentLocation ? 'Using your live location' : hasManualOrigin ? 'Using selected start location' : gpsMsg}
          </span>
        </div>

        {calculating && (
          <div className="px-4 py-6 text-center text-sm text-slate-400 flex-shrink-0">Calculating routes…</div>
        )}
        {routeError && (
          <div className="px-4 py-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 border-b border-red-100 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {routeError}
          </div>
        )}

        {routeOptions.length > 0 && (
          <>
            {/* Route alternative tabs */}
            <div className="px-3 py-2.5 border-b border-slate-100 flex-shrink-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                {routeOptions.length} Route{routeOptions.length > 1 ? 's' : ''} Found
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {routeOptions.map((route, i) => (
                  <button
                    key={i}
                    onClick={() => selectRoute(i)}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border text-xs font-semibold transition min-w-[72px] ${
                      selectedIndex === i
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <span className="font-bold text-sm">{route.duration}</span>
                    <span className={`text-[10px] ${selectedIndex === i ? 'text-blue-100' : 'text-slate-400'}`}>
                      {route.distance}
                    </span>
                    {route.summary ? (
                      <span className={`text-[9px] mt-0.5 truncate max-w-[60px] ${selectedIndex === i ? 'text-blue-200' : 'text-slate-400'}`}>
                        via {route.summary}
                      </span>
                    ) : i === 0 ? (
                      <span className={`text-[9px] mt-0.5 font-bold uppercase tracking-wide ${selectedIndex === i ? 'text-blue-200' : 'text-blue-600'}`}>
                        Fastest
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Active route stats */}
            {activeRoute && (
              <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 flex-shrink-0">
                <div className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-bold text-sm">{activeRoute.duration}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Drive time</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-slate-600">
                    <Gauge className="w-3.5 h-3.5" />
                    <span className="font-bold text-sm">{activeRoute.distance}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Distance</p>
                </div>
              </div>
            )}

            {/* Turn-by-turn directions */}
            {activeRoute && (
              <div className="flex-1 overflow-y-auto">
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Directions</p>
                <div className="divide-y divide-slate-50">
                  {activeRoute.steps.map((step, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ChevronRight className="w-3 h-3 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-relaxed">{step.instruction}</p>
                        {step.distance && <p className="text-xs text-slate-400 mt-0.5">{step.distance}</p>}
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-3 h-3 text-red-500" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{destName}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!routeOptions.length && !calculating && !routeError && <div className="flex-1" />}
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative min-h-[45vh] md:min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {currentLocation && routeOptions.length > 0 && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Route from your live location
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
