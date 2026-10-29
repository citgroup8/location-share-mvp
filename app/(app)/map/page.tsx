'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { Bike, Car, Footprints, Mic, Navigation, Search, TrainFront } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapDestination, MapFriend, MapGem, MapPoint, MapPublicUser, MapRoute } from '@/components/interactive-map';
import { readApiResponse } from '@/lib/api-response';
import { realtimeStatusLabel, subscribeRealtime, useRealtimeStatus } from '@/lib/realtime-client';

const InteractiveMap = dynamic(() => import('@/components/interactive-map'), {
  ssr: false,
  loading: () => <div className="flex h-[480px] items-center justify-center rounded-[24px] bg-[#e6edf2] text-sm text-black/60 md:h-[600px]">Loading interactive map...</div>
});

type NearbyFriend = MapFriend & {
  status: string;
  location: (MapPoint & { lastUpdate: string | null }) | null;
};
type LocationMode = 'off' | 'friends_only' | 'public';
type TravelMode = 'foot' | 'transit' | 'car' | 'motorbike' | 'bicycle' | 'plane';
type SearchType = 'places' | 'memories';
type Place = MapDestination & { id: string; category?: string };
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = Event & { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};
type RouteStep = { instruction: string; distanceMeters: number; durationSeconds: number };
type RoutePlan = MapRoute & {
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  estimated: boolean;
  caveat: string | null;
};
type LocationUpdate = MapPoint & { speedMetersPerSecond?: number | null; timestamp?: number };

function makePoint(latitudeValue: string, longitudeValue: string): MapPoint | null {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseCoordinatePair(value: string): MapPoint | null {
  const match = value.replace(/^loc:/i, '').match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return match ? makePoint(match[1], match[2]) : null;
}

function parseSharedLocation(value: string): MapPoint | null {
  const raw = value.trim();
  if (!raw) return null;

  const googlePin = raw.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/i);
  const googleCenter = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (googlePin) return makePoint(googlePin[1], googlePin[2]);
  if (googleCenter) return makePoint(googleCenter[1], googleCenter[2]);
  if (/^geo:/i.test(raw)) return parseCoordinatePair(raw.slice(4));

  try {
    const url = new URL(raw);
    for (const key of ['location', 'q', 'query', 'll', 'sll', 'center']) {
      const point = parseCoordinatePair(url.searchParams.get(key) ?? '');
      if (point) return point;
    }
  } catch {
    return parseCoordinatePair(raw);
  }
  return parseCoordinatePair(raw);
}

function sharedLocationPlace(point: MapPoint): Place {
  return {
    id: `shared-${point.latitude}-${point.longitude}`,
    ...point,
    name: 'Shared location',
    address: `${point.latitude}, ${point.longitude}`,
    kind: 'place',
    photoUrl: null
  };
}

const travelModes: { value: TravelMode; label: string; icon: typeof Car }[] = [
  { value: 'car', label: 'Car', icon: Car },
  { value: 'foot', label: 'Walk', icon: Footprints },
  { value: 'bicycle', label: 'Bike', icon: Bike },
  { value: 'transit', label: 'Transit', icon: TrainFront }
];

function getBrowserLocation() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      () => reject(new Error('Location permission was denied.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

function distanceBetweenPoints(start: MapPoint, end: MapPoint) {
  const latitudeDelta = (end.latitude - start.latitude) * Math.PI / 180;
  const longitudeDelta = (end.longitude - start.longitude) * Math.PI / 180;
  const startLatitude = start.latitude * Math.PI / 180;
  const endLatitude = end.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(haversine));
}

function getRemainingDistance(current: MapPoint, destination: MapPoint, geometry: MapPoint[]) {
  if (geometry.length < 2) return distanceBetweenPoints(current, destination);

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  geometry.forEach((point, index) => {
    const distance = distanceBetweenPoints(current, point);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  let remaining = closestDistance;
  for (let index = closestIndex; index < geometry.length - 1; index += 1) {
    remaining += distanceBetweenPoints(geometry[index], geometry[index + 1]);
  }
  return remaining;
}

export default function MapPage() {
  const [friends, setFriends] = useState<NearbyFriend[]>([]);
  const [publicUsers, setPublicUsers] = useState<MapPublicUser[]>([]);
  const [gems, setGems] = useState<MapGem[]>([]);
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null);
  const [mode, setMode] = useState<LocationMode>('off');
  const [sharingActive, setSharingActive] = useState(false);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchingNearby, setSearchingNearby] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationImportInput, setLocationImportInput] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('places');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [speakingDirections, setSpeakingDirections] = useState(false);
  const [destination, setDestination] = useState<Place | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('car');
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [planningRoute, setPlanningRoute] = useState(false);
  const [sharingExternal, setSharingExternal] = useState(false);
  const streamStatus = realtimeStatusLabel(useRealtimeStatus());
  const lastAreaRefresh = useRef<MapPoint | null>(null);
  const currentLocation = useRef<MapPoint | null>(null);
  const lastMovementFix = useRef<{ point: MapPoint; timestamp: number } | null>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);

  const recordMovement = useCallback((point: MapPoint, timestamp: number, speedMetersPerSecond: number | null) => {
    const previousFix = lastMovementFix.current;
    const elapsedSeconds = previousFix ? (timestamp - previousFix.timestamp) / 1000 : 0;
    let measuredSpeedKmh = speedMetersPerSecond !== null && Number.isFinite(speedMetersPerSecond) && speedMetersPerSecond >= 0
      ? speedMetersPerSecond * 3.6
      : null;

    if (measuredSpeedKmh === null && previousFix && elapsedSeconds >= 1 && elapsedSeconds <= 120) {
      const distance = distanceBetweenPoints(previousFix.point, point);
      measuredSpeedKmh = distance < 3 ? 0 : distance / elapsedSeconds * 3.6;
    }

    if (measuredSpeedKmh !== null && measuredSpeedKmh <= 220) {
      setSpeedKmh((previousSpeed) => measuredSpeedKmh <= 1 || previousSpeed === null
        ? measuredSpeedKmh
        : previousSpeed * 0.65 + measuredSpeedKmh * 0.35);
    }
    lastMovementFix.current = { point, timestamp };
  }, []);

  useEffect(() => {
    const incomingLocation = new URLSearchParams(window.location.search).get('location');
    if (!incomingLocation) return;
    const point = parseSharedLocation(incomingLocation);
    if (!point) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('This shared link does not contain valid coordinates.');
      return;
    }
    setDestination(sharedLocationPlace(point));
    setNotice('Location received from a Hidden Gem share link.');
  }, []);

  const loadNearby = useCallback(async () => {
    const response = await fetch('/api/friends/nearby');
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error ?? 'Could not load friend locations');
    setFriends(data.friends);
  }, []);

  const loadArea = useCallback(async (point: MapPoint) => {
    const query = `lat=${point.latitude}&lng=${point.longitude}`;
    const [gemsResponse, peopleResponse] = await Promise.all([
      fetch(`/api/gems/nearby?${query}`),
      fetch(`/api/location/public?${query}`)
    ]);
    const [gemsData, peopleData] = await Promise.all([readApiResponse(gemsResponse), readApiResponse(peopleResponse)]);
    if (!gemsResponse.ok) throw new Error(gemsData.error ?? 'Could not load nearby Gems');
    if (!peopleResponse.ok) throw new Error(peopleData.error ?? 'Could not load public locations');
    setGems(gemsData.gems);
    setPublicUsers(peopleData.users);
  }, []);

  const refreshBrowserLocation = useCallback(async () => {
    const position = await getBrowserLocation();
    const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    recordMovement(point, position.timestamp, position.coords.speed);
    setUserLocation(point);
    currentLocation.current = point;
    lastAreaRefresh.current = point;
    await loadArea(point);
  }, [loadArea, recordMovement]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/users/me').then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error ?? 'Could not load location settings');
        if (active) {
          const loadedMode = data.user.liveLocationMode as LocationMode;
          setMode(loadedMode);
          setSharingActive(loadedMode !== 'off');
        }
      }),
      // This initial request synchronizes page state with the remote service.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadNearby(),
      refreshBrowserLocation()
    ])
      .catch((cause: Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });

    const unsubscribe = subscribeRealtime((update) => {
      if (update.friendsChanged) loadNearby().catch((cause: Error) => setError(cause.message));
      if (update.publicLocationsChanged && currentLocation.current) {
        loadArea(currentLocation.current).catch((cause: Error) => setError(cause.message));
      }
    });

    const locationUpdated = (event: Event) => {
      const update = (event as CustomEvent<LocationUpdate>).detail;
      const point = { latitude: update.latitude, longitude: update.longitude };
      recordMovement(point, update.timestamp ?? Date.now(), update.speedMetersPerSecond ?? null);
      setUserLocation(point);
      currentLocation.current = point;
      const previous = lastAreaRefresh.current;
      if (!previous || Math.abs(previous.latitude - point.latitude) > 0.005 || Math.abs(previous.longitude - point.longitude) > 0.005) {
        lastAreaRefresh.current = point;
        loadArea(point).catch((cause: Error) => setError(cause.message));
      }
    };
    window.addEventListener('location-updated', locationUpdated);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('location-updated', locationUpdated);
    };
  }, [loadArea, loadNearby, recordMovement, refreshBrowserLocation]);

  useEffect(() => {
    if (sharingActive || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition((position) => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      recordMovement(point, position.timestamp, position.coords.speed);
      setUserLocation(point);
      currentLocation.current = point;
      const previous = lastAreaRefresh.current;
      if (!previous || Math.abs(previous.latitude - point.latitude) > 0.005 || Math.abs(previous.longitude - point.longitude) > 0.005) {
        lastAreaRefresh.current = point;
        loadArea(point).catch((cause: Error) => setError(cause.message));
      }
    }, () => undefined, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [loadArea, recordMovement, sharingActive]);

  useEffect(() => () => {
    speechRecognition.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  async function updateSharing() {
    setSharing(true);
    setError('');
    setNotice('');
    try {
      const position = mode === 'off' ? null : await getBrowserLocation();
      const response = await fetch('/api/location/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          ...(position ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          } : {})
        })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not update location sharing');
      setSharingActive(mode !== 'off');
      window.dispatchEvent(new CustomEvent('location-mode-changed', { detail: mode }));
      if (position) {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        recordMovement(point, position.timestamp, position.coords.speed);
        setUserLocation(point);
        currentLocation.current = point;
        lastAreaRefresh.current = point;
        window.dispatchEvent(new CustomEvent('location-updated', {
          detail: { ...point, speedMetersPerSecond: position.coords.speed, timestamp: position.timestamp }
        }));
      }
      await loadNearby();
      setNotice(mode === 'off'
        ? 'Location sharing turned off and your saved coordinates were removed.'
        : `Location shared with ${mode === 'public' ? 'everyone' : 'friends'}. Live updates are active while Hidden Gem is open.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update location sharing');
    } finally {
      setSharing(false);
    }
  }

  async function refreshNearby() {
    setSearchingNearby(true);
    setError('');
    try {
      await refreshBrowserLocation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not find nearby locations');
    } finally {
      setSearchingNearby(false);
    }
  }

  async function runSearch(query: string, nextSearchType: SearchType) {
    setError('');
    setNotice('');
    setSearchResults([]);
    if (query.trim().length < 2) {
      setError('Enter at least 2 characters to search.');
      return;
    }
    setSearchingPlaces(true);
    try {
      if (nextSearchType === 'memories') {
        const response = await fetch(`/api/map/search-content?q=${encodeURIComponent(query.trim())}`);
        const data = await readApiResponse(response) as { error?: string; items?: Array<Place & { kind: 'gem' | 'spot' }> };
        if (!response.ok) throw new Error(data.error ?? 'Could not search Gems and Spots.');
        const places = (data.items ?? []).map((item) => ({ ...item, address: [item.category, item.address].filter(Boolean).join(' · ') }));
        setSearchResults(places);
        if (!places.length) setNotice('No visible Gems or Spots match that search.');
        return;
      }

      const searchUrl = new URL('https://photon.komoot.io/api/');
      searchUrl.searchParams.set('q', query.trim());
      searchUrl.searchParams.set('limit', '8');
      const response = await fetch(searchUrl);
      if (!response.ok) throw new Error('Place search is temporarily unavailable.');
      const data = await readApiResponse(response) as { features?: PhotonFeature[] };
      const places = (data.features ?? []).flatMap((feature, index) => {
        const name = feature.properties.name?.trim();
        if (!name) return [];
        const properties = feature.properties;
        const address = [
          properties.street && `${properties.housenumber ? `${properties.housenumber} ` : ''}${properties.street}`,
          properties.city || properties.district || properties.county,
          properties.state,
          properties.country
        ].filter((part, position, parts): part is string => Boolean(part) && parts.indexOf(part) === position).join(', ');
        return [{
          id: `${feature.geometry.coordinates[0]}:${feature.geometry.coordinates[1]}:${index}`,
          name,
          address,
          longitude: feature.geometry.coordinates[0],
          latitude: feature.geometry.coordinates[1],
          kind: 'place' as const,
          photoUrl: null
        }];
      });
      setSearchResults(places);
      if (!places.length) setNotice('No matching places found. Try adding a city or region.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not search for that place.');
    } finally {
      setSearchingPlaces(false);
    }
  }

  async function searchPlaces(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(searchQuery, searchType);
  }

  function importLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const point = parseSharedLocation(locationImportInput);
    if (!point) {
      setError('Could not find coordinates in that link. Paste a map link with coordinates or a latitude, longitude pair.');
      return;
    }
    setDestination(sharedLocationPlace(point));
    setRoutePlan(null);
    setSearchResults([]);
    setLocationImportInput('');
    setNotice('Location received. Choose a travel mode to get directions.');
  }

  async function shareLocation() {
    const point = destination ?? userLocation;
    if (!point) {
      setError('Your location is not available yet. Refresh nearby or select a destination first.');
      return;
    }

    setSharingExternal(true);
    setError('');
    setNotice('');
    const appLink = new URL('/map', window.location.origin);
    appLink.searchParams.set('location', `${point.latitude},${point.longitude}`);
    const mapsLink = new URL('https://www.google.com/maps/search/');
    mapsLink.searchParams.set('api', '1');
    mapsLink.searchParams.set('query', `${point.latitude},${point.longitude}`);
    const shareText = `Open in Hidden Gem: ${appLink.toString()}\nView in Google Maps: ${mapsLink.toString()}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Location from Hidden Gem', text: shareText, url: appLink.toString() });
        setNotice('Location shared.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setNotice('Share links copied. Paste them into another app.');
      } else {
        throw new Error('Sharing is not available in this browser.');
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Could not share this location.');
    } finally {
      setSharingExternal(false);
    }
  }

  function startVoiceSearch() {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Voice search is not supported by this browser. Use the search field instead.');
      return;
    }
    speechRecognition.current?.stop();
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript.trim();
      if (transcript) {
        setSearchQuery(transcript);
        void runSearch(transcript, searchType);
      }
    };
    recognition.onerror = () => {
      setVoiceListening(false);
      setError('Voice search could not hear a destination. Check microphone permission and try again.');
    };
    recognition.onend = () => setVoiceListening(false);
    speechRecognition.current = recognition;
    setError('');
    setVoiceListening(true);
    recognition.start();
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setSpeakingDirections(false);
  }

  function speakDirections() {
    if (!routePlan || !('speechSynthesis' in window)) {
      setError('Spoken directions are not supported by this browser.');
      return;
    }
    stopSpeaking();
    const summary = `${travelModes.find((item) => item.value === travelMode)?.label} route to ${destination?.name}. ${formatDistance(routePlan.distanceMeters)}, about ${formatDuration(routePlan.durationSeconds)}.`;
    const instructions = routePlan.steps.map((step, index) => `Step ${index + 1}. ${step.instruction}. In ${formatDistance(step.distanceMeters)}.`).join(' ');
    const utterance = new SpeechSynthesisUtterance(`${summary} ${instructions || routePlan.caveat || 'Open live directions for turn-by-turn guidance.'}`);
    utterance.onend = () => setSpeakingDirections(false);
    utterance.onerror = () => setSpeakingDirections(false);
    window.speechSynthesis.speak(utterance);
    setSpeakingDirections(true);
  }

  async function planRoute() {
    if (!destination) return;
    setPlanningRoute(true);
    setError('');
    setRoutePlan(null);
    try {
      let origin = currentLocation.current ?? userLocation;
      if (!origin) {
        const position = await getBrowserLocation();
        origin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserLocation(origin);
        currentLocation.current = origin;
      }
      const response = await fetch('/api/map/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, mode: travelMode })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not plan this route.');
      setRoutePlan(data.route);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not plan this route.');
    } finally {
      setPlanningRoute(false);
    }
  }

  function clearDestination() {
    stopSpeaking();
    setDestination(null);
    setRoutePlan(null);
    setSearchResults([]);
    setSearchQuery('');
  }

  const formatDistance = (meters: number) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  const formatDuration = (seconds: number) => {
    const totalMinutes = Math.max(1, Math.round(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours} hr${hours === 1 ? '' : 's'}${minutes ? ` ${minutes} min` : ''}` : `${totalMinutes} min`;
  };
  const mapsMode = travelMode === 'foot' ? 'walking' : travelMode === 'transit' ? 'transit' : travelMode === 'bicycle' ? 'bicycling' : 'driving';
  const liveDirectionsUrl = destination && travelMode !== 'plane'
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${userLocation?.latitude ?? ''},${userLocation?.longitude ?? ''}`)}&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}&travelmode=${mapsMode}`
    : destination
      ? `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights to ${destination.name} ${destination.address}`)}`
      : '';
  const drivingNavigationUrl = destination && (travelMode === 'car' || travelMode === 'motorbike')
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}&travelmode=driving&dir_action=navigate`
    : '';
  const remainingDistance = destination && userLocation
    ? getRemainingDistance(userLocation, destination, routePlan?.geometry ?? [])
    : routePlan?.distanceMeters ?? 0;
  const etaSeconds = routePlan && travelMode !== 'plane' && speedKmh !== null && speedKmh > 1
    ? remainingDistance / (speedKmh / 3.6)
    : routePlan?.durationSeconds ?? 0;

  const friendsSharing = friends.filter((friend) => friend.location !== null);

  return (
    <main className="app-map-page space-y-4 px-2 md:px-0">
      <section className="app-map-controls rounded-[28px] border border-black/10 bg-white p-4 shadow-snap">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">Who sees you?</h2>
            <p className="mt-1 text-xs text-black/50" role="status">{streamStatus} · location updates are sent as your device moves.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold disabled:opacity-60" disabled={searchingNearby} onClick={() => void refreshNearby()}>
              {searchingNearby ? 'Refreshing...' : 'Refresh nearby'}
            </button>
            <Link href="/gems" className="rounded-full bg-[#176e50] px-4 py-2 text-sm font-black text-white">Explore Gems</Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            { value: 'public', label: 'Everyone', icon: '◎' },
            { value: 'friends_only', label: 'Friends', icon: '♧' },
            { value: 'off', label: 'Ghost', icon: '◌' }
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              className={`map-privacy-option${mode === option.value ? ' active' : ''}`}
              onClick={() => setMode(option.value)}
            >
              <span aria-hidden="true" className="text-lg">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="rounded-full bg-snapchat-yellow px-4 py-2 text-sm font-black disabled:opacity-60" disabled={sharing} onClick={() => void updateSharing()}>
            {sharing ? 'Updating...' : mode === 'off' ? 'Turn sharing off' : 'Save sharing setting'}
          </button>
          <span className="text-xs text-black/60">{friendsSharing.length} friends sharing · {gems.length} nearby Gems</span>
        </div>
        <div className="mt-3 grid gap-3 border-b border-black/10 pb-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <form className="flex flex-wrap items-end gap-2" onSubmit={importLocation}>
            <label className="min-w-[220px] flex-1 text-sm font-bold">
              Receive a location
              <input className="mt-1 block w-full rounded-full border border-black/10 bg-white px-4 py-2 font-normal" value={locationImportInput} onChange={(event) => setLocationImportInput(event.target.value)} placeholder="Paste a map link or lat, long" />
            </label>
            <button className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold disabled:opacity-60" disabled={!locationImportInput.trim()}>Import</button>
          </form>
          <button type="button" className="rounded-full bg-[#176e50] px-4 py-2 text-sm font-black text-white disabled:opacity-60" onClick={() => void shareLocation()} disabled={sharingExternal || (!destination && !userLocation)}>
            {sharingExternal ? 'Sharing...' : destination ? 'Share selected location' : 'Share my location'}
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}
      </section>

      <section className="app-map-search-controls rounded-[28px] border border-black/10 bg-white p-4 shadow-snap">
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 rounded-full bg-[#F3F3F3] p-1" role="tablist" aria-label="Search places or memories">
              {([['places', 'Places'], ['memories', 'Gems & Spots']] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={searchType === value} className={`min-h-11 flex-1 rounded-full px-4 text-sm font-semibold transition-colors ${searchType === value ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => { setSearchType(value); setSearchResults([]); }}>{label}</button>
              ))}
          </div>
          <form className="flex items-center gap-2 rounded-full bg-[#F3F3F3] px-4" onSubmit={searchPlaces}>
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <label className="sr-only" htmlFor="destination-search">Search a destination</label>
            <input id="destination-search" className="min-w-0 flex-1 border-0 bg-transparent py-3 font-normal outline-none" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Where to? ✨" maxLength={120} />
            <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-foreground disabled:opacity-60" aria-label={voiceListening ? 'Listening' : 'Speak destination'} disabled={voiceListening} onClick={startVoiceSearch}>
              <Mic className="h-4 w-4" aria-hidden="true" />
            </button>
            <button className="sr-only" disabled={searchingPlaces}>{searchingPlaces ? 'Searching...' : 'Search'}</button>
          </form>
            {searchResults.length > 0 && (
              <ul className="max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2" aria-label="Place search results">
                {searchResults.map((place) => (
                  <li key={place.id}>
                    <button type="button" className="w-full rounded-xl px-3 py-2 text-left hover:bg-[#f3f6ef]" onClick={() => { setDestination(place); setSearchQuery([place.name, place.address].filter(Boolean).join(', ')); setSearchResults([]); setRoutePlan(null); setNotice('Destination selected. Choose a travel mode and get directions.'); }}>
                      <span className="flex items-center gap-2 text-sm font-bold">
                        {place.photoUrl && <Image src={place.photoUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-lg object-cover" />}
                        {place.name}
                        {place.kind === 'gem' && <span className="text-xs font-normal text-black/50">Gem</span>}
                        {place.kind === 'spot' && <span className="text-xs font-normal text-black/50">Spot</span>}
                      </span>
                      {place.address && <span className="block text-xs text-black/55">{place.address}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          <fieldset className="min-w-0">
            <legend className="sr-only">Travel mode</legend>
            <div className="grid grid-cols-4 gap-2">
              {travelModes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={travelMode === value}
                  className={`map-travel-mode${travelMode === value ? ' active' : ''}`}
                  onClick={() => {
                    setTravelMode(value);
                    setRoutePlan(null);
                  }}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="map-go-button" disabled={!destination || planningRoute} onClick={() => void planRoute()}>
            <Navigation className="h-5 w-5" aria-hidden="true" />
            {planningRoute ? 'Planning...' : "Let's go"}
          </button>
        </div>
        {destination && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f3f6ef] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Destination: {destination.name}</p>
              {destination.address && <p className="truncate text-xs text-black/55">{destination.address}</p>}
            </div>
            <button type="button" className="text-sm font-bold underline" onClick={clearDestination}>Clear</button>
          </div>
        )}
        {routePlan && destination && (
          <section className="mt-3 rounded-2xl border border-black/10 bg-white p-4" aria-label="Route guidance">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Directions to {destination.name}</h2>
                <p className="mt-1 text-sm text-black/60">{travelModes.find((item) => item.value === travelMode)?.label}</p>
              </div>
              <a className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold" href={drivingNavigationUrl || liveDirectionsUrl} target="_blank" rel="noreferrer">
                {drivingNavigationUrl ? 'Start navigation in Google Maps' : 'Open live directions'}
              </a>
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-black/10 border-y border-black/10 py-3">
              <div className="pr-2">
                <p className="text-xs text-black/55">Distance left</p>
                <p className="mt-1 text-sm font-black">{formatDistance(remainingDistance)}</p>
              </div>
              <div className="px-2">
                <p className="text-xs text-black/55">Current speed</p>
                <p className="mt-1 text-sm font-black">{speedKmh === null ? 'Waiting for GPS' : `${speedKmh.toFixed(1)} km/h`}</p>
              </div>
              <div className="pl-2">
                <p className="text-xs text-black/55">ETA</p>
                <p className="mt-1 text-sm font-black">{formatDuration(etaSeconds)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-black/55">{speedKmh !== null && speedKmh > 1 && travelMode !== 'plane' ? 'ETA updates using your current speed.' : 'ETA uses the route estimate until movement is detected.'}</p>
            {routePlan.caveat && <p className="mt-2 text-xs text-black/60">{routePlan.caveat}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" className="rounded-full bg-[#176e50] px-4 py-2 text-sm font-bold text-white" disabled={speakingDirections} onClick={speakDirections}>{speakingDirections ? 'Speaking...' : 'Read directions aloud'}</button>
              {speakingDirections && <button type="button" className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold" onClick={stopSpeaking}>Stop</button>}
            </div>
            {routePlan.steps.length > 0 ? (
              <ol className="mt-3 max-h-48 space-y-2 overflow-y-auto border-t border-black/10 pt-3">
                {routePlan.steps.map((step, index) => <li key={`${index}-${step.instruction}`} className="flex justify-between gap-4 text-sm"><span><b className="mr-2 text-black/40">{index + 1}.</b>{step.instruction}</span><span className="shrink-0 text-xs text-black/55">{formatDistance(step.distanceMeters)}</span></li>)}
              </ol>
            ) : <p className="mt-3 border-t border-black/10 pt-3 text-sm text-black/60">Use live directions for turn-by-turn guidance and current conditions.</p>}
          </section>
        )}
      </section>

      <section aria-label="Interactive map and nearby activity" className="app-map-surface grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white p-2 shadow-snap">
        {loading && !userLocation ? <div className="flex h-[480px] items-center justify-center text-sm text-black/60">Getting your location and loading the map...</div> : (
          <InteractiveMap userLocation={userLocation} friends={friends} publicUsers={publicUsers} gems={gems} destination={destination} route={routePlan} />
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-3 py-3 text-xs text-black/60">
          <span><b className="text-blue-600">●</b> You</span>
          <span><b className="text-green-600">●</b> Friends sharing location</span>
          <span><b className="text-purple-600">●</b> Public locations</span>
          <span><b className="text-yellow-600">◆</b> Public Gems</span>
          {destination && <span><b className="text-red-600">●</b> Destination</span>}
        </div>
        </div>
        <aside className="app-map-aside">
          <section className="app-map-side-card">
            <h2>Your friends</h2>
            <p>{friendsSharing.length} of {friends.length} friends are sharing live location.</p>
            {friends.length ? friends.slice(0, 6).map((friend) => (
              <div key={friend.id} className="app-map-side-row">
                <b>{friend.displayName || friend.username}</b>
                <span>@{friend.username} · {friend.location ? 'Sharing location' : friend.status === 'online' ? 'Online · location private' : 'Offline · location private'}</span>
              </div>
            )) : <p>No friends yet. Add people to start your map.</p>}
            <Link href="/friends" className="mt-3 inline-block text-xs font-bold text-[#176e50]">View friends →</Link>
          </section>
          <section className="app-map-side-card">
            <h2>Nearby discoveries</h2>
            <p>{gems.length} public Gems near your current location.</p>
            {gems.length ? gems.slice(0, 4).map((gem) => (
              <div key={gem.id} className="app-map-side-row">
                <b>{gem.title}</b>
                <span>{gem.category} · {gem.creator.displayName || gem.creator.username}</span>
              </div>
            )) : <p>{userLocation ? 'No public Gems nearby yet.' : 'Allow location access to find nearby Gems.'}</p>}
            <Link href="/gems" className="mt-3 inline-block text-xs font-bold text-[#176e50]">Explore Gems →</Link>
          </section>
        </aside>
      </section>
      <p className="px-2 text-xs text-black/50">Map imagery is provided by OpenStreetMap or Esri, depending on the selected layer. Location markers are only shown when the person has enabled sharing.</p>
    </main>
  );
}
