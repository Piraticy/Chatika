const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  if (!res.ok) {
    let error = 'Request failed';
    try {
      const json = await res.json();
      error = json.detail || error;
    } catch (_e) {
      error = `Request failed: ${res.status}`;
    }
    throw new Error(error);
  }

  if (res.status === 204) return null;
  return res.json();
}

export { API_URL };
