import type { Position } from './types';
type Reading = { readonly latitude: number; readonly longitude: number; readonly accuracy: number; readonly timestamp: number };
let cached: Reading | null = null;
let collecting: Promise<Position | null> | null = null;
function currentReading(): Position | null {
  if (!cached || Date.now() - cached.timestamp >= 90000) return null;
  return { latitude: cached.latitude, longitude: cached.longitude, accuracy: cached.accuracy, age_ms: Math.max(0, Date.now() - cached.timestamp) };
}
export function getBestPosition(): Promise<Position | null> {
  if (collecting) return collecting;
  const reusable = currentReading();
  if (reusable) return Promise.resolve(reusable);
  if (!navigator.geolocation) return Promise.resolve(null);
  collecting = new Promise<Position | null>(resolve => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      resolve(currentReading());
    };
    const timer = setTimeout(finish, 8000);
    const watchId = navigator.geolocation.watchPosition(position => {
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(accuracy) || accuracy < 0 || Date.now() - position.timestamp >= 90000) return;
      if (!cached || accuracy < cached.accuracy || Date.now() - cached.timestamp >= 90000) cached = { latitude, longitude, accuracy, timestamp: position.timestamp };
      if (accuracy <= 25) finish();
    }, finish, { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 });
    if (finished) navigator.geolocation.clearWatch(watchId);
  }).finally(() => { collecting = null; });
  return collecting;
}
export function warmupGeolocation(): void { void getBestPosition(); }
