import { z } from 'zod';

export async function parseJsonBody<Schema extends z.ZodTypeAny>(
  request: Request,
  schema: Schema
): Promise<{ success: true; data: z.output<Schema> } | { success: false }> {
  try {
    const parsed = schema.safeParse(await request.json());
    return parsed.success ? { success: true, data: parsed.data } : { success: false };
  } catch {
    return { success: false };
  }
}

export function parseJsonMessage<Value>(value: string): Value | null {
  try {
    return JSON.parse(value) as Value;
  } catch {
    return null;
  }
}

export async function readApiResponse(
  response: Response
): Promise<Awaited<ReturnType<Response['json']>>> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`The server returned an empty response (HTTP ${response.status})`);
  }

  try {
    return JSON.parse(body) as Awaited<ReturnType<Response['json']>>;
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status})`);
  }
}
