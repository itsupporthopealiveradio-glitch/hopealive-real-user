import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Verified office coordinate from the active office network/device location.
export const OFFICE_LOCATION = { latitude: -26.080003, longitude: 28.188127 };
export const ANCHOR_A = OFFICE_LOCATION;
export const ANCHOR_B = OFFICE_LOCATION;

export const MAX_DISTANCE_METERS = 210; // Set to 210m per user request

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationVerificationResult {
  isWithinRange: boolean;
  distance: number;
  userLocation: Coordinates;
  error?: string;
}

export async function getCurrentLocation(): Promise<Coordinates> {
  if (!Capacitor.isNativePlatform()) {
    return getBrowserLocation();
  }

  // Use Capacitor Geolocation for high accuracy native support
  try {
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') {
        throw new Error("Location permission denied.");
      }
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (err: any) {
    console.error("Capacitor Geolocation error:", err);
    return getBrowserLocation();
  }
}

function getBrowserLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      (error) => {
        let errorMessage = "Unable to retrieve your location";
        if (error.code === error.PERMISSION_DENIED) errorMessage = "Location permission denied.";
        if (error.code === error.POSITION_UNAVAILABLE) errorMessage = "Location information is unavailable.";
        reject(new Error(errorMessage));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function verifyLocation(): Promise<LocationVerificationResult> {
  try {
    const userLocation = await getCurrentLocation();
    
    // Calculate distance to BOTH anchors
    const distanceToA = calculateDistance(userLocation, ANCHOR_A);
    const distanceToB = calculateDistance(userLocation, ANCHOR_B);
    
    // User is verified if they are within the configured radius of the office.
    const isWithinRange = distanceToA <= MAX_DISTANCE_METERS || distanceToB <= MAX_DISTANCE_METERS;
    const minDistance = Math.min(distanceToA, distanceToB);
    
    return {
      isWithinRange,
      distance: minDistance,
      userLocation,
    };
  } catch (error: any) {
    return {
      isWithinRange: false,
      distance: 0,
      userLocation: { latitude: 0, longitude: 0 },
      error: error.message || "Unknown error occurred",
    };
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}
