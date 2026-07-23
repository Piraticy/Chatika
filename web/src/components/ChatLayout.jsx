import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APP_CREDIT, APP_VERSION } from '../lib/version';
import { CHATIKA_EMOJIS, findChatikaEmoji } from '../lib/emojis';
import { resolveMediaUrl } from '../lib/api';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '😎', '💬', '❤️', '😭', '🤝'];
const REACTION_EMOJIS = ['👍', '❤️', CHATIKA_EMOJIS[0].code, CHATIKA_EMOJIS[1].code];

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
  return user?.avatar_url
    ? <img className={`user-avatar-image ${size}`} src={resolveMediaUrl(user.avatar_url)} alt="" />
    : <span className={`user-avatar ${size}`} role="img" aria-label="Chatika avatar">{CHATIKA_EMOJIS[0].glyph}</span>;
}

export default function ChatLayout({
  me,
  rooms,
  activeRoomId,
  messages,
  readByMessage,
  onSelectRoom,
  onSend,
  onSendMedia,
  mediaError,
  onStartDirect,
  onCreateGroup,
  onChangeProfilePhoto,
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
  onShareScreen
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
  const recorderChunksRef = useRef([]);
  const recorderStreamRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (window.matchMedia('(max-width: 720px)').matches) return false;
    return localStorage.getItem('chatika_sidebar_visible') !== 'false';
  });
  const [actionMessageId, setActionMessageId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [localError, setLocalError] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
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
    if (!recording) return undefined;
    const timer = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 720px)').matches) {
      localStorage.setItem('chatika_sidebar_visible', String(sidebarOpen));
    }
  }, [sidebarOpen]);

  function selectConversation(roomId) {
    onSelectRoom(roomId);
    if (window.matchMedia('(max-width: 720px)').matches) setSidebarOpen(false);
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

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    setLocalError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setLocalError('Audio messages are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => event.data.size && recorderChunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        onSendMedia?.(new File([blob], `voice-message-${Date.now()}.webm`, { type: blob.type }), 'voice');
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setRecordingSeconds(0);
      };
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
    } catch (error) {
      setLocalError(error.message || 'Microphone permission was not granted.');
    }
  }

  function chooseReaction(messageId, emoji) {
    onReact?.(messageId, emoji);
    setActionMessageId(null);
  }

  function startReply(message) {
    setReplyingTo(message);
    setActionMessageId(null);
    window.setTimeout(() => composerRef.current?.querySelector('input[name="text"]')?.focus(), 0);
  }

  return (
    <div className={sidebarOpen ? 'chat-root' : 'chat-root sidebar-collapsed'}>
      <button className="mobile-menu-backdrop" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      <aside className={sidebarOpen ? 'sidebar glass open' : 'sidebar glass'}>
        <div className="sidebar-head">
          <button className="profile-button" type="button" onClick={() => profileInputRef.current?.click()} aria-label="Change profile picture"><Avatar user={me} size="large" /></button>
          <input ref={profileInputRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const [file] = event.target.files || []; if (file) onChangeProfilePhoto?.(file).catch((error) => setLocalError(error.message)); event.target.value = ''; }} />
          <div className="identity"><h2>@{me.username}</h2><small>{statusText}</small></div>
          <button className="icon-button sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><UiIcon name="close" /></button>
        </div>

        <section className="new-chat-section">
          <div className="sidebar-label"><span>NEW CHAT</span><button type="button" onClick={() => setGroupOpen((value) => !value)}>New group</button></div>
          <form onSubmit={submitDirect} className="direct-form"><input name="username" placeholder="Add @username" required /><button type="submit">Chat</button></form>
          {groupOpen && <form onSubmit={submitGroup} className="group-form"><input name="name" placeholder="Group name" required /><input name="usernames" placeholder="@friend1, @friend2" required /><button type="submit">Create group</button></form>}
        </section>

        <section className="friend-section">
          <div className="sidebar-label"><span>FRIENDS</span><span>{directRooms.length}</span></div>
          <div className="conversation-list">
            {directRooms.map((room) => <ConversationButton key={room.id} room={room} me={me} active={room.id === activeRoomId} onClick={() => selectConversation(room.id)} />)}
            {!directRooms.length && <p className="sidebar-empty">Add a username to begin a private chat.</p>}
          </div>
        </section>

        <section className="group-section">
          <div className="sidebar-label"><span>GROUPS</span><span>{groupRooms.length}</span></div>
          <div className="conversation-list">
            {groupRooms.map((room) => <ConversationButton key={room.id} room={room} me={me} active={room.id === activeRoomId} onClick={() => selectConversation(room.id)} />)}
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
        <div className="sidebar-foot"><span>{APP_CREDIT} · v{APP_VERSION}</span><button type="button" onClick={onLogout}>Log out</button></div>
      </aside>

      <main className="thread glass">
        <header className="thread-head">
          <div className="thread-title-wrap">
            <button className="icon-button menu-trigger" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-label={sidebarOpen ? 'Hide conversations' : 'Show conversations'} title={sidebarOpen ? 'Hide conversations' : 'Show conversations'}><UiIcon name="menu" /></button>
            {activeContact && <Avatar user={activeContact} size="thread" />}
            <div><span className="eyebrow">{activeRoom ? (activeRoom.is_group ? 'GROUP' : 'PRIVATE CHAT') : 'CHATIKA'}</span><h2>{activeRoom ? roomLabel(activeRoom, me.id) : 'Your conversations'}</h2><small>{activePresenceText}</small></div>
          </div>
          <div className="thread-actions">
            <button type="button" className={callActive ? 'call-button active' : 'call-button'} onClick={() => onStartCall?.('audio')} disabled={!activeRoomId} aria-label="Start audio call" title="Audio call"><UiIcon name="phone" /><span>Audio</span></button>
            <button type="button" className={callActive ? 'call-button active' : 'call-button'} onClick={() => onStartCall?.('video')} disabled={!activeRoomId} aria-label="Start video call" title="Video call"><UiIcon name="video" /><span>Video</span></button>
            <button type="button" className={shareActive ? 'share-button active' : 'share-button'} onClick={onShareScreen} disabled={!activeRoomId} aria-label="Share screen"><UiIcon name="screen" /><span>{shareActive ? 'Sharing' : 'Share screen'}</span></button>
          </div>
        </header>
        <section className="messages" ref={messagesRef} onScroll={saveReadingPosition}>
          {!orderedMessages.length && <div className="empty-chat"><h3>{activeRoom ? 'Say hello' : 'Start a conversation'}</h3><p>{activeRoom ? 'Messages, calls, and media stay together here.' : 'Add a friend by their Chatika username.'}</p></div>}
          {orderedMessages.map((message) => <MessageBubble key={message.id} message={message} me={me} read={Boolean(readByMessage?.[message.id])} actionOpen={actionMessageId === message.id} onToggle={() => setActionMessageId((value) => value === message.id ? null : message.id)} onReply={startReply} onReact={chooseReaction} />)}
          {typingText && <div className="typing-indicator">{typingText}</div>}
        </section>
        <div className="compose-area">
          {replyingTo && <div className="reply-preview"><span>↩ Replying to @{replyingTo.sender_id === me.id ? me.username : replyingTo.sender_username || 'friend'}</span><strong>{replyingTo.text || 'Shared media'}</strong><button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">×</button></div>}
          <form onSubmit={submitMessage} className="composer" ref={composerRef}>
            <button type="button" className="emoji-toggle" onClick={() => setEmojiOpen((value) => !value)} disabled={!activeRoomId} aria-label="Emoji"><UiIcon name="smile" /></button>
            <button type="button" className="composer-action" onClick={() => fileInputRef.current?.click()} disabled={!activeRoomId} aria-label="Attach"><UiIcon name="plus" /></button>
            <input ref={fileInputRef} className="file-input" type="file" accept="image/*,audio/*,video/*" onChange={handleFileChange} />
            <button type="button" className={recording ? 'composer-action recording' : 'composer-action'} onClick={toggleRecording} disabled={!activeRoomId} aria-label="Voice message"><UiIcon name={recording ? 'stop' : 'mic'} /></button>
            <input name="text" enterKeyHint="send" placeholder={activeRoomId ? 'Message' : 'Choose a conversation'} disabled={!activeRoomId} value={draft} onChange={(event) => { setDraft(event.target.value); onTyping?.(Boolean(event.target.value.trim())); }} onBlur={() => onTyping?.(false)} />
            <button type="submit" className="send-button" disabled={!activeRoomId}><span>Send</span><UiIcon name="send" /></button>
            {emojiOpen && <div className="emoji-picker"><strong className="emoji-picker-title">Chatika expressions</strong>{[...CHATIKA_EMOJIS.map((emoji) => emoji.code), ...QUICK_EMOJIS].map((emoji) => <button key={emoji} type="button" onClick={() => addEmoji(emoji)} aria-label={`Add ${findChatikaEmoji(emoji)?.label || emoji}`}>{findChatikaEmoji(emoji) ? <ChatikaEmoji emoji={findChatikaEmoji(emoji)} /> : emoji}</button>)}</div>}
          </form>
          {recording && <div className="recording-preview"><span className="recording-indicator" /><strong>Recording {formatDuration(recordingSeconds)}</strong><span className="recording-wave">▂▅▃▆▄▇▃▅▂</span><button type="button" onClick={toggleRecording}>Stop</button></div>}
          {(localError || mediaError) && <div className="composer-error">{localError || mediaError}</div>}
        </div>
      </main>
    </div>
  );
}

function ConversationButton({ room, me, active, onClick }) {
  const other = room.participants?.find((participant) => participant.id !== me.id);
  return <button className={active ? 'conversation-item active' : 'conversation-item'} onClick={onClick}><Avatar user={room.is_group ? { username: room.name } : other} /><span><strong>{roomLabel(room, me.id)}</strong><small>{room.is_group ? `${room.participants?.length || 0} members` : other?.is_online ? 'Online now' : formatLastSeen(other?.last_seen_at)}</small></span></button>;
}

function MessageBubble({ message, me, read, actionOpen, onToggle, onReply, onReact }) {
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
      onToggle();
    }, 450);
  }
  return <article className={message.sender_id === me.id ? 'msg mine' : 'msg'} onPointerDown={beginHold} onPointerUp={clearHold} onPointerCancel={clearHold} onContextMenu={(event) => { event.preventDefault(); if (!longPressedRef.current) onToggle(); }} onClick={(event) => { if (event.target.closest('button, a, audio, video')) return; if (longPressedRef.current) { longPressedRef.current = false; return; } onToggle(); }}>
    <span className="msg-sender">{message.sender_id === me.id ? 'You' : `@${message.sender_username || 'friend'}`}</span>
    {message.reply_to_id && <div className="reply-context"><span>↩ @{message.reply_to_sender_username || 'friend'}</span><small>{message.reply_to_text || 'Shared media'}</small></div>}
    {message.media_url && <MessageMedia message={message} />}
    {message.text && <p>{renderText(message.text, message.id)}</p>}
    {actionOpen && <div className="message-action-menu" onClick={(event) => event.stopPropagation()}><button type="button" className="reply-action" onClick={() => onReply(message)}>↩ Reply</button>{REACTION_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => onReact(message.id, emoji)}>{findChatikaEmoji(emoji) ? <ChatikaEmoji emoji={findChatikaEmoji(emoji)} /> : emoji}</button>)}</div>}
    {reactions.length > 0 && <div className="reaction-summary">{reactions.map(([emoji, users]) => <span key={emoji} className={users.includes(me.id) ? 'reaction-chip mine' : 'reaction-chip'}>{renderText(emoji, `${message.id}-${emoji}`)} {users.length}</span>)}</div>}
    <div className="message-meta"><time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{message.sender_id === me.id && <MessageStatus read={read} />}</div>
  </article>;
}

function MessageMedia({ message }) {
  const url = resolveMediaUrl(message.media_url);
  if (message.message_type === 'image') return <img className="message-image" src={url} alt={message.text || 'Shared image'} loading="lazy" />;
  if (message.message_type === 'video') return <video className="message-video" src={url} controls playsInline preload="metadata" />;
  if (message.message_type === 'audio' || message.message_type === 'voice') return <audio className="message-audio" src={url} controls preload="metadata" />;
  return <a className="message-file" href={url} target="_blank" rel="noreferrer">Open shared file</a>;
}

function MessageStatus({ read }) { return <span className={read ? 'message-status read' : 'message-status'}><i />{read && <i />}</span>; }
function formatDuration(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
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
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m4 12 16-8-5.8 16-3.1-6.8L4 12Zm7.1 1.2L20 4" /></svg>;
}
