import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api-response';
import { getSessionUserId } from '@/lib/auth';

const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});
const requestSchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
  mode: z.enum(['foot', 'transit', 'car', 'motorbike', 'bicycle', 'plane'])
});
const osrmSchema = z.object({
  code: z.string(),
  routes: z.array(z.object({
    distance: z.number(),
    duration: z.number(),
    geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])) }),
    legs: z.array(z.object({
      steps: z.array(z.object({
        distance: z.number(),
        duration: z.number(),
        name: z.string(),
        maneuver: z.object({ type: z.string(), modifier: z.string().optional() })
      }))
    }))
  }))
});

function radians(degrees: number) {
  return degrees * Math.PI / 180;
}

function haversineMeters(origin: z.infer<typeof pointSchema>, destination: z.infer<typeof pointSchema>) {
  const dLat = radians(destination.latitude - origin.latitude);
  const dLng = radians(destination.longitude - origin.longitude);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatInstruction(type: string, modifier: string | undefined, name: string) {
  const road = name ? ` onto ${name}` : '';
  if (type === 'depart') return `Start${name ? ` on ${name}` : ' your route'}`;
  if (type === 'arrive') return 'You have arrived at your destination';
  if (type === 'turn' || type === 'end of road') return `Turn ${modifier ?? 'ahead'}${road}`;
  if (type === 'roundabout' || type === 'rotary') return `Enter the roundabout${road}`;
  if (type === 'exit roundabout' || type === 'roundabout turn') return `Exit the roundabout${road}`;
  if (type === 'merge') return `Merge${modifier ? ` ${modifier}` : ''}${road}`;
  if (type === 'fork') return `Keep ${modifier ?? 'straight'} at the fork${road}`;
  if (type === 'continue' || type === 'new name') return `Continue${road}`;
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}${road}`;
}

function estimateRoute(origin: z.infer<typeof pointSchema>, destination: z.infer<typeof pointSchema>, mode: string) {
  const directMeters = haversineMeters(origin, destination);
  if (mode === 'plane') {
    return {
      distanceMeters: directMeters,
      durationSeconds: 90 * 60 + (directMeters / 800000) * 3600,
      geometry: [],
      steps: [],
      estimated: true,
      caveat: 'Straight-line flight estimate plus airport time. Flight schedules and airport transfers are not included.'
    };
  }

  const distanceMeters = directMeters * 1.3;
  const averageSpeedKmh = mode === 'transit' ? 24 : mode === 'bicycle' ? 16 : mode === 'foot' ? 4.5 : mode === 'motorbike' ? 35 : 32;
  const extraSeconds = mode === 'transit' ? 12 * 60 : 0;
  return {
    distanceMeters,
    durationSeconds: distanceMeters / (averageSpeedKmh * 1000 / 3600) + extraSeconds,
    geometry: [],
    steps: [],
    estimated: true,
    caveat: mode === 'transit'
      ? 'Estimate only. Use live transit directions for current routes, transfers, and arrival times.'
      : 'Estimate only. Road-network directions are temporarily unavailable.'
  };
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody(request, requestSchema);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid route request' }, { status: 400 });
  const { origin, destination, mode } = parsed.data;

  if (mode === 'transit' || mode === 'plane') {
    return NextResponse.json({ route: estimateRoute(origin, destination, mode) });
  }

  const profile = mode === 'foot' ? 'foot' : mode === 'bicycle' ? 'bike' : 'car';
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const routeUrl = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await fetch(routeUrl, {
      headers: { 'User-Agent': 'HiddenGem/1.0 route planning' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Routing provider returned ${response.status}`);
    const result = osrmSchema.safeParse(await response.json());
    const bestRoute = result.success && result.data.code === 'Ok' ? result.data.routes[0] : undefined;
    if (!bestRoute) return NextResponse.json({ route: estimateRoute(origin, destination, mode) });

    const steps = bestRoute.legs.flatMap((leg) => leg.steps).map((step) => ({
      instruction: formatInstruction(step.maneuver.type, step.maneuver.modifier, step.name),
      distanceMeters: step.distance,
      durationSeconds: step.duration
    }));
    const motorbikeCaveat = mode === 'motorbike' ? 'Uses the car-road routing profile; restrictions and motorcycle-specific travel time may differ.' : null;
    return NextResponse.json({
      route: {
        distanceMeters: bestRoute.distance,
        durationSeconds: bestRoute.duration,
        geometry: bestRoute.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
        steps,
        estimated: mode === 'motorbike',
        caveat: motorbikeCaveat
      }
    });
  } catch {
    return NextResponse.json({ route: estimateRoute(origin, destination, mode) });
  }
}
