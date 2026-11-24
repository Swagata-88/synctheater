export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

export function generateInviteUrl(roomSlug: string, inviteToken: string): string {
  const baseUrl = getAppUrl();
  return `${baseUrl}/room/${encodeURIComponent(roomSlug)}?invite=${encodeURIComponent(inviteToken)}`;
}

export function sanitizeReturnUrl(returnUrl: string | null): string | null {
  if (!returnUrl) return null;
  const trimmed = returnUrl.trim();
  // Prevent open redirect vulnerabilities: must start with a single slash, not protocol-relative // or /\
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }
  return null;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('synctheater_token');
}

export function setStoredToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('synctheater_token', token);
}

export function clearStoredToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('synctheater_token');
  localStorage.removeItem('synctheater_user');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const base = getApiBaseUrl();
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data as T;
  } catch (error: any) {
    console.error(`[API Error] ${endpoint}:`, error.message);
    throw error;
  }
}

// Room & Invitation API helpers
export async function fetchMyRooms() {
  return apiRequest<{ success: boolean; rooms: any[] }>('/api/rooms/my');
}

export async function fetchRoomDetails(roomSlug: string, inviteToken?: string) {
  const query = inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : '';
  return apiRequest<{ success: boolean; room: any }>(`/api/rooms/${encodeURIComponent(roomSlug)}${query}`);
}

export async function joinRoom(roomSlug: string, inviteToken?: string, password?: string) {
  return apiRequest<{ success: boolean; room: any }>(`/api/rooms/${encodeURIComponent(roomSlug)}/join`, {
    method: 'POST',
    body: JSON.stringify({ inviteToken, password }),
  });
}

export async function createRoomInvitation(
  roomSlug: string,
  options?: { maxUses?: number; expiresInHours?: number }
) {
  return apiRequest<{
    success: boolean;
    invitation: {
      id: string;
      roomId: string;
      token: string;
      inviteUrl: string;
      maxUses: number | null;
      usesCount: number;
      expiresAt: string | null;
      createdAt: string;
    };
  }>(`/api/rooms/${encodeURIComponent(roomSlug)}/invitations`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export async function listRoomInvitations(roomSlug: string) {
  return apiRequest<{
    success: boolean;
    invitations: Array<{
      id: string;
      roomId: string;
      token: string;
      inviteUrl: string;
      maxUses: number | null;
      usesCount: number;
      expiresAt: string | null;
      isRevoked: boolean;
      createdAt: string;
    }>;
  }>(`/api/rooms/${encodeURIComponent(roomSlug)}/invitations`);
}

export async function revokeRoomInvitation(roomSlug: string, token: string) {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/rooms/${encodeURIComponent(roomSlug)}/invitations/${encodeURIComponent(token)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function validateRoomInvite(roomSlug: string, token: string) {
  return apiRequest<{
    valid: boolean;
    reason?: string;
    invitation?: {
      id: string;
      token: string;
      maxUses: number | null;
      usesCount: number;
      expiresAt: string | null;
    };
  }>(`/api/rooms/${encodeURIComponent(roomSlug)}/validate-invite`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// Room Lifecycle & Host Management API helpers
export async function leaveRoom(roomSlug: string) {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/rooms/${encodeURIComponent(roomSlug)}/leave`,
    {
      method: 'POST',
    }
  );
}

export async function transferHost(roomSlug: string, newHostId: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    newHostId: string;
    newHostUsername: string;
    previousHostId: string;
  }>(`/api/rooms/${encodeURIComponent(roomSlug)}/transfer-host`, {
    method: 'POST',
    body: JSON.stringify({ newHostId }),
  });
}

export async function endRoom(roomSlug: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    room: any;
  }>(`/api/rooms/${encodeURIComponent(roomSlug)}/end`, {
    method: 'POST',
  });
}

// Watch History API helpers
export interface WatchHistoryItem {
  id: string;
  roomId: string;
  roomSlug: string;
  roomName: string;
  originalHostId: string | null;
  originalHostUsername: string;
  finalHostId: string | null;
  finalHostUsername: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  totalDurationSeconds: number;
  status: 'ACTIVE' | 'CLOSING' | 'CLOSED';
  closureReason: string | null;
  userRole: 'ORIGINAL_HOST' | 'SUCCESSOR_HOST' | 'PARTICIPANT';
  userParticipationDuration: number;
  participantCount: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  userId: string | null;
  displayName: string;
  joinedAt: string;
  leftAt: string | null;
  durationSeconds: number;
  isOriginalHost: boolean;
  becameHost: boolean;
}

export interface HostTransferRecord {
  id: string;
  sessionId: string;
  previousHostId: string | null;
  previousHostUsername: string;
  newHostId: string | null;
  newHostUsername: string;
  transferredAt: string;
  reason: string;
  transferType: string;
}

export interface SessionDetailsResponse {
  success: boolean;
  session: {
    id: string;
    roomId: string;
    roomSlug: string;
    roomName: string;
    originalHostId: string | null;
    originalHostUsername: string;
    finalHostId: string | null;
    finalHostUsername: string;
    createdAt: string;
    startedAt: string | null;
    endedAt: string | null;
    totalDurationSeconds: number;
    status: 'ACTIVE' | 'CLOSING' | 'CLOSED';
    closureReason: string | null;
  };
  attendance: AttendanceRecord[];
  transfers: HostTransferRecord[];
}

export async function fetchMyWatchHistory(page = 1, limit = 10) {
  return apiRequest<{
    success: boolean;
    history: WatchHistoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/api/history/my?page=${page}&limit=${limit}`);
}

export async function fetchSessionDetails(sessionId: string) {
  return apiRequest<SessionDetailsResponse>(`/api/history/${encodeURIComponent(sessionId)}`);
}
