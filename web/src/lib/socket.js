const PING_INTERVAL_MS = 25000;
const MAX_RECONNECT_DELAY_MS = 15000;

// A dropped connection (network blip, backgrounded tab, phone sleep) used to be
// permanent - nothing ever retried, so presence/messages silently stopped
// flowing until a manual reload. This wraps the raw WebSocket with automatic
// reconnect (capped exponential backoff) and a keepalive ping so half-dead
// sockets get noticed and replaced instead of lingering.
export function createSocket({ apiUrl, token, onEvent, onOpen }) {
  const absoluteApiUrl = apiUrl.startsWith('/') ? `${window.location.origin}${apiUrl}` : apiUrl;
  const wsUrl = absoluteApiUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api/v1', '/api/v1/realtime/ws');

  let socket = null;
  let closedByCaller = false;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let pingTimer = null;

  function clearTimers() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pingTimer) {
      window.clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function connect() {
    socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

    socket.onopen = () => {
      reconnectAttempt = 0;
      pingTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'ping' }));
      }, PING_INTERVAL_MS);
      onOpen?.();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent?.(data);
      } catch (_e) {
        // ignore malformed events
      }
    };

    socket.onclose = () => {
      if (pingTimer) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
      if (closedByCaller) return;
      const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket?.close();
    };
  }

  connect();

  return {
    get readyState() {
      return socket ? socket.readyState : WebSocket.CONNECTING;
    },
    send(data) {
      socket?.send(data);
    },
    close() {
      closedByCaller = true;
      clearTimers();
      socket?.close();
    }
  };
}
