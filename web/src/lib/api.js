const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const REQUEST_TIMEOUT_MS = 15_000;

async function requestWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    const message = controller.signal.aborted
      ? 'Chatika is taking too long to respond. Please try again.'
      : 'Chatika could not be reached. Check your connection and try again.';
    const requestError = new Error(message);
    requestError.status = 0;
    throw requestError;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function api(path, { method = 'GET', token, body } = {}) {
  const res = await requestWithTimeout(`${API_URL}${path}`, {
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
    const requestError = new Error(error);
    requestError.status = res.status;
    throw requestError;
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function uploadFile(file, { token } = {}) {
  const formData = new FormData();
  formData.append('file', file, file.name || 'chatika-media');
  const res = await requestWithTimeout(`${API_URL}/media/upload`, {
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
    const requestError = new Error(error);
    requestError.status = res.status;
    throw requestError;
  }

  return res.json();
}

export function resolveMediaUrl(mediaUrl) {
  if (!mediaUrl || /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(mediaUrl) || /^(?:blob|data):/i.test(mediaUrl) || !API_URL.startsWith('http')) return mediaUrl;
  return `${new URL(API_URL).origin}${mediaUrl}`;
}

export { API_URL };
