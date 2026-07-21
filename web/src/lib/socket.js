export function createSocket({ apiUrl, token, onEvent, onOpen }) {
  const absoluteApiUrl = apiUrl.startsWith('/') ? `${window.location.origin}${apiUrl}` : apiUrl;
  const wsUrl = absoluteApiUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api/v1', '/api/v1/realtime/ws');
  const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

  socket.onopen = () => onOpen?.();

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent?.(data);
    } catch (_e) {
      // ignore malformed events
    }
  };

  return socket;
}
