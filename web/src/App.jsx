import React, { useEffect, useMemo, useRef, useState } from 'react';

import AuthPanel from './components/AuthPanel';
import ChatLayout from './components/ChatLayout';
import { api, API_URL } from './lib/api';
import { createSocket } from './lib/socket';

const ACCESS_KEY = 'chatika_access';
const REFRESH_KEY = 'chatika_refresh';

export default function App() {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [token, setToken] = useState(localStorage.getItem(ACCESS_KEY) || '');
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem(REFRESH_KEY) || '');

  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [typingByRoom, setTypingByRoom] = useState({});
  const socketRef = useRef(null);
  const typingTimersRef = useRef({});
  const typingEmitRef = useRef({ roomId: '', state: false, at: 0 });

  const isAuthed = Boolean(token && me);

  useEffect(() => {
    localStorage.setItem(ACCESS_KEY, token || '');
    localStorage.setItem(REFRESH_KEY, refreshToken || '');
  }, [token, refreshToken]);

  async function hydrateSession(currentToken) {
    const meData = await api('/auth/me', { token: currentToken });
    setMe(meData);

    const roomData = await api('/chat/rooms', { token: currentToken });
    setRooms(roomData);
    if (!activeRoomId && roomData[0]) setActiveRoomId(roomData[0].id);

    if (meData.is_admin) {
      const pending = await api('/admin/pending-users', { token: currentToken });
      setPendingUsers(pending);
    }
  }

  async function tryRefresh() {
    if (!refreshToken) return false;
    try {
      const pair = await api('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: refreshToken }
      });
      setToken(pair.access_token);
      setRefreshToken(pair.refresh_token);
      await hydrateSession(pair.access_token);
      return true;
    } catch (_e) {
      setToken('');
      setRefreshToken('');
      setMe(null);
      return false;
    }
  }

  useEffect(() => {
    if (!token) return;
    hydrateSession(token).catch(() => {
      tryRefresh();
    });
  }, [token]);

  useEffect(() => {
    if (!isAuthed) return undefined;

    const socket = createSocket({
      apiUrl: API_URL,
      token,
      onEvent: (evt) => {
        if (evt.event === 'message:new' && evt.data.room_id === activeRoomId) {
          setMessages((prev) => [evt.data, ...prev]);
        } else if (evt.event === 'typing:update') {
          const { room_id: roomId, user_id: userId, is_typing: isTyping } = evt.data || {};
          if (!roomId || !userId || userId === me.id) return;

          setTypingByRoom((prev) => {
            const current = { ...(prev[roomId] || {}) };
            if (isTyping) {
              current[userId] = true;
            } else {
              delete current[userId];
            }
            return { ...prev, [roomId]: current };
          });

          if (typingTimersRef.current[userId]) {
            clearTimeout(typingTimersRef.current[userId]);
          }
          if (isTyping) {
            typingTimersRef.current[userId] = setTimeout(() => {
              setTypingByRoom((prev) => {
                const current = { ...(prev[roomId] || {}) };
                delete current[userId];
                return { ...prev, [roomId]: current };
              });
            }, 3500);
          }
        }
      }
    });
    socketRef.current = socket;

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [isAuthed, token, activeRoomId, me?.id]);

  useEffect(() => {
    if (!token || !activeRoomId) return;
    api(`/chat/rooms/${activeRoomId}/messages`, { token })
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [activeRoomId, token]);

  async function handleAuth(form) {
    setLoading(true);
    setError('');
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const pair = await api(path, { method: 'POST', body: form });
      setToken(pair.access_token);
      setRefreshToken(pair.refresh_token);
      await hydrateSession(pair.access_token);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function createRoom(name, participantIds) {
    const room = await api('/chat/rooms', {
      method: 'POST',
      token,
      body: { name, participant_ids: participantIds }
    });
    setRooms((prev) => [room, ...prev]);
    setActiveRoomId(room.id);
  }

  async function sendMessage(text) {
    await api('/chat/messages', {
      method: 'POST',
      token,
      body: { room_id: activeRoomId, text, message_type: 'text' }
    });
  }

  function sendTyping(isTyping) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !activeRoomId) return;
    const now = Date.now();
    const last = typingEmitRef.current;
    if (last.roomId === activeRoomId && last.state === isTyping && now - last.at < 1200) return;

    typingEmitRef.current = { roomId: activeRoomId, state: isTyping, at: now };
    socketRef.current.send(
      JSON.stringify({
        event: 'typing:update',
        room_id: activeRoomId,
        is_typing: isTyping
      })
    );
  }

  async function approveUser(userId) {
    await api('/admin/approve-user', {
      method: 'POST',
      token,
      body: { user_id: userId }
    });
    const pending = await api('/admin/pending-users', { token });
    setPendingUsers(pending);
  }

  const statusText = useMemo(() => (me?.is_online ? 'Online now' : 'Offline'), [me]);
  const typingUsers = useMemo(() => Object.keys(typingByRoom[activeRoomId] || {}), [typingByRoom, activeRoomId]);

  if (!isAuthed) {
    return (
      <div className="auth-root">
        <div className="glow one" />
        <div className="glow two" />
        <AuthPanel mode={mode} onModeChange={setMode} onSubmit={handleAuth} loading={loading} />
        {error && <p className="error-pill">{error}</p>}
      </div>
    );
  }

  return (
    <ChatLayout
      me={me}
      rooms={rooms}
      activeRoomId={activeRoomId}
      messages={messages}
      onSelectRoom={setActiveRoomId}
      onSend={sendMessage}
      onCreateRoom={createRoom}
      statusText={statusText}
      isAdmin={me.is_admin}
      pendingUsers={pendingUsers}
      onApprove={approveUser}
      onTyping={sendTyping}
      typingUsers={typingUsers}
    />
  );
}
