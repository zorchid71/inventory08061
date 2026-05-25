export const API_BASE = window.location.port === '5173' ? 'http://localhost:5050' : '';

/**
 * Wrapper for standard fetch that automatically attaches the JWT token from localStorage.
 * Handles 401/403 responses by clearing the token and triggering a re-render.
 */
export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    ...options.headers,
    'Authorization': token ? `Bearer ${token}` : ''
  };

  // Automatically set Content-Type to JSON if body is an object and not FormData
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    // Token is invalid or expired
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('auth-error'));
    throw new Error('กรุณาเข้าสู่ระบบใหม่ (Session Expired)');
  }

  return response;
}
