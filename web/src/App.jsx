import React, { useEffect, useMemo, useRef, useState } from 'react';

import AuthPanel from './components/AuthPanel';
import AdminPanel from './components/AdminPanel';
import CallDialog from './components/CallDialog';
import ChatLayout from './components/ChatLayout';
import BetaFeedbackModal from './components/BetaFeedbackModal';
import ScreenShareDialog from './components/ScreenShareDialog';
import { api, API_URL, uploadFile } from './lib/api';
import { createSocket } from './lib/socket';
import { enableWebPush } from './lib/push';
import { startChatikaRingtone, stopChatikaRingtone } from './lib/callTone';
import { APP_VERSION } from './lib/version';

const ACCESS_KEY = 'chatika_access';
const REFRESH_KEY = 'chatika_refresh';

function getScreenShareAvailability() {
  const mobile = typeof navigator !== 'undefined' && (navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const secure = typeof window !== 'undefined' && window.isSecureContext;
  const supported = Boolean(secure && navigator.mediaDevices?.getDisplayMedia && window.RTCPeerConnection);

  if (supported) return { supported: true, mobile, message: '' };
  if (!secure) return { supported: false, mobile, message: 'Screen sharing needs a secure HTTPS connection.' };
  if (mobile) return { supported: false, mobile, message: 'This browser can view shared screens, but does not provide device screen capture. Try the latest Chrome or Edge, or share from desktop.' };
  return { supported: false, mobile, message: 'This browser does not provide screen capture. Try the latest Chrome, Edge, or Firefox over HTTPS.' };
}

export default function App() {
  const initialAccessToken = localStorage.getItem(ACCESS_KEY) || '';
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [token, setToken] = useState(initialAccessToken);
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem(REFRESH_KEY) || '');
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionRetry, setSessionRetry] = useState(0);

  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [readByMessage, setReadByMessage] = useState({});
  const [deliveredByMessage, setDeliveredByMessage] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [pendingUsers, setPendingUsers] = useState([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminFeedback, setAdminFeedback] = useState([]);
  const [adminPasswordResetRequests, setAdminPasswordResetRequests] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [typingByRoom, setTypingByRoom] = useState({});
  const [dataSaver, setDataSaver] = useState(localStorage.getItem('chatika_data_saver') === 'true');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareActive, setShareActive] = useState(false);
  const [localShareStream, setLocalShareStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [shareError, setShareError] = useState('');
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callKind, setCallKind] = useState('audio');
  const [incomingCall, setIncomingCall] = useState(null);
  const [localCallStream, setLocalCallStream] = useState(null);
  const [remoteCallStreams, setRemoteCallStreams] = useState({});
  const [callError, setCallError] = useState('');
  const [callConnectionStatus, setCallConnectionStatus] = useState('Ready');
  const [callMuted, setCallMuted] = useState(false);
  const [callCameraOff, setCallCameraOff] = useState(false);
  const [callSpeakerOn, setCallSpeakerOn] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState(localStorage.getItem('chatika_notification_status') || 'idle');
  const [mediaError, setMediaError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const socketRef = useRef(null);
  const typingTimersRef = useRef({});
  const typingEmitRef = useRef({ roomId: '', state: false, at: 0 });
  const localShareStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const peerRoomIdsRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const iceServersRef = useRef([]);
  const remoteStreamsRef = useRef(new Map());
  const localCallStreamRef = useRef(null);
  const callPeerConnectionsRef = useRef(new Map());
  const callPeerRoomIdsRef = useRef(new Map());
  const callPendingIceRef = useRef(new Map());
  const remoteCallStreamsRef = useRef(new Map());
  const callRetryTimersRef = useRef(new Map());
  const shareRetryTimersRef = useRef(new Map());
  const callInitiatorRef = useRef(false);
  const callRoomIdRef = useRef('');
  const callConnectedAtRef = useRef(null);
  const callLoggedRef = useRef(false);
  const iceTransportPolicyRef = useRef('all');
  const readReceiptTimerRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const socketHandlersRef = useRef({ onEvent: () => {}, onOpen: () => {} });

  const isAuthed = Boolean(token && me);

  useEffect(() => {
    localStorage.setItem(ACCESS_KEY, token || '');
    localStorage.setItem(REFRESH_KEY, refreshToken || '');
  }, [token, refreshToken]);

  useEffect(() => {
    localStorage.setItem('chatika_data_saver', String(dataSaver));
  }, [dataSaver]);

  useEffect(() => {
    if (notificationStatus !== 'loading') {
      localStorage.setItem('chatika_notification_status', notificationStatus);
    }
  }, [notificationStatus]);

  useEffect(() => {
    // Warm the free-tier backend early to reduce first interactive wait on mobile.
    fetch(`${API_URL}/health`).catch(() => undefined);
  }, []);

  async function hydrateSession(currentToken) {
    // /auth/me and /chat/rooms don't depend on each other - only /admin/pending-users
    // needs to know the resolved user first. Fetching sequentially doubled the
    // wait on every cold start.
    const [meData, roomData] = await Promise.all([
      api('/auth/me', { token: currentToken }),
      api('/chat/rooms', { token: currentToken })
    ]);
    setMe(meData);
    setRooms(roomData);

    // A push notification deep-links here as /?room=<id> (see routes_chat.py /
    // routes_presence_ws.py) - honor it once, then drop it from the URL so a
    // later refresh doesn't keep forcing that room open.
    const deepLinkRoomId = new URLSearchParams(window.location.search).get('room');
    const validDeepLink = deepLinkRoomId && roomData.some((room) => room.id === deepLinkRoomId);
    setActiveRoomId(validDeepLink ? deepLinkRoomId : '');
    setMessages([]);
    if (deepLinkRoomId) window.history.replaceState(null, '', window.location.pathname);

    if (canUseAdmin(meData)) {
      const pending = await api('/admin/pending-users', { token: currentToken });
      setPendingUsers(pending);
    }
  }

  async function refreshTokenPair() {
    if (!refreshToken) return false;
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    refreshPromiseRef.current = (async () => {
      try {
        const pair = await api('/auth/refresh', {
          method: 'POST',
          body: { refresh_token: refreshToken }
        });
        setToken(pair.access_token);
        setRefreshToken(pair.refresh_token);
        return pair.access_token;
      } catch (refreshError) {
        if (refreshError.status === 401 || refreshError.status === 403) {
          setToken('');
          setRefreshToken('');
          setMe(null);
          return false;
        }
        throw refreshError;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();
    return refreshPromiseRef.current;
  }

  async function tryRefresh() {
    const newToken = await refreshTokenPair();
    if (!newToken) return false;
    await hydrateSession(newToken);
    return true;
  }

  // Access tokens expire after 30 minutes (see backend settings.access_token_minutes).
  // Any request made mid-session after that would otherwise surface the raw
  // "Invalid token" 401 straight to the user - this transparently refreshes
  // once and retries, without resetting the active room/messages the way a
  // full tryRefresh()+hydrateSession() would.
  async function authedApi(path, opts = {}) {
    const requestToken = opts.token ?? token;
    try {
      return await api(path, { ...opts, token: requestToken });
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        const newToken = await refreshTokenPair();
        if (newToken) return api(path, { ...opts, token: newToken });
      }
      throw requestError;
    }
  }

  async function authedUpload(file, opts = {}) {
    const requestToken = opts.token ?? token;
    try {
      return await uploadFile(file, { ...opts, token: requestToken });
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        const newToken = await refreshTokenPair();
        if (newToken) return uploadFile(file, { ...opts, token: newToken });
      }
      throw requestError;
    }
  }

  useEffect(() => {
    let active = true;
    let retryTimer;
    if (!token) {
      if (refreshToken) {
        setSessionReady(false);
        tryRefresh()
          .then((restored) => {
            if (active && !restored) setSessionReady(true);
          })
          .catch(() => {
            if (active) retryTimer = window.setTimeout(() => setSessionRetry((value) => value + 1), 2200);
          });
        return () => {
          active = false;
          window.clearTimeout(retryTimer);
        };
      }
      const startupDelay = window.setTimeout(() => {
        if (active) setSessionReady(true);
      }, 180);
      return () => {
        active = false;
        window.clearTimeout(startupDelay);
      };
    }

    setSessionReady(false);
    (async () => {
      try {
        await hydrateSession(token);
        if (active) setSessionReady(true);
      } catch (sessionError) {
        try {
          const restored = sessionError.status === 401 || sessionError.status === 403
            ? await tryRefresh()
            : false;
          if (active && restored) setSessionReady(true);
          if (active && !restored && (sessionError.status === 401 || sessionError.status === 403)) {
            setSessionReady(true);
          }
          if (active && !restored && sessionError.status !== 401 && sessionError.status !== 403) {
            retryTimer = window.setTimeout(() => setSessionRetry((value) => value + 1), 2200);
          }
        } catch (_refreshError) {
          if (active) retryTimer = window.setTimeout(() => setSessionRetry((value) => value + 1), 2200);
        }
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(retryTimer);
    };
  }, [token, refreshToken, sessionRetry]);

  // Kept fresh on every render so the long-lived socket below never needs to
  // reconnect just because activeRoomId/me/call state changed - reconnecting
  // on every room switch was both slow (full WS handshake + presence write)
  // and forced other closures (like handleCallSignal) to run stale.
  useEffect(() => {
    socketHandlersRef.current = {
      onEvent: (evt) => {
        if (evt.event === 'message:new') {
          if (evt.data.sender_id !== me.id) sendDeliveryReceipt(evt.data.room_id, [evt.data.id]);
          if (evt.data.room_id === activeRoomId && evt.data.sender_id !== me.id) {
            setMessages((prev) => (prev.some((message) => message.id === evt.data.id) ? prev : [evt.data, ...prev]));
          }
          updateRoomPreview(evt.data);
          if (evt.data.sender_id !== me.id && evt.data.room_id !== activeRoomId) {
            setUnreadCounts((prev) => ({ ...prev, [evt.data.room_id]: (prev[evt.data.room_id] || 0) + 1 }));
          }
        } else if (evt.event === 'message:delivered' && evt.data.recipient_id !== me.id) {
          setDeliveredByMessage((prev) => {
            const next = { ...prev };
            (evt.data.message_ids || []).forEach((messageId) => {
              next[messageId] = true;
            });
            return next;
          });
        } else if (evt.event === 'message:read' && evt.data.room_id === activeRoomId && evt.data.reader_id !== me.id) {
          setReadByMessage((prev) => {
            const next = { ...prev };
            (evt.data.message_ids || []).forEach((messageId) => {
              next[messageId] = true;
            });
            return next;
          });
        } else if (evt.event === 'room:invite' && evt.data?.room) {
          setRooms((prev) => [evt.data.room, ...prev.filter((room) => room.id !== evt.data.room.id)]);
        } else if (evt.event === 'message:reaction' && evt.data.room_id === activeRoomId) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === evt.data.message_id ? { ...msg, reaction_users: evt.data.reaction_users || {} } : msg))
          );
        } else if (evt.event === 'presence:update' && evt.data?.user_id) {
          const presence = evt.data;
          setRooms((prev) => prev.map((room) => ({
            ...room,
            participants: (room.participants || []).map((participant) => (
              participant.id === presence.user_id
                ? { ...participant, is_online: presence.is_online, last_seen_at: presence.last_seen_at }
                : participant
            ))
          })));
          if (presence.user_id === me.id) {
            setMe((current) => current ? { ...current, is_online: presence.is_online, last_seen_at: presence.last_seen_at } : current);
          }
        } else if (evt.event === 'call:signal') {
          if (!evt.room_id || evt.room_id === activeRoomId) {
            handleCallSignal(evt).catch((error) => {
              if (evt.data?.type?.startsWith('call-')) setCallError(error.message || 'Call connection failed.');
              else setShareError(error.message || 'Screen sharing connection failed.');
            });
          }
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
      },
      onOpen: () => {
        setMe((current) => current ? { ...current, is_online: true, last_seen_at: null } : current);
        scheduleReadReceipts(messages);
      }
    };
  });

  useEffect(() => {
    if (!isAuthed) return undefined;

    const socket = createSocket({
      apiUrl: API_URL,
      token,
      onEvent: (evt) => socketHandlersRef.current.onEvent(evt),
      onOpen: () => socketHandlersRef.current.onOpen()
    });
    socketRef.current = socket;

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [isAuthed, token]);

  useEffect(() => {
    if (!token || !activeRoomId) return;
    authedApi(`/chat/rooms/${activeRoomId}/messages?limit=${dataSaver ? 40 : 80}`, { token })
      .then((data) => {
        setMessages(data);
        sendDeliveryReceipt(activeRoomId, data.filter((message) => message.sender_id !== me?.id).map((message) => message.id));
      })
      .catch(() => setMessages([]));
  }, [activeRoomId, token, dataSaver]);

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

  async function forgotPassword(username) {
    const data = await api('/auth/forgot-password', { method: 'POST', body: { username } });
    return data.message;
  }

  async function startDirectChat(username) {
    const room = await authedApi('/chat/direct', {
      method: 'POST',
      token,
      body: { username }
    });
    setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
    setActiveRoomId(room.id);
    return room;
  }

  async function discoverFriends(query, scope) {
    const params = new URLSearchParams({ q: query || '', scope: scope || 'online' });
    return authedApi(`/chat/discover?${params.toString()}`, { token });
  }

  async function createGroup(name, usernames) {
    const room = await authedApi('/chat/groups', {
      method: 'POST',
      token,
      body: { name, usernames }
    });
    setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
    setActiveRoomId(room.id);
  }

  async function updateProfilePhoto(file) {
    if (!file) return;
    const uploaded = await authedUpload(file, { token });
    const updatedProfile = await authedApi('/auth/profile', {
      method: 'PATCH',
      token,
      body: { avatar_url: uploaded.media_url }
    });
    setMe(updatedProfile);
    setRooms((prev) => prev.map((room) => ({
      ...room,
      participants: (room.participants || []).map((participant) => (
        participant.id === updatedProfile.id
          ? { ...participant, avatar_url: updatedProfile.avatar_url }
          : participant
      ))
    })));
  }

  // Keeps the sidebar's last-message preview and ordering in sync as messages
  // arrive, without waiting for a full /chat/rooms refetch.
  function updateRoomPreview(message) {
    setRooms((prev) => {
      const next = prev.map((room) => (
        room.id === message.room_id
          ? { ...room, last_message_text: message.text, last_message_type: message.message_type, last_message_at: message.created_at, last_message_sender_id: message.sender_id }
          : room
      ));
      return next.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    });
  }

  // "Delivered" = this device received the message (realtime push or a later
  // fetch), independent of whether the recipient has actually opened the
  // room yet. "Read" (below) stays reserved for that latter, stronger signal.
  function sendDeliveryReceipt(roomId, messageIds) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !roomId) return;
    const ids = (messageIds || []).filter((id) => !String(id).startsWith('local-'));
    if (!ids.length) return;
    socketRef.current.send(JSON.stringify({ event: 'message:delivered', room_id: roomId, message_ids: ids }));
  }

  function sendReadReceipts(candidateMessages = messages) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !activeRoomId) return;
    const messageIds = candidateMessages
      .filter((message) => message.room_id === activeRoomId && message.sender_id !== me?.id && !String(message.id).startsWith('local-'))
      .map((message) => message.id);
    if (!messageIds.length) return;
    socketRef.current.send(JSON.stringify({ event: 'message:read', room_id: activeRoomId, message_ids: messageIds }));
  }

  function scheduleReadReceipts(candidateMessages = messages) {
    if (readReceiptTimerRef.current) window.clearTimeout(readReceiptTimerRef.current);
    readReceiptTimerRef.current = window.setTimeout(() => {
      sendReadReceipts(candidateMessages);
      readReceiptTimerRef.current = null;
    }, 120);
  }

  useEffect(() => {
    scheduleReadReceipts(messages);
    return () => {
      if (readReceiptTimerRef.current) window.clearTimeout(readReceiptTimerRef.current);
    };
  }, [messages, activeRoomId, me?.id]);

  async function sendMessage(text, replyTo = null) {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMessage = {
      id: localId,
      room_id: activeRoomId,
      sender_id: me.id,
      message_type: 'text',
      is_encrypted: false,
      reaction_users: {},
      reply_to_id: replyTo?.id || null,
      reply_to_sender_username: replyTo?.sender_id === me.id ? me.username : replyTo?.sender_username || null,
      reply_to_text: replyTo?.text || null,
      text,
      media_url: null,
      created_at: new Date().toISOString(),
      status: 'sending'
    };
    setMessageError('');
    setMessages((prev) => [optimisticMessage, ...prev]);
    try {
      const sent = await authedApi('/chat/messages', {
        method: 'POST',
        token,
        body: { room_id: activeRoomId, text, message_type: 'text', reply_to_id: replyTo?.id || null }
      });
      setMessages((prev) => prev.map((message) => (message.id === localId ? { ...sent, status: 'sent' } : message)));
      updateRoomPreview(sent);
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== localId));
      setMessageError(error.message || 'Message could not be sent.');
    }
  }

  async function sendMedia(file, requestedType) {
    if (!activeRoomId || !file) return;
    setMediaError('');
    try {
      const uploaded = await authedUpload(file, { token });
      const messageType = requestedType || (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file');
      const sent = await authedApi('/chat/messages', {
        method: 'POST',
        token,
        body: {
          room_id: activeRoomId,
          text: requestedType === 'voice' ? 'Voice message' : file.name,
          message_type: requestedType || messageType,
          media_url: uploaded.media_url
        }
      });
      setMessages((prev) => [sent, ...prev.filter((message) => message.id !== sent.id)]);
      updateRoomPreview(sent);
    } catch (error) {
      setMediaError(error.message || 'Unable to send this media.');
    }
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
    await authedApi('/admin/approve-user', {
      method: 'POST',
      token,
      body: { user_id: userId }
    });
    const pending = await authedApi('/admin/pending-users', { token });
    setPendingUsers(pending);
    await loadAdminUsers();
  }

  async function loadAdminUsers() {
    if (!canUseAdmin(me)) return;
    setAdminLoading(true);
    setAdminError('');
    try {
      const [users, feedback, resetRequests] = await Promise.all([
        authedApi('/admin/users', { token }),
        authedApi('/admin/feedback', { token }),
        authedApi('/admin/password-reset-requests', { token })
      ]);
      setAdminUsers(users);
      setAdminFeedback(feedback);
      setAdminPasswordResetRequests(resetRequests);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function resetUserPassword(userId, newPassword) {
    await authedApi('/admin/reset-password', {
      method: 'POST',
      token,
      body: { user_id: userId, new_password: newPassword }
    });
    setAdminPasswordResetRequests((prev) => prev.filter((request) => request.id !== userId));
  }

  async function submitBetaFeedback(payload) {
    setFeedbackSubmitting(true);
    setFeedbackError('');
    try {
      await authedApi('/feedback/beta', {
        method: 'POST',
        token,
        body: { ...payload, app_version: APP_VERSION, platform: 'web' }
      });
      setMe((current) => current ? { ...current, needs_beta_feedback: false } : current);
    } catch (submitError) {
      setFeedbackError(submitError.message);
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function removeUser(userId, username) {
    if (!window.confirm(`Remove @${username} from Chatika?`)) return;
    try {
      await authedApi('/admin/remove-user', { method: 'POST', token, body: { user_id: userId } });
      await loadAdminUsers();
    } catch (error) {
      setAdminError(error.message);
    }
  }

  async function logout() {
    try {
      if (refreshToken) await api('/auth/logout', { method: 'POST', body: { refresh_token: refreshToken } });
    } catch (_error) {
      // Clear local access even when the network is unavailable.
    } finally {
      stopShare();
      stopCall();
      setToken('');
      setRefreshToken('');
      setMe(null);
      setRooms([]);
      setActiveRoomId('');
      setMessages([]);
      setReadByMessage({});
      setDeliveredByMessage({});
      setUnreadCounts({});
      setPendingUsers([]);
      setAdminUsers([]);
      setAdminFeedback([]);
      setAdminOpen(false);
      setInviteStatus(null);
      setMessageError('');
      setError('');
    }
  }

  async function reactToMessage(messageId, emoji) {
    if (!activeRoomId) return;
    const updated = await authedApi(`/chat/messages/${messageId}/react`, {
      method: 'POST',
      token,
      body: { room_id: activeRoomId, emoji }
    });
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, ...updated } : msg)));
  }

  async function getIceServers() {
    if (iceServersRef.current.length) return iceServersRef.current;
    try {
      const config = await authedApi('/realtime/ice-config', { token });
      iceTransportPolicyRef.current = config.force_turn ? 'relay' : 'all';
      iceServersRef.current = config.ice_servers?.length
        ? config.ice_servers
        : [{ urls: ['stun:stun.l.google.com:19302'] }];
    } catch (_error) {
      iceServersRef.current = [{ urls: ['stun:stun.l.google.com:19302'] }];
    }
    return iceServersRef.current;
  }

  function sendCallSignal(targetUserId, data, roomId = activeRoomId) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !roomId) return;
    socketRef.current.send(
      JSON.stringify({
        event: 'call:signal',
        room_id: roomId,
        target_user_id: targetUserId,
        data
      })
    );
  }

  async function createPeerConnection(userId, roomId = activeRoomId) {
    const existing = peerConnectionsRef.current.get(userId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers: await getIceServers(), iceTransportPolicy: iceTransportPolicyRef.current, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 4 });
    peerRoomIdsRef.current.set(userId, roomId);
    const stream = localShareStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    } else {
      peer.addTransceiver('video', { direction: 'recvonly' });
    }
    peer.onicecandidate = (event) => {
      if (event.candidate) sendCallSignal(userId, { type: 'ice', candidate: event.candidate }, roomId);
    };
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0] || remoteStreamsRef.current.get(userId) || new MediaStream();
      if (!event.streams[0] && !remoteStream.getTracks().includes(event.track)) remoteStream.addTrack(event.track);
      remoteStreamsRef.current.set(userId, remoteStream);
      setRemoteStreams((prev) => ({ ...prev, [userId]: remoteStream }));
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'disconnected') {
        scheduleShareRetry(userId);
      }
      if (peer.connectionState === 'failed') {
        scheduleShareRetry(userId, true);
      }
      if (peer.connectionState === 'closed') {
        const pendingRetry = shareRetryTimersRef.current.get(userId);
        if (pendingRetry) {
          window.clearTimeout(pendingRetry);
          shareRetryTimersRef.current.delete(userId);
        }
        peer.close();
        peerConnectionsRef.current.delete(userId);
        peerRoomIdsRef.current.delete(userId);
        remoteStreamsRef.current.delete(userId);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    };
    // iceConnectionState often flips to 'failed' before connectionState catches up,
    // so it's checked too as an earlier trigger for the same retry.
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed') scheduleShareRetry(userId, true);
    };
    peerConnectionsRef.current.set(userId, peer);
    return peer;
  }

  function scheduleShareRetry(userId, immediate = false) {
    if (shareRetryTimersRef.current.has(userId)) return;
    const timer = window.setTimeout(() => {
      shareRetryTimersRef.current.delete(userId);
      renegotiateSharePeer(userId);
    }, immediate ? 100 : 1200);
    shareRetryTimersRef.current.set(userId, timer);
  }

  async function renegotiateSharePeer(userId) {
    const peer = peerConnectionsRef.current.get(userId);
    if (!peer || peer.signalingState !== 'stable' || !localShareStreamRef.current) return;
    try {
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      sendCallSignal(userId, { type: 'offer', description: offer, restart: true }, peerRoomIdsRef.current.get(userId));
    } catch (_error) {
      setShareError('The screen share connection could not be restored.');
    }
  }

  async function createCallPeerConnection(userId, kind, roomId = activeRoomId) {
    const existing = callPeerConnectionsRef.current.get(userId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers: await getIceServers(), iceTransportPolicy: iceTransportPolicyRef.current, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 4 });
    callPeerRoomIdsRef.current.set(userId, roomId);
    const stream = localCallStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    } else {
      peer.addTransceiver('audio', { direction: 'recvonly' });
      if (kind === 'video') peer.addTransceiver('video', { direction: 'recvonly' });
    }
    peer.onicecandidate = (event) => {
      if (event.candidate) sendCallSignal(userId, { type: 'call-ice', candidate: event.candidate }, roomId);
    };
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0] || remoteCallStreamsRef.current.get(userId) || new MediaStream();
      if (!event.streams[0] && !remoteStream.getTracks().includes(event.track)) remoteStream.addTrack(event.track);
      remoteCallStreamsRef.current.set(userId, remoteStream);
      setRemoteCallStreams((prev) => ({ ...prev, [userId]: remoteStream }));
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        stopChatikaRingtone();
        setCallConnectionStatus('Live');
        if (!callConnectedAtRef.current) callConnectedAtRef.current = Date.now();
      }
      if (peer.connectionState === 'disconnected') {
        setCallConnectionStatus('Reconnecting');
        scheduleCallRetry(userId, kind);
      }
      if (peer.connectionState === 'failed') {
        setCallConnectionStatus('Reconnecting');
        scheduleCallRetry(userId, kind, true);
      }
      if (peer.connectionState === 'closed') {
        const pendingRetry = callRetryTimersRef.current.get(userId);
        if (pendingRetry) {
          window.clearTimeout(pendingRetry);
          callRetryTimersRef.current.delete(userId);
        }
        peer.close();
        callPeerConnectionsRef.current.delete(userId);
        callPeerRoomIdsRef.current.delete(userId);
        remoteCallStreamsRef.current.delete(userId);
        setRemoteCallStreams((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    };
    // iceConnectionState often flips to 'failed' before connectionState catches up,
    // so it's checked too as an earlier trigger for the same retry.
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed') scheduleCallRetry(userId, kind, true);
    };
    callPeerConnectionsRef.current.set(userId, peer);
    return peer;
  }

  async function startCall(kind) {
    if (callActive || incomingCall) {
      setCallError('Finish or decline your current call first.');
      return;
    }
    setCallError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setCallError('Calls are not supported in this browser. Use the latest browser over HTTPS.');
      return;
    }
    if (!window.isSecureContext) {
      setCallError('Calls require a secure HTTPS connection. Open the hosted Chatika address, not HTTP.');
      return;
    }

    try {
      startChatikaRingtone('outgoing');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: kind === 'video' ? {
          facingMode: 'user',
          width: { ideal: dataSaver ? 640 : 960, max: dataSaver ? 854 : 1280 },
          height: { ideal: dataSaver ? 480 : 720, max: dataSaver ? 480 : 720 },
          frameRate: { ideal: dataSaver ? 15 : 24, max: dataSaver ? 20 : 30 }
        } : false
      });
      localCallStreamRef.current = stream;
      setLocalCallStream(stream);
      setCallKind(kind);
      setCallMuted(false);
      setCallCameraOff(false);
      setCallSpeakerOn(true);
      setCallConnectionStatus('Ringing');
      setCallActive(true);
      setCallDialogOpen(true);
      callInitiatorRef.current = true;
      callRoomIdRef.current = activeRoomId;
      callConnectedAtRef.current = null;
      callLoggedRef.current = false;

      const participants = (rooms.find((room) => room.id === activeRoomId)?.participant_ids || []).filter((id) => id !== me.id);
      await Promise.all(participants.map(async (userId) => {
        const peer = await createCallPeerConnection(userId, kind, activeRoomId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendCallSignal(userId, { type: 'call-offer', kind, description: offer }, activeRoomId);
      }));
    } catch (error) {
      const message = error.name !== 'AbortError' && error.name !== 'NotAllowedError'
        ? error.message || 'Unable to start the call.'
        : 'Microphone or camera permission was not granted.';
      stopCall(false);
      setCallError(message);
      setCallDialogOpen(true);
    }
  }

  async function acceptIncomingCall() {
    const call = incomingCall;
    if (!call) return;
    setCallError('');
    stopChatikaRingtone();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: call.kind === 'video' ? { facingMode: 'user', width: { ideal: 960, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 30 } } : false
      });
      localCallStreamRef.current = stream;
      setLocalCallStream(stream);
      setCallKind(call.kind);
      setCallMuted(false);
      setCallCameraOff(false);
      setCallSpeakerOn(true);
      setCallConnectionStatus('Connecting');
      setCallActive(true);
      setCallDialogOpen(true);
      callInitiatorRef.current = false;
      callRoomIdRef.current = call.roomId;
      callConnectedAtRef.current = null;
      callLoggedRef.current = false;
      const peer = await createCallPeerConnection(call.fromUserId, call.kind, call.roomId);
      await peer.setRemoteDescription(call.description);
      const pending = callPendingIceRef.current.get(call.fromUserId) || [];
      await Promise.all(pending.map((candidate) => peer.addIceCandidate(candidate)));
      callPendingIceRef.current.delete(call.fromUserId);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendCallSignal(call.fromUserId, { type: 'call-answer', description: answer }, call.roomId);
      setIncomingCall(null);
    } catch (error) {
      setCallError(error.message || 'Unable to answer the call.');
    }
  }

  function rejectIncomingCall() {
    if (incomingCall?.fromUserId) sendCallSignal(incomingCall.fromUserId, { type: 'call-hangup' }, incomingCall.roomId);
    stopChatikaRingtone();
    setIncomingCall(null);
    setCallDialogOpen(false);
  }

  // Only the initiating side logs the call so both parties don't each write their
  // own duplicate entry - the record is a normal chat message, so it shows up for
  // everyone in the room the same way any other message does.
  async function logCallRecord(kind, outcome, durationSeconds) {
    const roomId = callRoomIdRef.current;
    if (!roomId) return;
    try {
      const sent = await authedApi('/chat/messages', {
        method: 'POST',
        token,
        body: {
          room_id: roomId,
          text: JSON.stringify({ kind, outcome, duration_seconds: durationSeconds }),
          message_type: 'call_log'
        }
      });
      if (roomId === activeRoomId) setMessages((prev) => [sent, ...prev]);
      updateRoomPreview(sent);
    } catch (_error) {
      // best-effort - a missing call record shouldn't block hanging up
    }
  }

  function stopCall(notify = true) {
    stopChatikaRingtone();
    if (callInitiatorRef.current && !callLoggedRef.current) {
      callLoggedRef.current = true;
      const outcome = callConnectedAtRef.current ? 'completed' : 'missed';
      const durationSeconds = callConnectedAtRef.current
        ? Math.max(0, Math.round((Date.now() - callConnectedAtRef.current) / 1000))
        : 0;
      logCallRecord(callKind, outcome, durationSeconds);
    }
    callInitiatorRef.current = false;
    callConnectedAtRef.current = null;
    if (notify) {
      callPeerConnectionsRef.current.forEach((_peer, userId) => sendCallSignal(userId, { type: 'call-hangup' }, callPeerRoomIdsRef.current.get(userId)));
    }
    localCallStreamRef.current?.getTracks().forEach((track) => track.stop());
    localCallStreamRef.current = null;
    setLocalCallStream(null);
    setRemoteCallStreams({});
    remoteCallStreamsRef.current.clear();
    setCallActive(false);
    setIncomingCall(null);
    setCallDialogOpen(false);
    callPeerConnectionsRef.current.forEach((peer) => peer.close());
    callPeerConnectionsRef.current.clear();
    callPeerRoomIdsRef.current.clear();
    callPendingIceRef.current.clear();
    callRetryTimersRef.current.forEach((timer) => clearTimeout(timer));
    callRetryTimersRef.current.clear();
    setCallConnectionStatus('Ready');
    setCallMuted(false);
    setCallCameraOff(false);
    setCallSpeakerOn(true);
  }

  async function renegotiateCallPeer(userId, kind) {
    const peer = callPeerConnectionsRef.current.get(userId);
    if (!peer || peer.signalingState !== 'stable' || !callActive) return;
    try {
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      sendCallSignal(userId, { type: 'call-offer', kind, description: offer, restart: true }, callPeerRoomIdsRef.current.get(userId));
    } catch (_error) {
      setCallError('The connection could not be restored. Please try the call again.');
    }
  }

  function scheduleCallRetry(userId, kind, immediate = false) {
    if (callRetryTimersRef.current.has(userId)) return;
    const timer = window.setTimeout(() => {
      callRetryTimersRef.current.delete(userId);
      renegotiateCallPeer(userId, kind);
    }, immediate ? 100 : 1200);
    callRetryTimersRef.current.set(userId, timer);
  }

  function toggleCallMute() {
    const next = !callMuted;
    localCallStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setCallMuted(next);
  }

  function toggleCallCamera() {
    const next = !callCameraOff;
    localCallStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; });
    setCallCameraOff(next);
  }

  function toggleCallSpeaker() {
    setCallSpeakerOn((enabled) => !enabled);
  }

  async function enableNotifications() {
    setNotificationStatus('loading');
    try {
      await enableWebPush(token);
      setNotificationStatus('on');
    } catch (pushError) {
      setNotificationStatus(
        window.Notification?.permission === 'denied'
          ? 'denied'
          : 'unavailable'
      );
    }
  }

  async function startShare() {
    setShareError('');
    const availability = getScreenShareAvailability();
    if (!availability.supported) {
      setShareError(availability.message);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: dataSaver
          ? { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 15, max: 15 } }
          : { width: { ideal: 1920, max: 2560 }, height: { ideal: 1080, max: 1440 }, frameRate: { ideal: 24, max: 30 } },
        audio: false
      });
      localShareStreamRef.current = stream;
      setLocalShareStream(stream);
      setShareActive(true);
      stream.getVideoTracks()[0].onended = stopShare;

      const participants = (rooms.find((room) => room.id === activeRoomId)?.participant_ids || []).filter((id) => id !== me.id);
      await Promise.all(
        participants.map(async (userId) => {
          const peer = await createPeerConnection(userId, activeRoomId);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          sendCallSignal(userId, { type: 'offer', description: offer }, activeRoomId);
        })
      );
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') setShareError(error.message || 'Unable to start screen sharing.');
    }
  }

  function stopShare() {
    peerConnectionsRef.current.forEach((_peer, userId) => sendCallSignal(userId, { type: 'hangup' }, peerRoomIdsRef.current.get(userId)));
    localShareStreamRef.current?.getTracks().forEach((track) => track.stop());
    localShareStreamRef.current = null;
    setLocalShareStream(null);
    setShareActive(false);
    setRemoteStreams({});
    remoteStreamsRef.current.clear();
    peerConnectionsRef.current.forEach((peer) => peer.close());
    peerConnectionsRef.current.clear();
    peerRoomIdsRef.current.clear();
    pendingIceRef.current.clear();
    shareRetryTimersRef.current.forEach((timer) => clearTimeout(timer));
    shareRetryTimersRef.current.clear();
  }

  async function handleShareSignal(userId, data, roomId) {
    const peer = data.type === 'hangup' ? peerConnectionsRef.current.get(userId) : await createPeerConnection(userId, roomId);
    if (!peer) return;

    if (data.type === 'offer') {
      setShareDialogOpen(true);
      setShareError('');
      await peer.setRemoteDescription(data.description);
      const pending = pendingIceRef.current.get(userId) || [];
      await Promise.all(pending.map((candidate) => peer.addIceCandidate(candidate)));
      pendingIceRef.current.delete(userId);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendCallSignal(userId, { type: 'answer', description: answer }, roomId);
    } else if (data.type === 'answer') {
      await peer.setRemoteDescription(data.description);
      const pending = pendingIceRef.current.get(userId) || [];
      await Promise.all(pending.map((candidate) => peer.addIceCandidate(candidate)));
      pendingIceRef.current.delete(userId);
    } else if (data.type === 'ice') {
      if (peer.remoteDescription) await peer.addIceCandidate(data.candidate);
      else pendingIceRef.current.set(userId, [...(pendingIceRef.current.get(userId) || []), data.candidate]);
    } else if (data.type === 'hangup') {
      peer.close();
      peerConnectionsRef.current.delete(userId);
      peerRoomIdsRef.current.delete(userId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      remoteStreamsRef.current.delete(userId);
    }
  }

  async function handleCallSignal(evt) {
    const { from_user_id: userId, room_id: roomId, data } = evt;
    if (!userId || !data || !window.RTCPeerConnection) return;
    if (['offer', 'answer', 'ice'].includes(data.type)) {
      await handleShareSignal(userId, data, roomId);
      return;
    }

    if (data.type === 'call-offer') {
      const existingPeer = callPeerConnectionsRef.current.get(userId);
      if (existingPeer && callActive) {
        if (existingPeer.signalingState === 'have-local-offer') await existingPeer.setLocalDescription({ type: 'rollback' });
        await existingPeer.setRemoteDescription(data.description);
        const pending = callPendingIceRef.current.get(userId) || [];
        await Promise.all(pending.map((candidate) => existingPeer.addIceCandidate(candidate)));
        callPendingIceRef.current.delete(userId);
        const answer = await existingPeer.createAnswer();
        await existingPeer.setLocalDescription(answer);
        sendCallSignal(userId, { type: 'call-answer', description: answer }, roomId);
        setCallConnectionStatus('Connecting');
        return;
      }
      if (callActive || incomingCall) {
        sendCallSignal(userId, { type: 'call-hangup', reason: 'busy' }, roomId);
        return;
      }
      setIncomingCall({ fromUserId: userId, roomId, kind: data.kind === 'video' ? 'video' : 'audio', description: data.description, username: evt.from_username || userId });
      startChatikaRingtone('incoming');
      setCallDialogOpen(true);
      return;
    }

    if (data.type === 'call-answer') {
      const peer = callPeerConnectionsRef.current.get(userId);
      if (!peer) return;
      await peer.setRemoteDescription(data.description);
      const pending = callPendingIceRef.current.get(userId) || [];
      await Promise.all(pending.map((candidate) => peer.addIceCandidate(candidate)));
      callPendingIceRef.current.delete(userId);
      stopChatikaRingtone();
      setCallConnectionStatus('Connecting');
    } else if (data.type === 'call-ice') {
      const peer = callPeerConnectionsRef.current.get(userId);
      if (!peer) {
        callPendingIceRef.current.set(userId, [...(callPendingIceRef.current.get(userId) || []), data.candidate]);
        return;
      }
      if (peer.remoteDescription) await peer.addIceCandidate(data.candidate);
      else callPendingIceRef.current.set(userId, [...(callPendingIceRef.current.get(userId) || []), data.candidate]);
    } else if (data.type === 'call-hangup') {
      if (data.reason === 'busy') setCallError(`@${evt.from_username || 'They'} are on another call.`);
      const peer = callPeerConnectionsRef.current.get(userId);
      if (!peer) {
        if (!callPeerConnectionsRef.current.size) stopCall(false);
        return;
      }
      peer.close();
      callPeerConnectionsRef.current.delete(userId);
      setRemoteCallStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      remoteCallStreamsRef.current.delete(userId);
      if (!callPeerConnectionsRef.current.size) stopCall(false);
    }
  }

  useEffect(() => () => {
    stopShare();
    stopCall(false);
  }, []);

  const statusText = 'Online now';
  const typingUsers = useMemo(() => Object.keys(typingByRoom[activeRoomId] || {}), [typingByRoom, activeRoomId]);
  const activeRoom = useMemo(() => rooms.find((room) => room.id === activeRoomId) || null, [rooms, activeRoomId]);
  const callParticipantNames = useMemo(
    () => Object.fromEntries((activeRoom?.participants || []).map((participant) => [participant.id, participant.username])),
    [activeRoom]
  );
  const callParticipantProfiles = useMemo(
    () => Object.fromEntries((activeRoom?.participants || []).map((participant) => [participant.id, participant])),
    [activeRoom]
  );
  const callTargetProfile = useMemo(
    () => (activeRoom?.participants || []).find((participant) => participant.id !== me?.id) || null,
    [activeRoom, me?.id]
  );
  const callTargetLabel = useMemo(() => {
    const others = (activeRoom?.participants || []).filter((participant) => participant.id !== me?.id);
    if (!others.length) return 'room participants';
    if (!activeRoom?.is_group && others[0]?.username) return `@${others[0].username}`;
    return `${others.length} participant${others.length === 1 ? '' : 's'}`;
  }, [activeRoom, me?.id]);

  if (!sessionReady) {
    return <StartupScreen />;
  }

  if (!isAuthed) {
    return (
      <div className="auth-root">
        <div className="auth-showcase">
          <div className="showcase-brand"><img src="/logo.svg" alt="" /><span>Chatika</span></div>
          <div className="showcase-copy">
            <span className="eyebrow">PRIVATE COMMUNICATION, REFINED</span>
            <h2>Less noise.<br /><em>More together.</em></h2>
            <p>Conversations that feel close, wherever your people are. Built to stay fast on real-world connections.</p>
          </div>
          <div className="showcase-card">
            <div className="showcase-card-top"><span className="status-dot" /> Quietly connected <span>now</span></div>
            <div className="showcase-lines"><i /><i /><i /></div>
            <div className="showcase-message"><span className="showcase-avatar">M</span><span><strong>Morning, team</strong><small>Everything is ready for today.</small></span><time>09:41</time></div>
          </div>
          <div className="showcase-stats"><span><strong>01</strong><small>private by default</small></span><span><strong>24/7</strong><small>across your devices</small></span></div>
        </div>
        <AuthPanel mode={mode} onModeChange={setMode} onSubmit={handleAuth} onForgotPassword={forgotPassword} loading={loading} />
        {error && <p className="error-pill">{error}</p>}
      </div>
    );
  }

  const screenShareAvailability = getScreenShareAvailability();

  return (
    <>
      <ChatLayout
        me={me}
        rooms={rooms}
        activeRoomId={activeRoomId}
        messages={messages}
        readByMessage={readByMessage}
        deliveredByMessage={deliveredByMessage}
        unreadCounts={unreadCounts}
        onSelectRoom={(roomId) => {
          setActiveRoomId(roomId);
          setUnreadCounts((prev) => (prev[roomId] ? { ...prev, [roomId]: 0 } : prev));
        }}
        onSend={sendMessage}
        onSendMedia={sendMedia}
        mediaError={mediaError || messageError}
        onStartDirect={startDirectChat}
        onDiscoverFriends={discoverFriends}
        onCreateGroup={createGroup}
        onChangeProfilePhoto={updateProfilePhoto}
        statusText={statusText}
        isAdmin={canUseAdmin(me)}
        pendingUsers={pendingUsers}
        onApprove={approveUser}
        onTyping={sendTyping}
        typingUsers={typingUsers}
        onReact={reactToMessage}
        onLogout={logout}
        notificationStatus={notificationStatus}
        onEnableNotifications={enableNotifications}
        onOpenAdmin={() => {
          setAdminOpen(true);
          loadAdminUsers();
        }}
        dataSaver={dataSaver}
        onToggleDataSaver={() => setDataSaver((value) => !value)}
        callActive={callActive}
        onStartCall={(kind) => {
          if (callActive || incomingCall) {
            setCallError('Finish or decline your current call first.');
            setCallDialogOpen(true);
            return;
          }
          setCallError('');
          setCallDialogOpen(true);
          if (kind) startCall(kind);
        }}
        shareActive={shareActive}
        onShareScreen={() => {
          setShareError('');
          setShareDialogOpen(true);
        }}
      />
      <ScreenShareDialog
        open={shareDialogOpen}
        supported={screenShareAvailability.supported}
        isMobile={screenShareAvailability.mobile}
        unavailableMessage={screenShareAvailability.message}
        active={shareActive}
        localStream={localShareStream}
        remoteStreams={remoteStreams}
        error={shareError}
        dataSaver={dataSaver}
        onStart={startShare}
        onStop={stopShare}
        onClose={() => setShareDialogOpen(false)}
        onToggleDataSaver={() => setDataSaver((value) => !value)}
      />
      <CallDialog
        open={callDialogOpen}
        active={callActive}
        kind={callKind}
        incoming={incomingCall}
        localStream={localCallStream}
        remoteStreams={remoteCallStreams}
        error={callError}
        connectionStatus={callConnectionStatus}
        targetLabel={callTargetLabel}
        targetProfile={callTargetProfile}
        participantNames={callParticipantNames}
        participantProfiles={callParticipantProfiles}
        muted={callMuted}
        cameraOff={callCameraOff}
        speakerOn={callSpeakerOn}
        onStart={startCall}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
        onHangup={() => {
          stopCall();
          setCallDialogOpen(false);
        }}
        onToggleMute={toggleCallMute}
        onToggleCamera={toggleCallCamera}
        onToggleSpeaker={toggleCallSpeaker}
        onClose={() => setCallDialogOpen(false)}
      />
      <AdminPanel
        open={adminOpen}
        users={adminUsers}
        feedback={adminFeedback}
        passwordResetRequests={adminPasswordResetRequests}
        loading={adminLoading}
        error={adminError}
        onClose={() => setAdminOpen(false)}
        onRefresh={loadAdminUsers}
        onApprove={approveUser}
        onRemove={removeUser}
        onResetPassword={resetUserPassword}
      />
      <BetaFeedbackModal
        open={Boolean(me?.needs_beta_feedback)}
        submitting={feedbackSubmitting}
        error={feedbackError}
        onSubmit={submitBetaFeedback}
      />
    </>
  );
}

function canUseAdmin(user) {
  return Boolean(user?.is_admin && user.username?.toLowerCase() === 'piraticy');
}

function StartupScreen() {
  return (
    <main className="startup-screen" aria-label="Chatika is starting">
      <img src="/logo.svg" alt="" />
      <strong>Chatika</strong>
      <span>Opening your conversations…</span>
      <i aria-hidden="true"><b /><b /><b /></i>
    </main>
  );
}
