/** Shared by the server hub and the browser client. Keep this file free of imports. */
export type RealtimeUpdate = {
  friendsChanged?: boolean;
  messagesChanged?: boolean;
  publicLocationsChanged?: boolean;
  friendRequestsChanged?: boolean;
  presenceChanged?: boolean;
  error?: string;
};

export type RealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export const REALTIME_CHANNEL = 'hidden_gem_updates';
export const REALTIME_STREAM_URL = '/api/realtime/stream';
