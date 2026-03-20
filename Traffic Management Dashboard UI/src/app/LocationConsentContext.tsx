import React, { createContext, useContext, useState } from 'react';

export type LocationConsent = {
  isConsented: boolean;
  lastUpdated: number;
};

type LocationConsentContextType = {
  consent: LocationConsent;
  setConsent: (consent: boolean) => void;
  currentLocation: { lat: number; lng: number; accuracy: number; timestamp: number } | null;
  setCurrentLocation: (
    location: { lat: number; lng: number; accuracy: number; timestamp: number } | null
  ) => void;
  isSharingLocation: boolean;
};

const LocationConsentContext = createContext<LocationConsentContextType | undefined>(undefined);

const CONSENT_STORAGE_KEY = 'tm_location_consent';
const CONSENT_STORAGE_KEY_TIMESTAMP = 'tm_location_consent_timestamp';

export function LocationConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<LocationConsent>(() => {
    if (typeof window === 'undefined') {
      return { isConsented: false, lastUpdated: 0 };
    }

    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    const timestamp = window.localStorage.getItem(CONSENT_STORAGE_KEY_TIMESTAMP);

    return {
      isConsented: stored === 'true',
      lastUpdated: timestamp ? Number.parseInt(timestamp, 10) : 0,
    };
  });

  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: number;
  } | null>(null);

  const setConsent = (isConsented: boolean) => {
    if (typeof window === 'undefined') return;

    const newConsent = {
      isConsented,
      lastUpdated: Date.now(),
    };

    window.localStorage.setItem(CONSENT_STORAGE_KEY, isConsented ? 'true' : 'false');
    window.localStorage.setItem(CONSENT_STORAGE_KEY_TIMESTAMP, newConsent.lastUpdated.toString());

    setConsentState(newConsent);
  };

  const isSharingLocation = consent.isConsented && currentLocation !== null;

  return (
    <LocationConsentContext.Provider
      value={{
        consent,
        setConsent,
        currentLocation,
        setCurrentLocation,
        isSharingLocation,
      }}
    >
      {children}
    </LocationConsentContext.Provider>
  );
}

export function useLocationConsent() {
  const context = useContext(LocationConsentContext);
  if (!context) {
    throw new Error('useLocationConsent must be used within LocationConsentProvider');
  }
  return context;
}
