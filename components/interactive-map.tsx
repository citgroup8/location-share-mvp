'use client';

import L, { type LatLngExpression } from 'leaflet';
import Image from 'next/image';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useRef, useState } from 'react';

export type MapPoint = { latitude: number; longitude: number };
export type MapDestination = MapPoint & {
  name: string;
  address: string;
  kind?: 'place' | 'gem' | 'spot';
  photoUrl?: string | null;
};
export type MapRoute = { geometry: MapPoint[] };
export type MapFriend = {
  id: string;
  username: string;
  displayName: string | null;
  location: MapPoint | null;
};
export type MapPublicUser = {
  id: string;
  username: string;
  displayName: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
};
export type MapGem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  creator: { username: string; displayName: string | null };
};

const userIcon = L.divIcon({
  className: 'hidden-gem-marker hidden-gem-marker-user',
  html: '<span></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});
const friendIcon = L.divIcon({
  className: 'hidden-gem-marker hidden-gem-marker-friend',
  html: '<span></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});
const publicIcon = L.divIcon({
  className: 'hidden-gem-marker hidden-gem-marker-public',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});
const gemIcon = L.divIcon({
  className: 'hidden-gem-marker hidden-gem-marker-gem',
  html: '<span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});
const destinationIcon = L.divIcon({
  className: 'hidden-gem-marker hidden-gem-marker-destination',
  html: '<span></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function MapController({ userLocation, destination, route }: { userLocation: MapPoint | null; destination: MapDestination | null; route: MapRoute | null }) {
  const map = useMap();
  const didSetInitialLocation = useRef(false);

  useEffect(() => {
    if (userLocation && !didSetInitialLocation.current) {
      map.setView([userLocation.latitude, userLocation.longitude], 13);
      didSetInitialLocation.current = true;
    }
  }, [map, userLocation]);

  useEffect(() => {
    if (!destination) return;
    const points = route?.geometry.length ? route.geometry : [destination, ...(userLocation ? [userLocation] : [])];
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((point) => [point.latitude, point.longitude])), {
        padding: [48, 48],
        maxZoom: 15,
        animate: true
      });
    } else {
      map.setView([destination.latitude, destination.longitude], 14, { animate: true });
    }
  }, [destination, map, route, userLocation]);

  return null;
}

export default function InteractiveMap({
  userLocation,
  friends,
  publicUsers,
  gems,
  destination,
  route
}: {
  userLocation: MapPoint | null;
  friends: MapFriend[];
  publicUsers: MapPublicUser[];
  gems: MapGem[];
  destination: MapDestination | null;
  route: MapRoute | null;
}) {
  const [satellite, setSatellite] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('hidden-gem-map-layer') === 'satellite';
    } catch {
      return false;
    }
  });
  const center: LatLngExpression = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [20, 0];
  const friendIds = new Set(friends.map((friend) => friend.id));
  const otherPublicUsers = publicUsers.filter((user) => !friendIds.has(user.id));

  return (
    <div className="app-map-frame relative overflow-hidden rounded-[24px] border border-black/10">
      <MapContainer center={center} zoom={userLocation ? 12 : 2} scrollWheelZoom className="app-map-canvas h-[480px] w-full md:h-[600px]">
        <TileLayer
          attribution={satellite
            ? 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
          maxZoom={19}
          url={satellite
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />
        <MapController userLocation={userLocation} destination={destination} route={route} />
        {route?.geometry.length ? (
          <Polyline positions={route.geometry.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: '#176e50', weight: 5, opacity: 0.82 }} />
        ) : null}
        {userLocation && (
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}
        {friends.map((friend) => friend.location && (
          <Marker
            key={`friend-${friend.id}`}
            position={[friend.location.latitude, friend.location.longitude]}
            icon={friendIcon}
          >
            <Popup>
              <strong>{friend.displayName || friend.username}</strong>
              <br />
              Friend · sharing live location
            </Popup>
          </Marker>
        ))}
        {otherPublicUsers.map((user) => (
          <Marker key={`public-${user.id}`} position={[user.latitude, user.longitude]} icon={publicIcon}>
            <Popup>
              <strong>{user.displayName || user.username}</strong>
              <br />
              Public location
            </Popup>
          </Marker>
        ))}
        {gems.map((gem) => (
          <Marker key={`gem-${gem.id}`} position={[gem.latitude, gem.longitude]} icon={gemIcon}>
            <Popup>
              <strong>{gem.title}</strong>
              <br />
              {gem.category} · {gem.creator.displayName || gem.creator.username}
              {gem.description && <><br />{gem.description}</>}
            </Popup>
          </Marker>
        ))}
        {destination && (
          <Marker position={[destination.latitude, destination.longitude]} icon={destinationIcon}>
            <Popup>
              {destination.photoUrl && <Image src={destination.photoUrl} alt="" width={240} height={120} unoptimized className="mb-2 max-h-28 w-full rounded-lg object-cover" />}
              <strong>{destination.name}</strong>
              {destination.address && <><br />{destination.address}</>}
              {destination.kind && destination.kind !== 'place' && <><br />{destination.kind === 'gem' ? 'Public Gem' : 'Shared Spot'}</>}
            </Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="absolute right-3 top-3 z-[1000]">
        <button
          type="button"
          aria-pressed={satellite}
          onClick={() => {
            const next = !satellite;
            setSatellite(next);
            try {
              window.localStorage.setItem('hidden-gem-map-layer', next ? 'satellite' : 'street');
            } catch {
              // The toggle still works if browser storage is unavailable.
            }
          }}
          className="rounded-xl border border-black/15 bg-white/95 px-4 py-2 text-sm font-bold shadow-md backdrop-blur hover:bg-white"
        >
          {satellite ? 'Street map' : 'Satellite'}
        </button>
      </div>
    </div>
  );
}
