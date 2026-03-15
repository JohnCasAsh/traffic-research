import { useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';

const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 }; // Manila
const DEFAULT_ZOOM = 12;

type RouteSummary = {
  distanceText: string;
  durationText: string;
};

type DashboardMapProps = {
  origin: string;
  destination: string;
};

export function DashboardMap({ origin, destination }: DashboardMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);

  const [isMapActivated, setIsMapActivated] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const mapsApiKey = useMemo(() => {
    return (
      (import.meta as ImportMeta & { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
        ?.VITE_GOOGLE_MAPS_API_KEY || ''
    ).trim();
  }, []);

  const normalizedOrigin = origin.trim();
  const normalizedDestination = destination.trim();

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
      setRouteError(null);
      setIsRouting(false);
      return;
    }

    let cancelled = false;
    setRouteError(null);
    const debounceHandle = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      setIsRouting(true);

      directionsServiceRef.current
        .route({
          origin: normalizedOrigin,
          destination: normalizedDestination,
          travelMode: (window as any).google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
          unitSystem: (window as any).google.maps.UnitSystem.METRIC,
        })
        .then((result: any) => {
          if (cancelled) {
            return;
          }

          directionsRendererRef.current.setDirections(result);

          const primaryLeg = result?.routes?.[0]?.legs?.[0];
          if (primaryLeg) {
            setRouteSummary({
              distanceText: primaryLeg.distance?.text || 'N/A',
              durationText: primaryLeg.duration?.text || 'N/A',
            });
          } else {
            setRouteSummary(null);
          }
        })
        .catch((error: any) => {
          if (cancelled) {
            return;
          }

          console.error('Google Maps route error:', error);
          directionsRendererRef.current.set('directions', null);
          setRouteSummary(null);
          setRouteError('Unable to plot this route. Check the addresses and try again.');
        })
        .finally(() => {
          if (!cancelled) {
            setIsRouting(false);
          }
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceHandle);
    };
  }, [isMapActivated, mapReady, normalizedOrigin, normalizedDestination]);

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
        <div className="absolute inset-0 bg-slate-100/35 flex items-center justify-center p-6 z-10 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-white/90 backdrop-blur rounded-2xl p-6 shadow-lg border border-slate-200"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow"
            >
              <MapPin className="w-8 h-8 text-teal-600" />
            </motion.div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">Interactive Map View</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Enter origin and destination to preview your driving route on Google Maps.
            </p>
          </motion.div>
        </div>
      )}

      {isMapActivated && routeSummary && (
        <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur rounded-lg shadow-lg border border-slate-200 px-4 py-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Preview Route</div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="font-semibold">{routeSummary.distanceText}</span>
            <span className="text-slate-300">|</span>
            <span>{routeSummary.durationText}</span>
          </div>
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
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-3 h-3 bg-green-500 rounded-full"
                />
                <span className="text-xs text-slate-600">Low Traffic</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
                <span className="text-xs text-slate-600">Moderate</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-xs text-slate-600">Heavy Traffic</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
