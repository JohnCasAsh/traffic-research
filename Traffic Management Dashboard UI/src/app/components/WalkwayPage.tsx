import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { PersonStanding, MapPin, Clock, ArrowLeft, Navigation, ChevronRight, AlertCircle } from 'lucide-react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { useLocationConsent } from '../LocationConsentContext';

const MAPS_API_KEY = (
  (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
    ?.VITE_GOOGLE_MAPS_API_KEY || ''
).trim();

const TUGUEGARAO = { lat: 17.6128, lng: 121.7270 };

type RouteInfo = {
  distance: string;
  duration: string;
  steps: { instruction: string; distance: string }[];
};

export function WalkwayPage() {
  const [searchParams] = useSearchParams();
  const destLat = parseFloat(searchParams.get('dest_lat') || '0');
  const destLng = parseFloat(searchParams.get('dest_lng') || '0');
  const destName = decodeURIComponent(searchParams.get('dest_name') || '');
  const hasDestination = !!(destLat && destLng);

  const { consent, setConsent, currentLocation } = useLocationConsent();
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeError, setRouteError] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapInitRef = useRef(false);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const routeCalcRef = useRef(false);

  // Init map
  useEffect(() => {
    if (mapInitRef.current || !mapContainerRef.current) return;
    mapInitRef.current = true;
    setOptions({ key: MAPS_API_KEY, v: 'weekly' });
    importLibrary('maps').then((mapsLib) => {
      const { Map, DirectionsRenderer } = mapsLib as typeof google.maps;
      mapRef.current = new Map(mapContainerRef.current!, {
        center: hasDestination ? { lat: destLat, lng: destLng } : TUGUEGARAO,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      rendererRef.current = new DirectionsRenderer({
        polylineOptions: { strokeColor: '#0d9488', strokeWeight: 5, strokeOpacity: 0.85 },
      });
      rendererRef.current.setMap(mapRef.current);
      setMapReady(true);
    });
  }, []);

  const calculateRoute = (origin: { lat: number; lng: number } | null) => {
    if (!mapRef.current || !hasDestination || routeCalcRef.current) return;
    routeCalcRef.current = true;
    setCalculating(true);
    setRouteError('');

    const service = new google.maps.DirectionsService();
    const originLatLng = origin
      ? { lat: origin.lat, lng: origin.lng }
      : TUGUEGARAO;

    service.route(
      {
        origin: new google.maps.LatLng(originLatLng.lat, originLatLng.lng),
        destination: new google.maps.LatLng(destLat, destLng),
        travelMode: google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        routeCalcRef.current = false;
        setCalculating(false);
        if (status === google.maps.DirectionsStatus.OK && result) {
          rendererRef.current?.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            setRouteInfo({
              distance: leg.distance?.text || '—',
              duration: leg.duration?.text || '—',
              steps: (leg.steps || []).map((s) => ({
                instruction: s.instructions?.replace(/<[^>]*>/g, '') || '',
                distance: s.distance?.text || '',
              })),
            });
            mapRef.current?.fitBounds(result.routes[0].bounds);
          }
        } else {
          setRouteError('Could not calculate walking route. Try again.');
        }
      }
    );
  };

  // Calculate once map is ready
  useEffect(() => {
    if (!mapReady || !hasDestination) return;
    calculateRoute(currentLocation);
  }, [mapReady]);

  // Recalculate when GPS becomes available
  useEffect(() => {
    if (!mapReady || !hasDestination || !currentLocation || routeInfo) return;
    calculateRoute(currentLocation);
  }, [currentLocation, mapReady]);

  // No destination — show picker state
  if (!hasDestination) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center mx-auto">
            <PersonStanding className="w-8 h-8 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Walkway</h1>
            <p className="text-sm text-slate-500 mt-1">Walking directions to any parking spot or gas station</p>
          </div>
          <Link
            to="/commuter-dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition"
          >
            <MapPin className="w-4 h-4" />
            Pick a Destination
          </Link>
          <p className="text-xs text-slate-400">Go to the Dashboard, select a location, then tap "Walk There".</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Left panel ── */}
      <div className="w-72 flex-shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100">
          <Link
            to="/commuter-dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-600 transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
              <PersonStanding className="w-5 h-5 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm">Walking Route</p>
              <p className="text-xs text-slate-500 truncate">To: {destName}</p>
            </div>
          </div>
        </div>

        {/* GPS toggle */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${consent.isConsented ? (currentLocation ? 'bg-teal-500 animate-pulse' : 'bg-amber-400 animate-pulse') : 'bg-slate-300'}`} />
            <span className="text-xs text-slate-500 truncate">
              {consent.isConsented ? (currentLocation ? 'Using your live location' : 'Getting GPS…') : 'Using city center as start'}
            </span>
          </div>
          <button
            onClick={() => {
              if (consent.isConsented) {
                setConsent(false);
              } else {
                setConsent(true);
              }
            }}
            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${consent.isConsented ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
          >
            {consent.isConsented ? 'Stop' : 'Use GPS'}
          </button>
        </div>

        {/* Route summary */}
        {calculating && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">Calculating walking route…</div>
        )}

        {routeError && (
          <div className="px-4 py-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {routeError}
          </div>
        )}

        {routeInfo && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1 text-teal-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-bold text-sm">{routeInfo.duration}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Walk time</p>
              </div>
              <div className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1 text-blue-600">
                  <Navigation className="w-3.5 h-3.5" />
                  <span className="font-bold text-sm">{routeInfo.distance}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Distance</p>
              </div>
            </div>

            {/* Turn-by-turn steps */}
            <div className="flex-1 overflow-y-auto">
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Directions</p>
              <div className="divide-y divide-slate-50">
                {routeInfo.steps.map((step, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ChevronRight className="w-3 h-3 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed">{step.instruction}</p>
                      {step.distance && <p className="text-xs text-slate-400 mt-0.5">{step.distance}</p>}
                    </div>
                  </div>
                ))}
                {/* Destination */}
                <div className="px-4 py-2.5 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-3 h-3 text-red-500" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">{destName}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {!routeInfo && !calculating && !routeError && (
          <div className="flex-1" />
        )}
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Recalculate with GPS hint */}
        {currentLocation && routeInfo && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              Route from your live location
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
