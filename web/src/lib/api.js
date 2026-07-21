const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

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

export async function uploadFile(file, { token } = {}) {
  const formData = new FormData();
  formData.append('file', file, file.name || 'chatika-media');
  const res = await fetch(`${API_URL}/media/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });

  if (!res.ok) {
    let error = 'Upload failed';
    try {
      const json = await res.json();
      error = json.detail || error;
    } catch (_e) {
      error = `Upload failed: ${res.status}`;
    }
    throw new Error(error);
  }

  return res.json();
}

export function resolveMediaUrl(mediaUrl) {
  if (!mediaUrl || /^https?:\/\//i.test(mediaUrl) || !API_URL.startsWith('http')) return mediaUrl;
  return `${new URL(API_URL).origin}${mediaUrl}`;
}

export { API_URL };
