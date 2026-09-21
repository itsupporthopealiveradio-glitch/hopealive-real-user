import { Geolocation } from '@capacitor/geolocation';

// The two anchor points provided by the user
const ANCHOR_A = { lat: -26.084409, lng: 28.190057 };
const ANCHOR_B = { lat: -26.074299, lng: 28.186622 };
const MAX_DISTANCE_METERS = 500;

// Haversine formula to calculate distance between two coordinates in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const p1 = lat1 * Math.PI / 180; // φ, λ in radians
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export async function checkGeofence(): Promise<{ success: boolean; error?: string; distanceA?: number; distanceB?: number }> {
  try {
    // Request permissions first
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') {
        return { success: false, error: 'Location permission denied. You must enable GPS to clock in/out.' };
      }
    }

    // Get current position
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;

    // Calculate distance to both anchors
    const distanceToA = getDistanceInMeters(userLat, userLng, ANCHOR_A.lat, ANCHOR_A.lng);
    const distanceToB = getDistanceInMeters(userLat, userLng, ANCHOR_B.lat, ANCHOR_B.lng);

    // If the user is within 500 meters of EITHER anchor, they are allowed
    if (distanceToA <= MAX_DISTANCE_METERS || distanceToB <= MAX_DISTANCE_METERS) {
      return { success: true, distanceA: distanceToA, distanceB: distanceToB };
    } else {
      const minDistance = Math.min(distanceToA, distanceToB);
      return { 
        success: false, 
        error: `You are outside the authorized work perimeter (${Math.round(minDistance)}m away). You must be within ${MAX_DISTANCE_METERS}m of the office.`,
        distanceA: distanceToA,
        distanceB: distanceToB
      };
    }
  } catch (err: any) {
    return { success: false, error: 'Failed to retrieve GPS location. Please ensure your GPS is turned on and try again.' };
  }
}
