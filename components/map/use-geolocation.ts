"use client";

import { useState, useCallback } from "react";

export interface GeoPosition {
  lng: number;
  lat: number;
}

export interface UseGeolocationReturn {
  position: GeoPosition | null;
  error: string | null;
  loading: boolean;
  requestLocation: () => void;
}

/**
 * Wraps navigator.geolocation.getCurrentPosition.
 * Call `requestLocation()` (e.g. on a button tap) to trigger the browser prompt.
 * Returns the resolved position or null if unavailable / denied.
 */
export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  return { position, error, loading, requestLocation };
}
