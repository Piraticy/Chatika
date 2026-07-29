import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_CREDIT, APP_VERSION } from '../lib/version';
import ChatHub from './ChatHub';
import { CHATIKA_EMOJIS, findChatikaEmoji } from '../lib/emojis';
import { resolveMediaUrl } from '../lib/api';
import { avatarGradient, avatarInitial, AVATAR_PRESETS, presetFromAvatarUrl, presetGradient } from '../lib/avatar';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '😎', '💬', '❤️', '😭', '🤝'];
const REACTION_EMOJIS = ['👍', '❤️', CHATIKA_EMOJIS[0].code, CHATIKA_EMOJIS[1].code];
const VOICE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function formatLastSeen(value) {
  if (!value) return 'Last seen recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last seen recently';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  if (minutes < 1440) return `Last seen ${Math.floor(minutes / 60)}h ago`;
  return `Last seen ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function readingPositionKey(userId, roomId) {
  return `chatika_reading_position:${userId}:${roomId}`;
}

function roomLabel(room, userId) {
  if (room.is_group) return room.name;
  return room.participants?.find((participant) => participant.id !== userId)?.username || room.name;
}

function Avatar({ user, size = 'default' }) {
  const preset = presetFromAvatarUrl(user?.avatar_url);
  if (user?.avatar_url && !preset) return <img className={`user-avatar-image ${size}`} src={resolveMediaUrl(user.avatar_url)} alt="" />;
  if (preset) {
    return (
      <span className={`user-avatar ${size}`} style={presetGradient(preset)} role="img" aria-label="Chatika avatar">
        {preset.glyph}
      </span>
    );
  }
  return (
    <span className={`user-avatar ${size}`} style={avatarGradient(user?.id || user?.username)} role="img" aria-label="Chatika avatar">
      {avatarInitial(user?.username)}
    </span>
  );
}

export default function ChatLayout({
  me,
  rooms,
  activeRoomId,
  messages,
  readByMessage,
  deliveredByMessage,
  unreadCounts,
  onSelectRoom,
  onSend,
  onSendMedia,
  mediaError,
  onStartDirect,
  onDiscoverFriends,
  onCreateGroup,
  onChangeProfilePhoto,
  onChoosePresetAvatar,
  statusText,
  isAdmin,
  pendingUsers,
  onApprove,
  onTyping,
  typingUsers,
  onReact,
  onLogout,
  notificationStatus,
  onEnableNotifications,
  onOpenAdmin,
  dataSaver,
  onToggleDataSaver,
  callActive,
  onStartCall,
  shareActive,
  onShareScreen,
  statuses,
  onPostStatus,
  onDeleteStatus,
  onLoadCallHistory,
  onDeleteRoom,
  onDeleteMessage
}) {
  const activeRoom = rooms.find((room) => room.id === activeRoomId) || null;
  const activeOthers = useMemo(
    () => (activeRoom?.participants || []).filter((participant) => participant.id !== me.id),
    [activeRoom, me.id]
  );
  const activeContact = activeOthers[0];
  const activePresenceText = activeRoom?.is_group
    ? `${activeOthers.filter((participant) => participant.is_online).length} online · ${activeOthers.length} members`
    : activeContact
      ? (activeContact.is_online ? 'Online now' : formatLastSeen(activeContact.last_seen_at))
      : 'Private Chatika chat';
  const directRooms = rooms.filter((room) => !room.is_group);
  const groupRooms = rooms.filter((room) => room.is_group);
  const messagesRef = useRef(null);
  const restoredPositionsRef = useRef(new Set());
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const profileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const edgeSwipeRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const recorderStreamRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const recordingSecondsRef = useRef(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const waveformRafRef = useRef(null);
  const previewClipRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (window.matchMedia('(max-width: 720px)').matches) return false;
    return localStorage.getItem('chatika_sidebar_visible') !== 'false';
  });
  const [actionMessageId, setActionMessageId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  // 'idle' -> 'recording' (live mic + waveform) -> 'preview' (listen back,
  // then explicitly discard or send) -> back to 'idle'. Recording never
  // auto-sends - see startRecording/stopRecording/sendPreviewClip below.
  const [recordingPhase, setRecordingPhase] = useState('idle');
  const [previewClip, setPreviewClip] = useState(null);
  const [waveLevels, setWaveLevels] = useState(() => Array(24).fill(0.08));
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [localError, setLocalError] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarPickerError, setAvatarPickerError] = useState('');
  const [discoverScope, setDiscoverScope] = useState('online');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const typingText = typingUsers?.length ? (typingUsers.length === 1 ? 'Typing…' : `${typingUsers.length} people are typing…`) : '';

  useEffect(() => {
    if (!messagesRef.current || !activeRoomId) return;
    const key = readingPositionKey(me.id, activeRoomId);
    if (restoredPositionsRef.current.has(key)) return;
    const saved = localStorage.getItem(key);
    const position = saved === null ? Number.NaN : Number(saved);
    messagesRef.current.scrollTop = Number.isFinite(position) ? position : messagesRef.current.scrollHeight;
    restoredPositionsRef.current.add(key);
  }, [orderedMessages, activeRoomId, me.id]);

  useEffect(() => {
    if (recordingPhase !== 'recording') return undefined;
    const timer = window.setInterval(() => {
      setRecordingSeconds((value) => {
        const next = value + 1;
        recordingSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recordingPhase]);

  useEffect(() => () => {
    recordingCancelledRef.current = true;
    recorderRef.current?.stop();
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    stopWaveform();
    if (previewClipRef.current?.url) URL.revokeObjectURL(previewClipRef.current.url);
  }, []);

  useEffect(() => { previewClipRef.current = previewClip; }, [previewClip]);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 720px)').matches) {
      localStorage.setItem('chatika_sidebar_visible', String(sidebarOpen));
    }
  }, [sidebarOpen]);

  function selectConversation(roomId) {
    onSelectRoom(roomId);
    if (window.matchMedia('(max-width: 720px)').matches) setSidebarOpen(false);
  }

  function beginThreadEdgeSwipe(event) {
    if (!activeRoom || !window.matchMedia('(max-width: 720px)').matches || event.clientX > 28) return;
    edgeSwipeRef.current = { x: event.clientX, y: event.clientY };
  }

  function endThreadEdgeSwipe(event) {
    const start = edgeSwipeRef.current;
    edgeSwipeRef.current = null;
    if (!start) return;
    if (event.clientX - start.x > 84 && Math.abs(event.clientY - start.y) < 70) {
      onSelectRoom('');
    }
  }

  async function submitDirect(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const username = String(new FormData(formElement).get('username') || '').trim();
    if (!username) return;
    setLocalError('');
    try {
      await onStartDirect(username);
      formElement.reset();
      setSidebarOpen(false);
    } catch (error) {
      setLocalError(error.message || 'Could not start this chat.');
    }
  }

  async function submitGroup(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get('name') || '').trim();
    const usernames = String(form.get('usernames') || '').split(',').map((value) => value.trim()).filter(Boolean);
    if (!name || !usernames.length) return;
    setLocalError('');
    try {
      await onCreateGroup(name, usernames);
      formElement.reset();
      setGroupOpen(false);
      setSidebarOpen(false);
    } catch (error) {
      setLocalError(error.message || 'Could not create this group.');
    }
  }

  async function discoverFriends(scope = discoverScope) {
    setDiscoverLoading(true);
    setLocalError('');
    setDiscoverScope(scope);
    try {
      setDiscoverUsers(await onDiscoverFriends?.(discoverQuery.trim(), scope) || []);
    } catch (error) {
      setLocalError(error.message || 'Could not find Chatika users.');
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function chatWithDiscoveredUser(username) {
    setLocalError('');
    try {
      await onStartDirect(username);
      setDiscoverUsers((users) => users.filter((user) => user.username !== username));
      if (window.matchMedia('(max-width: 720px)').matches) setSidebarOpen(false);
    } catch (error) {
      setLocalError(error.message || 'Could not start this chat.');
    }
  }

  function submitMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeRoomId) return;
    onSend(text, replyingTo);
    onTyping?.(false);
    setDraft('');
    setEmojiOpen(false);
    setReplyingTo(null);
  }

  function saveReadingPosition(event) {
    if (activeRoomId) localStorage.setItem(readingPositionKey(me.id, activeRoomId), String(event.currentTarget.scrollTop));
  }

  function addEmoji(emoji) {
    const next = `${draft}${emoji}`;
    setDraft(next);
    onTyping?.(Boolean(next.trim()));
  }

  function handleFileChange(event) {
    const [file] = event.target.files || [];
    if (file && activeRoomId) onSendMedia?.(file);
    event.target.value = '';
  }

  function stopWaveform() {
    if (waveformRafRef.current) cancelAnimationFrame(waveformRafRef.current);
    waveformRafRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }

  // Live amplitude visualizer (Botim/WhatsApp-style bars) - reads the same
  // mic stream MediaRecorder is capturing, so it costs nothing extra to
  // request. Purely cosmetic: if the browser can't build an AnalyserNode,
  // recording still works fine without the animation.
  function startWaveform(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      setWaveLevels(Array(24).fill(0.08));
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i += 1) {
          const normalized = (data[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        const level = Math.max(0.08, Math.min(1, rms * 4));
        setWaveLevels((prev) => [...prev.slice(1), level]);
        waveformRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_error) {
      // Visualizer is cosmetic - silently skip it.
    }
  }

  async function startRecording() {
    if (recordingPhase !== 'idle') return;
    setLocalError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setLocalError('Audio messages are not supported in this browser.');
      return;
    }
    try {
      const permission = await navigator.permissions?.query?.({ name: 'microphone' }).catch(() => null);
      if (permission?.state === 'denied') {
        setLocalError('Microphone access is blocked. Enable it in your browser settings to record a voice message.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const requestedMimeType = VOICE_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType));
      const recorder = requestedMimeType ? new MediaRecorder(stream, { mimeType: requestedMimeType }) : new MediaRecorder(stream);
      const roomId = activeRoomId;
      recorderChunksRef.current = [];
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      recordingCancelledRef.current = false;
      recorder.ondataavailable = (event) => event.data.size && recorderChunksRef.current.push(event.data);
      recorder.onstop = () => {
        stopWaveform();
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        recorderRef.current = null;
        if (recordingCancelledRef.current) {
          setPreviewClip(null);
          setRecordingPhase('idle');
          setRecordingSeconds(0);
          return;
        }
        // Recording stops here, but nothing is sent yet - the user reviews
        // the clip in the preview bar and explicitly discards or sends it.
        const mimeType = recorder.mimeType || requestedMimeType || 'audio/webm';
        const blob = new Blob(recorderChunksRef.current, { type: mimeType });
        const extension = voiceFileExtension(blob.type || mimeType);
        const file = new File([blob], `voice-message-${Date.now()}.${extension}`, { type: blob.type || mimeType });
        setPreviewClip({ url: URL.createObjectURL(blob), file, roomId, seconds: recordingSecondsRef.current });
        setRecordingPhase('preview');
      };
      recorder.start();
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setRecordingPhase('recording');
      startWaveform(stream);
    } catch (error) {
      setLocalError(error.message || 'Microphone permission was not granted.');
    }
  }

  function stopRecording() {
    recordingCancelledRef.current = false;
    recorderRef.current?.stop();
  }

  function cancelRecording() {
    recordingCancelledRef.current = true;
    recorderRef.current?.stop();
  }

  function sendPreviewClip() {
    if (!previewClip) return;
    onSendMedia?.(previewClip.file, 'voice', previewClip.roomId);
    URL.revokeObjectURL(previewClip.url);
    setPreviewClip(null);
    setRecordingPhase('idle');
    setRecordingSeconds(0);
  }

  function discardPreviewClip() {
    if (previewClip) URL.revokeObjectURL(previewClip.url);
    setPreviewClip(null);
    setRecordingPhase('idle');
    setRecordingSeconds(0);
  }

  const chooseReaction = useCallback((messageId, emoji) => {
    onReact?.(messageId, emoji);
    setActionMessageId(null);
  }, [onReact]);

  const startReply = useCallback((message) => {
    setReplyingTo(message);
    setActionMessageId(null);
    window.setTimeout(() => composerRef.current?.querySelector('input[name="text"]')?.focus(), 0);
  }, []);

  const deleteMessage = useCallback(async (messageId) => {
    setActionMessageId(null);
    if (!window.confirm('Delete this message for you?')) return;
    try {
      await onDeleteMessage?.(messageId);
    } catch (error) {
      setLocalError(error.message || 'Could not delete this message.');
    }
  }, [onDeleteMessage]);

  const toggleAction = useCallback((messageId) => {
    setActionMessageId((value) => (value === messageId ? null : messageId));
  }, []);

  return (
    <div className={sidebarOpen ? 'chat-root' : 'chat-root sidebar-collapsed'}>
      <button className="mobile-menu-backdrop" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      <aside className={sidebarOpen ? 'sidebar glass open' : 'sidebar glass'}>
        <div className="sidebar-head">
          <button className="profile-button" type="button" onClick={() => { setAvatarPickerError(''); setAvatarPickerOpen(true); }} aria-label="Change profile picture"><Avatar user={me} size="large" /></button>
          <input ref={profileInputRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const [file] = event.target.files || []; if (file) onChangeProfilePhoto?.(file).catch((error) => setLocalError(error.message)); event.target.value = ''; }} />
          <div className="identity"><h2>@{me.username}</h2>{isAdmin && <span className="profile-admin-badge">Chatika admin</span>}<small>{statusText}</small></div>
          <button className="icon-button sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><UiIcon name="close" /></button>
        </div>

        <section className="new-chat-section">
          <div className="sidebar-label"><span>NEW CHAT</span><button type="button" onClick={() => setGroupOpen((value) => !value)}>New group</button></div>
          <form onSubmit={submitDirect} className="direct-form"><input name="username" placeholder="Add @username" required /><button type="submit">Chat</button></form>
          <div className="discovery-controls">
            <input value={discoverQuery} onChange={(event) => setDiscoverQuery(event.target.value)} placeholder="Search people" aria-label="Search Chatika users" />
            <div>
              <button className={discoverScope === 'online' ? 'active' : ''} type="button" onClick={() => discoverFriends('online')}>Online</button>
              <button className={discoverScope === 'nearby' ? 'active' : ''} type="button" onClick={() => discoverFriends('nearby')}>Nearby</button>
              <button type="button" onClick={() => discoverFriends(discoverScope)} aria-label="Refresh people">↻</button>
            </div>
          </div>
          {discoverLoading && <p className="sidebar-empty">Finding people…</p>}
          {!discoverLoading && discoverUsers.length > 0 && <div className="discovery-list">
            {discoverUsers.map((user) => <button key={user.id} type="button" className="discovery-user" onClick={() => chatWithDiscoveredUser(user.username)}><Avatar user={user} /><span><strong>@{user.username}</strong><small>{user.is_online ? 'Online now' : user.is_nearby ? 'Nearby · ' + formatLastSeen(user.last_seen_at) : formatLastSeen(user.last_seen_at)}</small></span><b>Chat</b></button>)}
          </div>}
          {groupOpen && <form onSubmit={submitGroup} className="group-form"><input name="name" placeholder="Group name" required /><input name="usernames" placeholder="@friend1, @friend2" required /><button type="submit">Create group</button></form>}
        </section>

        <section className="friend-section">
          <div className="sidebar-label"><span>FRIENDS</span><span>{directRooms.length}</span></div>
          <div className="conversation-list">
            {directRooms.map((room) => <ConversationButton key={room.id} room={room} me={me} active={room.id === activeRoomId} unread={unreadCounts?.[room.id] || 0} onClick={() => selectConversation(room.id)} />)}
            {!directRooms.length && <p className="sidebar-empty">Add a username to begin a private chat.</p>}
          </div>
        </section>

        <section className="group-section">
          <div className="sidebar-label"><span>GROUPS</span><span>{groupRooms.length}</span></div>
          <div className="conversation-list">
            {groupRooms.map((room) => <ConversationButton key={room.id} room={room} me={me} active={room.id === activeRoomId} unread={unreadCounts?.[room.id] || 0} onClick={() => selectConversation(room.id)} />)}
          </div>
        </section>

        <section className="system-section">
          <div className="sidebar-label"><span>SYSTEM</span></div>
          {notificationStatus === 'idle' && <button className="system-action" type="button" onClick={onEnableNotifications}><span>⌁</span> Enable notifications</button>}
          {notificationStatus === 'on' && <span className="system-status good">● Notifications enabled</span>}
          {notificationStatus === 'denied' && <span className="system-status">Notifications are blocked in this browser.</span>}
          {notificationStatus === 'unavailable' && <span className="system-status">Notifications are unavailable here.</span>}
          <button className="system-action" type="button" onClick={onToggleDataSaver}><span>{dataSaver ? '◒' : '◓'}</span> {dataSaver ? 'Data saver on' : 'High quality mode'}</button>
        </section>

        {isAdmin && <section className="admin-box"><div className="sidebar-label"><span>ADMIN</span><span>{pendingUsers.length}</span></div>{pendingUsers.map((user) => <div className="pending-user" key={user.id}><span>@{user.username}</span><button onClick={() => onApprove(user.id)}>Approve</button></div>)}<button className="admin-open-button" type="button" onClick={onOpenAdmin}>Open admin control</button></section>}
        {localError && <p className="sidebar-error">{localError}</p>}
        <div className="sidebar-foot"><span>{APP_CREDIT} · {APP_VERSION}</span><button type="button" onClick={onLogout}>Log out</button></div>
      </aside>

      <main className={activeRoom ? 'thread glass' : 'thread glass hub-thread'} onPointerDown={beginThreadEdgeSwipe} onPointerUp={endThreadEdgeSwipe} onPointerCancel={() => { edgeSwipeRef.current = null; }}>
        {!activeRoom ? (
          <ChatHub
            me={me}
            rooms={rooms}
            unreadCounts={unreadCounts}
            statuses={statuses}
            onSelectRoom={selectConversation}
            onStartDirect={onStartDirect}
            onDiscoverFriends={onDiscoverFriends}
            onCreateGroup={onCreateGroup}
            onPostStatus={onPostStatus}
            onDeleteStatus={onDeleteStatus}
            onLoadCallHistory={onLoadCallHistory}
            onDeleteRoom={onDeleteRoom}
            onDeleteMessage={onDeleteMessage}
            onStartCall={onStartCall}
            onOpenSidebar={() => setSidebarOpen(true)}
            notificationStatus={notificationStatus}
            onEnableNotifications={onEnableNotifications}
            dataSaver={dataSaver}
            onToggleDataSaver={onToggleDataSaver}
            onLogout={onLogout}
            onOpenAdmin={onOpenAdmin}
            isAdmin={isAdmin}
          />
        ) : <>
        <header className="thread-head">
          <div className="thread-title-wrap">
            <button
              className="icon-button back-trigger"
              type="button"
              onClick={() => {
                if (window.matchMedia('(max-width: 720px)').matches) onSelectRoom('');
                else setSidebarOpen((value) => !value);
              }}
              aria-label={window.matchMedia('(max-width: 720px)').matches ? 'Back to conversations' : (sidebarOpen ? 'Hide conversations' : 'Show conversations')}
              title={window.matchMedia('(max-width: 720px)').matches ? 'Back to conversations' : (sidebarOpen ? 'Hide conversations' : 'Show conversations')}
            >
              <UiIcon name={window.matchMedia('(max-width: 720px)').matches ? 'back' : 'menu'} />
            </button>
            {activeContact && <Avatar user={activeContact} size="thread" />}
            <div><h2>{activeRoom ? roomLabel(activeRoom, me.id) : 'Your conversations'}{activeContact?.is_admin && <span className="conversation-admin-badge">Admin</span>}</h2><small>{activePresenceText}</small></div>
          </div>
          <div className="thread-actions">
            <button type="button" className={callActive ? 'call-button active' : 'call-button'} onClick={() => onStartCall?.('audio')} disabled={!activeRoomId} aria-label="Start audio call" title="Audio call"><UiIcon name="phone" /><span>Audio</span></button>
            <button type="button" className={callActive ? 'call-button active' : 'call-button'} onClick={() => onStartCall?.('video')} disabled={!activeRoomId} aria-label="Start video call" title="Video call"><UiIcon name="video" /><span>Video</span></button>
            <button type="button" className={shareActive ? 'share-button active' : 'share-button'} onClick={onShareScreen} disabled={!activeRoomId} aria-label="Share screen"><UiIcon name="screen" /><span>{shareActive ? 'Sharing' : 'Share screen'}</span></button>
          </div>
        </header>
        <section className="messages" ref={messagesRef} onScroll={saveReadingPosition}>
          {!orderedMessages.length && <div className="empty-chat"><h3>{activeRoom ? 'Say hello' : 'Start a conversation'}</h3><p>{activeRoom ? 'Messages, calls, and media stay together here.' : 'Add a friend by their Chatika username.'}</p></div>}
          {orderedMessages.map((message) => <MessageBubble key={message.id} message={message} me={me} read={Boolean(readByMessage?.[message.id])} delivered={Boolean(deliveredByMessage?.[message.id])} actionOpen={actionMessageId === message.id} onToggle={toggleAction} onReply={startReply} onReact={chooseReaction} onDelete={deleteMessage} />)}
          {typingText && <div className="typing-indicator">{typingText}</div>}
        </section>
        <div className="compose-area">
          {replyingTo && recordingPhase === 'idle' && <div className="reply-preview"><span>↩ Replying to @{replyingTo.sender_id === me.id ? me.username : replyingTo.sender_username || 'friend'}</span><strong>{replyingTo.text || 'Shared media'}</strong><button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">×</button></div>}

          {recordingPhase === 'idle' && (
            <form onSubmit={submitMessage} className="composer" ref={composerRef}>
              <button type="button" className="emoji-toggle" onClick={() => setEmojiOpen((value) => !value)} disabled={!activeRoomId} aria-label="Emoji"><UiIcon name="smile" /></button>
              <button type="button" className="composer-action" onClick={() => fileInputRef.current?.click()} disabled={!activeRoomId} aria-label="Attach"><UiIcon name="plus" /></button>
              <input ref={fileInputRef} className="file-input" type="file" accept="image/*,audio/*,video/*" onChange={handleFileChange} />
              <button type="button" className="composer-action" onClick={startRecording} disabled={!activeRoomId} aria-label="Record a voice message"><UiIcon name="mic" /></button>
              <input name="text" enterKeyHint="send" placeholder={activeRoomId ? 'Message' : 'Choose a conversation'} disabled={!activeRoomId} value={draft} onChange={(event) => { setDraft(event.target.value); onTyping?.(Boolean(event.target.value.trim())); }} onBlur={() => onTyping?.(false)} />
              <button type="submit" className="send-button" disabled={!activeRoomId}><span>Send</span><UiIcon name="send" /></button>
              {emojiOpen && <div className="emoji-picker"><strong className="emoji-picker-title">Chatika expressions</strong>{[...CHATIKA_EMOJIS.map((emoji) => emoji.code), ...QUICK_EMOJIS].map((emoji) => <button key={emoji} type="button" onClick={() => addEmoji(emoji)} aria-label={`Add ${findChatikaEmoji(emoji)?.label || emoji}`}>{findChatikaEmoji(emoji) ? <ChatikaEmoji emoji={findChatikaEmoji(emoji)} /> : emoji}</button>)}</div>}
            </form>
          )}

          {recordingPhase === 'recording' && (
            <div className="recording-bar">
              <button type="button" className="recording-icon-button cancel" onClick={cancelRecording} aria-label="Cancel recording"><UiIcon name="trash" /></button>
              <span className="recording-live-dot" aria-hidden="true" />
              <div className="recording-wave-live" aria-hidden="true">{waveLevels.map((level, index) => <i key={index} style={{ height: `${6 + level * 26}px` }} />)}</div>
              <strong className="recording-timer">{formatDuration(recordingSeconds)}</strong>
              <span className="recording-lock" aria-hidden="true" title="Hands-free recording"><UiIcon name="lock" /></span>
              <button type="button" className="recording-icon-button confirm" onClick={stopRecording} aria-label="Finish recording"><UiIcon name="check" /></button>
            </div>
          )}

          {recordingPhase === 'preview' && previewClip && (
            <div className="recording-bar preview">
              <button type="button" className="recording-icon-button cancel" onClick={discardPreviewClip} aria-label="Discard recording"><UiIcon name="trash" /></button>
              <VoiceMessage url={previewClip.url} />
              <button type="button" className="recording-icon-button confirm" onClick={sendPreviewClip} aria-label="Send voice message"><UiIcon name="send" /></button>
            </div>
          )}

          {(localError || mediaError) && <div className="composer-error">{localError || mediaError}</div>}
        </div>
        </>}
      </main>

      {avatarPickerOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAvatarPickerOpen(false)}>
          <section className="avatar-picker-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title">
            <header>
              <h2 id="avatar-picker-title">Choose your avatar</h2>
              <button className="icon-button" type="button" onClick={() => setAvatarPickerOpen(false)} aria-label="Close">×</button>
            </header>
            <button type="button" className="avatar-picker-upload" onClick={() => { setAvatarPickerOpen(false); profileInputRef.current?.click(); }}>
              <UiIcon name="plus" /> Upload your own photo
            </button>
            {avatarPickerError && <p className="sidebar-error">{avatarPickerError}</p>}
            <div className="avatar-picker-grid">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="avatar-picker-option"
                  style={presetGradient(preset)}
                  aria-label={`Use this avatar`}
                  onClick={async () => {
                    try {
                      await onChoosePresetAvatar?.(preset.id);
                      setAvatarPickerOpen(false);
                    } catch (error) {
                      setAvatarPickerError(error.message || 'Could not set this avatar.');
                    }
                  }}
                >
                  {preset.glyph}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ConversationButton({ room, me, active, unread, onClick }) {
  const other = room.participants?.find((participant) => participant.id !== me.id);
  return (
    <button className={active ? 'conversation-item active' : 'conversation-item'} onClick={onClick}>
      <Avatar user={room.is_group ? { username: room.name } : other} />
      <span className="conversation-item-body">
        <span className="conversation-item-top">
          <strong>{roomLabel(room, me.id)}{other?.is_admin && <span className="conversation-admin-badge">Admin</span>}</strong>
          {room.last_message_at && <time>{formatRelativeTime(room.last_message_at)}</time>}
        </span>
        <span className="conversation-item-bottom">
          <small className={unread ? 'conversation-preview unread' : 'conversation-preview'}>{formatRoomPreview(room, me.id)}</small>
          {unread > 0 && <b className="unread-badge">{unread > 99 ? '99+' : unread}</b>}
        </span>
      </span>
    </button>
  );
}

function formatRoomPreview(room, myId) {
  if (!room.last_message_type) {
    if (room.is_group) return `${room.participants?.length || 0} members`;
    const other = room.participants?.find((participant) => participant.id !== myId);
    return other?.is_online ? 'Online now' : formatLastSeen(other?.last_seen_at);
  }
  if (room.last_message_type === 'call_log') {
    try {
      const call = JSON.parse(room.last_message_text || '{}');
      const kind = call.kind === 'video' ? 'Video' : 'Audio';
      if (call.outcome !== 'completed') return `Missed ${kind.toLowerCase()} call`;
      return `${kind} call · ${formatDuration(call.duration_seconds || 0)}`;
    } catch (_error) {
      return 'Call';
    }
  }
  const prefix = room.last_message_sender_id === myId ? 'You: ' : '';
  if (room.last_message_type === 'image') return `${prefix}📷 Photo`;
  if (room.last_message_type === 'video') return `${prefix}🎥 Video`;
  if (room.last_message_type === 'voice') return `${prefix}🎤 Voice message`;
  if (room.last_message_type === 'audio') return `${prefix}🎵 Audio`;
  if (room.last_message_type === 'file') return `${prefix}📎 File`;
  return `${prefix}${room.last_message_text || ''}`;
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const MessageBubble = React.memo(function MessageBubble({ message, me, read, delivered, actionOpen, onToggle, onReply, onReact, onDelete }) {
  if (message.message_type === 'call_log') return <CallLogNotice message={message} mine={message.sender_id === me.id} />;

  const reactions = Object.entries(message.reaction_users || {}).filter(([, users]) => users?.length);
  const holdTimerRef = useRef(null);
  const longPressedRef = useRef(false);
  function clearHold() {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }
  function beginHold(event) {
    if (event.target.closest('button, a, audio, video')) return;
    longPressedRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      onToggle(message.id);
    }, 450);
  }
  return <article className={message.sender_id === me.id ? 'msg mine' : 'msg'} onPointerDown={beginHold} onPointerUp={clearHold} onPointerCancel={clearHold} onContextMenu={(event) => { event.preventDefault(); if (!longPressedRef.current) onToggle(message.id); }} onClick={(event) => { if (event.target.closest('button, a, audio, video')) return; if (longPressedRef.current) { longPressedRef.current = false; return; } onToggle(message.id); }}>
    <span className="msg-sender">{message.sender_id === me.id ? 'You' : `@${message.sender_username || 'friend'}`}</span>
    {message.reply_to_id && <div className="reply-context"><span>↩ @{message.reply_to_sender_username || 'friend'}</span><small>{message.reply_to_text || 'Shared media'}</small></div>}
    {message.media_url && <MessageMedia message={message} />}
    {message.text && message.message_type !== 'voice' && <p>{renderText(message.text, message.id)}</p>}
    {actionOpen && <div className="message-action-menu" onClick={(event) => event.stopPropagation()}><button type="button" className="reply-action" onClick={() => onReply(message)}>↩ Reply</button>{REACTION_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => onReact(message.id, emoji)}>{findChatikaEmoji(emoji) ? <ChatikaEmoji emoji={findChatikaEmoji(emoji)} /> : emoji}</button>)}<button type="button" className="delete-action" onClick={() => onDelete(message.id)}>🗑 Delete</button></div>}
    {reactions.length > 0 && <div className="reaction-summary">{reactions.map(([emoji, users]) => <span key={emoji} className={users.includes(me.id) ? 'reaction-chip mine' : 'reaction-chip'}>{renderText(emoji, `${message.id}-${emoji}`)} {users.length}</span>)}</div>}
    <div className="message-meta"><time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{message.sender_id === me.id && <MessageStatus read={read} delivered={delivered} />}</div>
  </article>;
});

function CallLogNotice({ message, mine }) {
  let call = null;
  try {
    call = JSON.parse(message.text || '{}');
  } catch (_error) {
    call = null;
  }
  const kind = call?.kind === 'video' ? 'Video' : 'Audio';
  const missed = call?.outcome !== 'completed';
  const label = missed ? `Missed ${kind.toLowerCase()} call` : `${kind} call · ${formatDuration(call?.duration_seconds || 0)}`;
  return (
    <div className="call-log-row">
      <span className={missed ? 'call-log-chip missed' : 'call-log-chip'}>
        <CallLogIcon kind={kind} missed={missed} />
        {mine ? label : `${label} from @${message.sender_username || 'friend'}`}
        <time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
      </span>
    </div>
  );
}

function CallLogIcon({ kind, missed }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'Video') return <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect {...common} x="3" y="6" width="12" height="12" rx="3" /><path {...common} d="m15 10 5-3v10l-5-3" />{missed && <path {...common} d="M4 4 20 20" />}</svg>;
  return <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path {...common} d="M7 4 9.4 8.5l-2 2.1a15 15 0 0 0 6 6l2.1-2L20 17l-.8 3a2 2 0 0 1-2 1.4A16.4 16.4 0 0 1 2.6 6.8 2 2 0 0 1 4 4.8L7 4Z" />{missed && <path {...common} d="M4 4 20 20" />}</svg>;
}

function MessageMedia({ message }) {
  const url = resolveMediaUrl(message.media_url);
  if (message.message_type === 'image') return <img className="message-image" src={url} alt={message.text || 'Shared image'} loading="lazy" />;
  if (message.message_type === 'video') return <video className="message-video" src={url} controls playsInline preload="metadata" />;
  if (message.message_type === 'voice') return <VoiceMessage url={voicePlaybackUrl(url)} uploading={message.status === 'uploading'} />;
  if (message.message_type === 'audio') return <audio className="message-audio" src={url} controls preload="metadata" />;
  return <a className="message-file" href={url} target="_blank" rel="noreferrer">Open shared file</a>;
}

function voicePlaybackUrl(url) {
  if (!url || /^(?:blob|data):/i.test(url) || /[?&]mime_type=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}mime_type=audio%2Fwebm`;
}

function VoiceMessage({ url, uploading = false }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);

  async function togglePlayback() {
    if (uploading) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch (_error) {
        setError(true);
      }
    } else {
      audio.pause();
    }
  }

  return (
    <div className="voice-message" aria-label="Voice message">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onError={() => setError(true)}
      />
      <button type="button" className="voice-play-button" onClick={togglePlayback} disabled={uploading} aria-label={uploading ? 'Sending voice message' : playing ? 'Pause voice message' : 'Play voice message'}>{uploading ? '…' : playing ? '❚❚' : '▶'}</button>
      <span className="voice-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
      <span className="voice-duration">{uploading ? 'Sending' : formatDuration(Math.floor(playing ? currentTime : duration || currentTime))}</span>
      {error && <a href={url} target="_blank" rel="noreferrer" className="voice-open-link">Open</a>}
    </div>
  );
}

function MessageStatus({ read, delivered }) {
  const showSecondDot = read || delivered;
  return <span className={read ? 'message-status read' : 'message-status'}><i />{showSecondDot && <i />}</span>;
}
function voiceFileExtension(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}
function formatDuration(seconds) {
  const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(Math.floor(safeSeconds % 60)).padStart(2, '0')}`;
}
function renderText(text, keyPrefix) { return String(text || '').split(/(:chatika_[a-z]+:)/g).map((part, index) => { const emoji = findChatikaEmoji(part); return emoji ? <ChatikaEmoji key={`${keyPrefix}-${index}`} emoji={emoji} /> : part; }); }
function ChatikaEmoji({ emoji }) { return <span className={`chatika-emoji ${emoji.variant}`} role="img" aria-label={emoji.label}>{emoji.glyph}</span>; }

function UiIcon({ name }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'phone') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7.1 3.8 9.3 8l-2 2.2a16 16 0 0 0 6.5 6.5l2.2-2 4.2 2.2-.8 3.2c-.2.8-.9 1.3-1.7 1.3C9.4 20.9 3.1 14.6 2.6 6.3c0-.8.5-1.5 1.3-1.7l3.2-.8Z" /></svg>;
  if (name === 'video') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="3" y="6" width="12" height="12" rx="3" /><path {...common} d="m15 10 5-3v10l-5-3" /></svg>;
  if (name === 'screen') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="3" y="4" width="18" height="13" rx="2" /><path {...common} d="M8 21h8M12 17v4" /></svg>;
  if (name === 'menu') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 7h16M4 12h16M4 17h16" /></svg>;
  if (name === 'close') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === 'smile') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></svg>;
  if (name === 'plus') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 5v14M5 12h14" /></svg>;
  if (name === 'mic') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="9" y="3" width="6" height="12" rx="3" /><path {...common} d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></svg>;
  if (name === 'stop') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>;
  if (name === 'back') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M19 12H5M11 18l-6-6 6-6" /></svg>;
  if (name === 'trash') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 7h16M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7m-9 0 .8 12.2c0 .9.8 1.6 1.7 1.6h5c.9 0 1.7-.7 1.7-1.6L18 7" /><path {...common} d="M10 11v6M14 11v6" /></svg>;
  if (name === 'check') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m5 13 4 4 10-10" /></svg>;
  if (name === 'lock') return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="5" y="11" width="14" height="9" rx="2" /><path {...common} d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m4 12 16-8-5.8 16-3.1-6.8L4 12Zm7.1 1.2L20 4" /></svg>;
}
