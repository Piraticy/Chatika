import React, { useEffect, useMemo, useRef, useState } from 'react';

import AuthPanel from './components/AuthPanel';
import AdminPanel from './components/AdminPanel';
import CallDialog from './components/CallDialog';
import ChatLayout from './components/ChatLayout';
import ScreenShareDialog from './components/ScreenShareDialog';
import { api, API_URL, uploadFile } from './lib/api';
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
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
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
  const [inviteStatus, setInviteStatus] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const socketRef = useRef(null);
  const typingTimersRef = useRef({});
  const typingEmitRef = useRef({ roomId: '', state: false, at: 0 });
  const localShareStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const iceServersRef = useRef([]);
  const localCallStreamRef = useRef(null);
  const callPeerConnectionsRef = useRef(new Map());
  const callPendingIceRef = useRef(new Map());

  const isAuthed = Boolean(token && me);

  useEffect(() => {
    localStorage.setItem(ACCESS_KEY, token || '');
    localStorage.setItem(REFRESH_KEY, refreshToken || '');
  }, [token, refreshToken]);

  useEffect(() => {
    localStorage.setItem('chatika_data_saver', String(dataSaver));
  }, [dataSaver]);

  useEffect(() => {
    // Warm the free-tier backend early to reduce first interactive wait on mobile.
    fetch(`${API_URL}/health`).catch(() => undefined);
  }, []);

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
          setMessages((prev) => (prev.some((message) => message.id === evt.data.id) ? prev : [evt.data, ...prev]));
        } else if (evt.event === 'room:invite' && evt.data?.room) {
          setRooms((prev) => [evt.data.room, ...prev.filter((room) => room.id !== evt.data.room.id)]);
        } else if (evt.event === 'message:reaction' && evt.data.room_id === activeRoomId) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === evt.data.message_id ? { ...msg, reaction_users: evt.data.reaction_users || {} } : msg))
          );
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
    api(`/chat/rooms/${activeRoomId}/messages?limit=${dataSaver ? 40 : 80}`, { token })
      .then(setMessages)
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

  async function createRoom(name, participantIds) {
    const room = await api('/chat/rooms', {
      method: 'POST',
      token,
      body: { name, participant_ids: participantIds }
    });
    setRooms((prev) => [room, ...prev]);
    setActiveRoomId(room.id);
  }

  async function inviteUser(username) {
    if (!activeRoomId) return;
    setInviteStatus({ text: 'Inviting…', error: false });
    try {
      const room = await api(`/chat/rooms/${activeRoomId}/invite`, {
        method: 'POST',
        token,
        body: { username }
      });
      setRooms((prev) => prev.map((item) => (item.id === room.id ? room : item)));
      setInviteStatus({ text: `@${username.replace(/^@/, '')} joined this room`, error: false });
    } catch (error) {
      setInviteStatus({ text: error.message, error: true });
    }
  }

  async function sendMessage(text) {
    await api('/chat/messages', {
      method: 'POST',
      token,
      body: { room_id: activeRoomId, text, message_type: 'text' }
    });
  }

  async function sendMedia(file, requestedType) {
    if (!activeRoomId || !file) return;
    setMediaError('');
    try {
      const uploaded = await uploadFile(file, { token });
      const messageType = requestedType || (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file');
      await api('/chat/messages', {
        method: 'POST',
        token,
        body: {
          room_id: activeRoomId,
          text: requestedType === 'voice' ? 'Voice message' : file.name,
          message_type: requestedType || messageType,
          media_url: uploaded.media_url
        }
      });
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
    await api('/admin/approve-user', {
      method: 'POST',
      token,
      body: { user_id: userId }
    });
    const pending = await api('/admin/pending-users', { token });
    setPendingUsers(pending);
    await loadAdminUsers();
  }

  async function loadAdminUsers() {
    if (!me?.is_admin) return;
    setAdminLoading(true);
    setAdminError('');
    try {
      const users = await api('/admin/users', { token });
      setAdminUsers(users);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function removeUser(userId, username) {
    if (!window.confirm(`Remove @${username} from Chatika?`)) return;
    try {
      await api('/admin/remove-user', { method: 'POST', token, body: { user_id: userId } });
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
      setPendingUsers([]);
      setAdminUsers([]);
      setAdminOpen(false);
      setInviteStatus(null);
      setError('');
    }
  }

  async function reactToMessage(messageId, emoji) {
    if (!activeRoomId) return;
    const updated = await api(`/chat/messages/${messageId}/react`, {
      method: 'POST',
      token,
      body: { room_id: activeRoomId, emoji }
    });
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? updated : msg)));
  }

  async function getIceServers() {
    if (iceServersRef.current.length) return iceServersRef.current;
    try {
      const config = await api('/realtime/ice-config', { token });
      iceServersRef.current = config.ice_servers || [];
    } catch (_error) {
      iceServersRef.current = [];
    }
    return iceServersRef.current;
  }

  function sendCallSignal(targetUserId, data) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !activeRoomId) return;
    socketRef.current.send(
      JSON.stringify({
        event: 'call:signal',
        room_id: activeRoomId,
        target_user_id: targetUserId,
        data
      })
    );
  }

  async function createPeerConnection(userId) {
    const existing = peerConnectionsRef.current.get(userId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers: await getIceServers() });
    const stream = localShareStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    } else {
      peer.addTransceiver('video', { direction: 'recvonly' });
    }
    peer.onicecandidate = (event) => {
      if (event.candidate) sendCallSignal(userId, { type: 'ice', candidate: event.candidate });
    };
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) setRemoteStreams((prev) => ({ ...prev, [userId]: remoteStream }));
    };
    peer.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(peer.connectionState)) {
        peer.close();
        peerConnectionsRef.current.delete(userId);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    };
    peerConnectionsRef.current.set(userId, peer);
    return peer;
  }

  async function createCallPeerConnection(userId, kind) {
    const existing = callPeerConnectionsRef.current.get(userId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers: await getIceServers() });
    const stream = localCallStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    } else {
      peer.addTransceiver('audio', { direction: 'recvonly' });
      if (kind === 'video') peer.addTransceiver('video', { direction: 'recvonly' });
    }
    peer.onicecandidate = (event) => {
      if (event.candidate) sendCallSignal(userId, { type: 'call-ice', candidate: event.candidate });
    };
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) setRemoteCallStreams((prev) => ({ ...prev, [userId]: remoteStream }));
    };
    peer.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
        peer.close();
        callPeerConnectionsRef.current.delete(userId);
        setRemoteCallStreams((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    };
    callPeerConnectionsRef.current.set(userId, peer);
    return peer;
  }

  async function startCall(kind) {
    setCallError('');
    setIncomingCall(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setCallError('Calls are not supported in this browser. Use the latest browser over HTTPS.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      localCallStreamRef.current = stream;
      setLocalCallStream(stream);
      setCallKind(kind);
      setCallActive(true);
      setCallDialogOpen(true);

      const participants = (rooms.find((room) => room.id === activeRoomId)?.participant_ids || []).filter((id) => id !== me.id);
      await Promise.all(participants.map(async (userId) => {
        const peer = await createCallPeerConnection(userId, kind);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendCallSignal(userId, { type: 'call-offer', kind, description: offer });
      }));
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') setCallError(error.message || 'Unable to start the call.');
      else setCallError('Microphone or camera permission was not granted.');
      stopCall(false);
    }
  }

  async function acceptIncomingCall() {
    const call = incomingCall;
    if (!call) return;
    setCallError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.kind === 'video' });
      localCallStreamRef.current = stream;
      setLocalCallStream(stream);
      setCallKind(call.kind);
      setCallActive(true);
      setCallDialogOpen(true);
      const peer = await createCallPeerConnection(call.fromUserId, call.kind);
      await peer.setRemoteDescription(call.description);
      const pending = callPendingIceRef.current.get(call.fromUserId) || [];
      await Promise.all(pending.map((candidate) => peer.addIceCandidate(candidate)));
      callPendingIceRef.current.delete(call.fromUserId);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendCallSignal(call.fromUserId, { type: 'call-answer', description: answer });
      setIncomingCall(null);
    } catch (error) {
      setCallError(error.message || 'Unable to answer the call.');
    }
  }

  function rejectIncomingCall() {
    if (incomingCall?.fromUserId) sendCallSignal(incomingCall.fromUserId, { type: 'call-hangup' });
    setIncomingCall(null);
    setCallDialogOpen(false);
  }

  function stopCall(notify = true) {
    if (notify) {
      callPeerConnectionsRef.current.forEach((_peer, userId) => sendCallSignal(userId, { type: 'call-hangup' }));
    }
    localCallStreamRef.current?.getTracks().forEach((track) => track.stop());
    localCallStreamRef.current = null;
    setLocalCallStream(null);
    setRemoteCallStreams({});
    setCallActive(false);
    setIncomingCall(null);
    setCallDialogOpen(false);
    callPeerConnectionsRef.current.forEach((peer) => peer.close());
    callPeerConnectionsRef.current.clear();
    callPendingIceRef.current.clear();
  }

  async function startShare() {
    setShareError('');
    if (!window.isSecureContext) {
      setShareError('Screen sharing requires a secure HTTPS connection. Open the hosted Chatika address, not an insecure HTTP address.');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setShareError('This browser does not support screen capture. Use a current desktop browser, or use an installed native app for mobile screen capture.');
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
          const peer = await createPeerConnection(userId);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          sendCallSignal(userId, { type: 'offer', description: offer });
        })
      );
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') setShareError(error.message || 'Unable to start screen sharing.');
    }
  }

  function stopShare() {
    peerConnectionsRef.current.forEach((_peer, userId) => sendCallSignal(userId, { type: 'hangup' }));
    localShareStreamRef.current?.getTracks().forEach((track) => track.stop());
    localShareStreamRef.current = null;
    setLocalShareStream(null);
    setShareActive(false);
    setRemoteStreams({});
    peerConnectionsRef.current.forEach((peer) => peer.close());
    peerConnectionsRef.current.clear();
    pendingIceRef.current.clear();
  }

  async function handleShareSignal(userId, data) {
    const peer = data.type === 'hangup' ? peerConnectionsRef.current.get(userId) : await createPeerConnection(userId);
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
      sendCallSignal(userId, { type: 'answer', description: answer });
    } else if (data.type === 'answer') {
      await peer.setRemoteDescription(data.description);
    } else if (data.type === 'ice') {
      if (peer.remoteDescription) await peer.addIceCandidate(data.candidate);
      else pendingIceRef.current.set(userId, [...(pendingIceRef.current.get(userId) || []), data.candidate]);
    } else if (data.type === 'hangup') {
      peer.close();
      peerConnectionsRef.current.delete(userId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  }

  async function handleCallSignal(evt) {
    const { from_user_id: userId, data } = evt;
    if (!userId || !data || !window.RTCPeerConnection) return;
    if (['offer', 'answer', 'ice'].includes(data.type)) {
      await handleShareSignal(userId, data);
      return;
    }

    if (data.type === 'call-offer') {
      setIncomingCall({ fromUserId: userId, kind: data.kind === 'video' ? 'video' : 'audio', description: data.description, username: userId });
      setCallDialogOpen(true);
      return;
    }

    if (data.type === 'call-answer') {
      const peer = callPeerConnectionsRef.current.get(userId);
      if (!peer) return;
      await peer.setRemoteDescription(data.description);
    } else if (data.type === 'call-ice') {
      const peer = callPeerConnectionsRef.current.get(userId);
      if (!peer) {
        callPendingIceRef.current.set(userId, [...(callPendingIceRef.current.get(userId) || []), data.candidate]);
        return;
      }
      if (peer.remoteDescription) await peer.addIceCandidate(data.candidate);
      else callPendingIceRef.current.set(userId, [...(callPendingIceRef.current.get(userId) || []), data.candidate]);
    } else if (data.type === 'call-hangup') {
      const peer = callPeerConnectionsRef.current.get(userId);
      if (!peer) return;
      peer.close();
      callPeerConnectionsRef.current.delete(userId);
      setRemoteCallStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      if (!callPeerConnectionsRef.current.size) stopCall(false);
    }
  }

  useEffect(() => () => {
    stopShare();
    stopCall(false);
  }, []);

  const statusText = useMemo(() => (me?.is_online ? 'Online now' : 'Offline'), [me]);
  const typingUsers = useMemo(() => Object.keys(typingByRoom[activeRoomId] || {}), [typingByRoom, activeRoomId]);

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
        <AuthPanel mode={mode} onModeChange={setMode} onSubmit={handleAuth} loading={loading} />
        {error && <p className="error-pill">{error}</p>}
      </div>
    );
  }

  const screenShareSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia && window.RTCPeerConnection);

  return (
    <>
      <ChatLayout
        me={me}
        rooms={rooms}
        activeRoomId={activeRoomId}
        messages={messages}
        onSelectRoom={setActiveRoomId}
        onSend={sendMessage}
        onSendMedia={sendMedia}
        mediaError={mediaError}
        onCreateRoom={createRoom}
        statusText={statusText}
        isAdmin={me.is_admin}
        pendingUsers={pendingUsers}
        onApprove={approveUser}
        onTyping={sendTyping}
        typingUsers={typingUsers}
        onReact={reactToMessage}
        onLogout={logout}
        onOpenAdmin={() => {
          setAdminOpen(true);
          loadAdminUsers();
        }}
        dataSaver={dataSaver}
        onToggleDataSaver={() => setDataSaver((value) => !value)}
        callActive={callActive}
        onStartCall={(kind) => {
          setCallError('');
          setCallDialogOpen(true);
          if (kind && !callActive) startCall(kind);
        }}
        shareActive={shareActive}
        onInvite={inviteUser}
        inviteStatus={inviteStatus}
        onShareScreen={() => {
          setShareError('');
          setShareDialogOpen(true);
        }}
      />
      <ScreenShareDialog
        open={shareDialogOpen}
        supported={screenShareSupported}
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
        onStart={startCall}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
        onHangup={() => {
          stopCall();
          setCallDialogOpen(false);
        }}
        onClose={() => setCallDialogOpen(false)}
      />
      <AdminPanel
        open={adminOpen}
        users={adminUsers}
        loading={adminLoading}
        error={adminError}
        onClose={() => setAdminOpen(false)}
        onRefresh={loadAdminUsers}
        onApprove={approveUser}
        onRemove={removeUser}
      />
    </>
  );
}
