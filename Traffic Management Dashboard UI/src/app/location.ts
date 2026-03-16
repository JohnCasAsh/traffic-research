const DEFAULT_LOCATION_TIMEOUT_MS = 10000;
const DEFAULT_SETTLE_TIME_MS = 2500;

export const TARGET_LOCATION_ACCURACY_METERS = 100;
export const MAX_ACCEPTABLE_LOCATION_ACCURACY_METERS = 250;
export const MAX_LIVE_TRACKING_ACCURACY_METERS = 250;

export type CoordinatePoint = {
  lat: number;
  lng: number;
};

export type GeolocationLookupErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'timeout'
  | 'coarse-location'
  | 'unavailable';

export type ReliableCurrentPositionResult = {
  position: GeolocationPosition;
  accuracyMeters: number;
  precise: boolean;
};

export class GeolocationLookupError extends Error {
  code: GeolocationLookupErrorCode;
  accuracyMeters?: number;

  constructor(code: GeolocationLookupErrorCode, message: string, accuracyMeters?: number) {
    super(message);
    this.name = 'GeolocationLookupError';
    this.code = code;
    this.accuracyMeters = accuracyMeters;
  }
}

function isFinitePositiveNumber(value: number) {
  return Number.isFinite(value) && value > 0;
}

function getAccuracyMeters(position: GeolocationPosition) {
  const accuracy = Number(position.coords?.accuracy);
  return isFinitePositiveNumber(accuracy) ? accuracy : Number.POSITIVE_INFINITY;
}

function mapGeolocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return new GeolocationLookupError('permission-denied', 'Location permission was denied.');
  }

  if (error.code === error.TIMEOUT) {
    return new GeolocationLookupError('timeout', 'Timed out while reading location.');
  }

  return new GeolocationLookupError('unavailable', 'Unable to determine your location.');
}

export function formatLocationAccuracy(accuracyMeters: number | null | undefined) {
  const numericAccuracy = Number(accuracyMeters);
  if (!isFinitePositiveNumber(numericAccuracy)) {
    return null;
  }

  if (numericAccuracy >= 1000) {
    const kilometers = numericAccuracy / 1000;
    return `${kilometers.toFixed(kilometers >= 10 ? 0 : 1)} km`;
  }

  return `${Math.round(numericAccuracy)} m`;
}

export function parseCoordinateInput(value: string): CoordinatePoint | null {
  const match = value.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/);
  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

type ReliableCurrentPositionOptions = {
  desiredAccuracyMeters?: number;
  maxAcceptableAccuracyMeters?: number;
  timeoutMs?: number;
  settleTimeMs?: number;
};

export function getReliableCurrentPosition(
  options: ReliableCurrentPositionOptions = {}
): Promise<ReliableCurrentPositionResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(
      new GeolocationLookupError('unsupported', 'Location is not supported in this browser.')
    );
  }

  const desiredAccuracyMeters = Math.max(
    1,
    Number(options.desiredAccuracyMeters) || TARGET_LOCATION_ACCURACY_METERS
  );
  const maxAcceptableAccuracyMeters = Math.max(
    desiredAccuracyMeters,
    Number(options.maxAcceptableAccuracyMeters) || MAX_ACCEPTABLE_LOCATION_ACCURACY_METERS
  );
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_LOCATION_TIMEOUT_MS);
  const settleTimeMs = Math.max(500, Number(options.settleTimeMs) || DEFAULT_SETTLE_TIME_MS);

  return new Promise((resolve, reject) => {
    let settled = false;
    let bestPosition: GeolocationPosition | null = null;
    let bestAccuracyMeters = Number.POSITIVE_INFINITY;
    let settleTimerId: ReturnType<typeof setTimeout> | null = null;
    let watchId: number | null = null;
    let lastError: GeolocationPositionError | null = null;

    const clearTimers = (overallTimerId: ReturnType<typeof setTimeout>) => {
      globalThis.clearTimeout(overallTimerId);
      if (settleTimerId) {
        globalThis.clearTimeout(settleTimerId);
      }
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };

    const finish = (overallTimerId: ReturnType<typeof setTimeout>, callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimers(overallTimerId);
      callback();
    };

    const resolveBestPosition = (overallTimerId: ReturnType<typeof setTimeout>) => {
      finish(overallTimerId, () => {
        if (!bestPosition) {
          if (lastError) {
            reject(mapGeolocationError(lastError));
            return;
          }

          reject(new GeolocationLookupError('timeout', 'Unable to get a location fix in time.'));
          return;
        }

        if (bestAccuracyMeters > maxAcceptableAccuracyMeters) {
          reject(
            new GeolocationLookupError(
              'coarse-location',
              'Location accuracy is too broad.',
              bestAccuracyMeters
            )
          );
          return;
        }

        resolve({
          position: bestPosition,
          accuracyMeters: bestAccuracyMeters,
          precise: bestAccuracyMeters <= desiredAccuracyMeters,
        });
      });
    };

    const overallTimerId = globalThis.setTimeout(() => {
      resolveBestPosition(overallTimerId);
    }, timeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracyMeters = getAccuracyMeters(position);
        if (!bestPosition || accuracyMeters < bestAccuracyMeters) {
          bestPosition = position;
          bestAccuracyMeters = accuracyMeters;
        }

        if (accuracyMeters <= desiredAccuracyMeters) {
          finish(overallTimerId, () => {
            resolve({
              position,
              accuracyMeters,
              precise: true,
            });
          });
          return;
        }

        if (bestAccuracyMeters <= maxAcceptableAccuracyMeters && !settleTimerId) {
          settleTimerId = globalThis.setTimeout(() => {
            resolveBestPosition(overallTimerId);
          }, settleTimeMs);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          finish(overallTimerId, () => {
            reject(mapGeolocationError(error));
          });
          return;
        }

        lastError = error;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      }
    );
  });
}