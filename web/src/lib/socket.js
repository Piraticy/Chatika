export function createSocket({ apiUrl, token, onEvent }) {
  const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api/v1', '/api/v1/realtime/ws');
  const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

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
