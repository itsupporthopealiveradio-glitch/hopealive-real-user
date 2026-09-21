const API_BASE = import.meta.env.VITE_WAMP_API_URL || 'http://localhost/hopealive-api';

export interface WampUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  employeeId?: string | null;
  employee_id?: string | null;
}

interface AuthResponse {
  token: string;
  user: WampUser;
}

export async function wampLogin(email: string, password: string, admin = false): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, admin }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to sign in');
  localStorage.setItem('wamp_token', data.token);
  localStorage.setItem('wamp_user', JSON.stringify(data.user));
  return data;
}

export async function wampSetup(email: string, employeeNumber: string, pin: string): Promise<void> {
  const response = await fetch(`${API_BASE}/setup.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, employeeNumber, password: pin }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to set up account');
}

export async function wampLogout(): Promise<void> {
  const token = localStorage.getItem('wamp_token');
  if (token) await fetch(`${API_BASE}/logout.php`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  localStorage.removeItem('wamp_token');
  localStorage.removeItem('wamp_user');
}

export function wampUser(): WampUser | null {
  try { return JSON.parse(localStorage.getItem('wamp_user') || 'null'); } catch { return null; }
}

export function wampToken(): string | null {
  return localStorage.getItem('wamp_token');
}

export function parseWampTimestamp(value: string): Date {
  const normalized = value.includes('T') || /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  return new Date(normalized);
}

export async function wampMe(): Promise<WampUser> {
  const token = wampToken();
  if (!token) throw new Error('Authentication required');
  const response = await fetch(`${API_BASE}/me.php`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Authentication required');
  const user = {
    ...data.user,
    id: data.user.id || data.user.user_id,
    firstName: data.user.firstName || data.user.first_name,
    lastName: data.user.lastName || data.user.last_name,
    employeeId: data.user.employeeId || data.user.employee_id || null,
  };
  localStorage.setItem('wamp_user', JSON.stringify(user));
  return user;
}

export async function wampClockIn(clockInAt = new Date().toISOString()): Promise<any> {
  const response = await fetch(`${API_BASE}/rpc.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(wampToken() ? { Authorization: `Bearer ${wampToken()}` } : {}) },
    body: JSON.stringify({ name: 'clock_in', params: { clock_in_at: clockInAt } }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to clock in');
  return data.data;
}

export async function wampClockOut(reason = 'clock_out', clockOutAt = new Date().toISOString()): Promise<any> {
  const response = await fetch(`${API_BASE}/rpc.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(wampToken() ? { Authorization: `Bearer ${wampToken()}` } : {}) },
    body: JSON.stringify({ name: 'clock_out', params: { clock_out_at: clockOutAt, reason } }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to clock out');
  return data.data;
}
