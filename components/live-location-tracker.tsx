'use client';

import { useEffect, useState } from 'react';
import { readApiResponse } from '@/lib/api-response';

type LocationMode = 'off' | 'friends_only' | 'public';
type LocationModeEvent = CustomEvent<LocationMode>;

export function LiveLocationTracker() {
  const [mode, setMode] = useState<LocationMode>('off');

  useEffect(() => {
    let active = true;
    fetch('/api/users/me')
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error ?? 'Could not load location-sharing settings');
        if (active) setMode(data.user.liveLocationMode as LocationMode);
      })
      .catch((error: Error) => console.error(error.message));

    const updateMode = (event: Event) => setMode((event as LocationModeEvent).detail);
    window.addEventListener('location-mode-changed', updateMode);
    return () => {
      active = false;
      window.removeEventListener('location-mode-changed', updateMode);
    };
  }, []);

  useEffect(() => {
    if (mode === 'off' || !navigator.geolocation) return;

    let lastSent: { latitude: number; longitude: number; timestamp: number } | null = null;
    let requestInFlight = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const { latitude, longitude } = position.coords;
        if (requestInFlight) return;
        if (lastSent && now - lastSent.timestamp < 5000) {
          const dLat = (latitude - lastSent.latitude) * Math.PI / 180;
          const dLng = (longitude - lastSent.longitude) * Math.PI / 180;
          const distance = 6371000 * 2 * Math.asin(Math.sqrt(
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lastSent.latitude * Math.PI / 180) *
            Math.cos(latitude * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2
          ));
          if (distance < 10) return;
        }

        requestInFlight = true;
        fetch('/api/location/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude, longitude, mode })
        })
          .then(async (response) => {
            if (!response.ok) {
              const data = await readApiResponse(response);
              throw new Error(data.error ?? 'Could not update shared location');
            }
            lastSent = { latitude, longitude, timestamp: now };
            window.dispatchEvent(new CustomEvent('location-updated', {
              detail: {
                latitude,
                longitude,
                speedMetersPerSecond: position.coords.speed,
                timestamp: position.timestamp
              }
            }));
          })
          .catch((error: Error) => console.error(error.message))
          .finally(() => { requestInFlight = false; });
      },
      (error) => console.error(`Live location tracking failed: ${error.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mode]);

  return null;
}
