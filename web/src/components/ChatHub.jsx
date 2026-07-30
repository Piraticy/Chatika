import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveMediaUrl } from '../lib/api';
import { avatarGradient, avatarInitial, presetFromAvatarUrl, presetGradient } from '../lib/avatar';
import { CHAT_BACKGROUNDS } from '../lib/chatBackground';

function HubIcon({ name, size = 20, filled = false }) {
  const box = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true };
  const stroke = { ...box, fill: 'none', stroke: 'currentColor', strokeWidth: filled ? 2.3 : 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'chats') {
    if (filled) return <svg {...box} fill="currentColor" stroke="none"><path d="M21 11.5a8 8 0 0 1-8.5 8 8.9 8.9 0 0 1-3.7-.9L3 20l1.6-4.1A8 8 0 1 1 21 11.5Z" /><circle cx="8" cy="11" r="1.15" fill="#08111f" /><circle cx="12" cy="11" r="1.15" fill="#08111f" /><circle cx="16" cy="11" r="1.15" fill="#08111f" /></svg>;
    return <svg {...stroke}><path d="M21 11.5a8 8 0 0 1-8.5 8 8.9 8.9 0 0 1-3.7-.9L3 20l1.6-4.1A8 8 0 1 1 21 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></svg>;
  }
  if (name === 'friends') return <svg {...stroke}><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.8-3.3 2.7-5 5.5-5s4.7 1.7 5.5 5M17 10h4M19 8v4" /></svg>;
  if (name === 'calls') {
    if (filled) return <svg {...box} fill="currentColor" stroke="none"><path d="M6.6 3.5 4 5.6c-1 1 .5 5.4 3.7 8.6s7.7 4.7 8.7 3.7l2.1-2.6-3.2-2.2-2 1.4a12.5 12.5 0 0 1-3.8-3.8l1.4-2Z" /></svg>;
    return <svg {...stroke}><path d="M6.6 3.5 4 5.6c-1 1 .5 5.4 3.7 8.6s7.7 4.7 8.7 3.7l2.1-2.6-3.2-2.2-2 1.4a12.5 12.5 0 0 1-3.8-3.8l1.4-2Z" /></svg>;
  }
  if (name === 'settings') return <svg {...stroke}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1 1.8-2 1.2-1.4-1a7 7 0 0 1-2 .8l-.5 1.7h-2.3l-.5-1.7a7 7 0 0 1-2-.8l-1.4 1-2-1.2.1-1.8a7.7 7.7 0 0 1-1-1.7l-1.5-.7V10l1.5-.7a7.7 7.7 0 0 1 1-1.7L4.8 5.8l2-1.2 1.4 1a7 7 0 0 1 2-.8l.5-1.7h2.3l.5 1.7a7 7 0 0 1 2 .8l1.4-1 2 1.2-.1 1.8a7.7 7.7 0 0 1 1 1.7l1.5.7v2.3l-1.5.7a7.7 7.7 0 0 1-1 1.7Z" /></svg>;
  if (name === 'search') return <svg {...stroke}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
  if (name === 'plus') return <svg {...stroke}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'send') return <svg {...stroke}><path d="m21 3-7 18-3.9-7.1L3 10Z" /><path d="M10.1 13.9 21 3" /></svg>;
  if (name === 'phone') return <svg {...stroke}><path d="M7 3.5 4.5 5.7c-1 1 .5 5.4 3.7 8.6s7.7 4.7 8.8 3.7l2-2.5-3.1-2.2-2 1.3a13 13 0 0 1-3.8-3.8l1.4-2Z" /></svg>;
  if (name === 'video') return <svg {...stroke}><rect x="3" y="6" width="12" height="12" rx="3" /><path d="m15 10 5-3v10l-5-3Z" /></svg>;
  if (name === 'spark') return <svg {...stroke}><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" /></svg>;
  if (name === 'chevron') return <svg {...stroke}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === 'trash') return <svg {...stroke}><path d="M4 7h16M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7m-9 0 .8 12.2c0 .9.8 1.6 1.7 1.6h5c.9 0 1.7-.7 1.7-1.6L18 7" /><path d="M10 11v6M14 11v6" /></svg>;
  if (name === 'eye') return <svg {...stroke}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
  return <svg {...stroke}><circle cx="12" cy="12" r="9" /></svg>;
}

function HubAvatar({ user, size = 'default', online = false }) {
  const preset = presetFromAvatarUrl(user?.avatar_url);
  let el;
  if (user?.avatar_url && !preset) el = <img className={`hub-avatar ${size}`} src={resolveMediaUrl(user.avatar_url)} alt="" />;
  else if (preset) el = <span className={`hub-avatar ${size}`} style={presetGradient(preset)}>{preset.glyph}</span>;
  else el = <span className={`hub-avatar ${size}`} style={avatarGradient(user?.id || user?.username)}>{avatarInitial(user?.username)}</span>;
  if (!online) return el;
  return <span className="avatar-wrap">{el}<i className="online-dot" aria-hidden="true" /></span>;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (minutes < 10080) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function roomName(room, userId) {
  if (room.is_group) return room.name || 'Chatika group';
  return room.participants?.find((person) => person.id !== userId)?.username || room.name || 'Private chat';
}

function roomPerson(room, userId) {
  return room.is_group ? { username: room.name || 'Group' } : room.participants?.find((person) => person.id !== userId);
}

function parseCall(text) {
  try { return JSON.parse(text || '{}'); } catch (_error) { return {}; }
}

function previewFor(room, userId) {
  if (!room.last_message_type) {
    const friend = roomPerson(room, userId);
    return room.is_group ? `${room.participants?.length || 0} members` : friend?.is_online ? 'Online now' : 'Start a private conversation';
  }
  if (room.last_message_type === 'call_log') {
    const call = parseCall(room.last_message_text);
    const kind = call.kind === 'video' ? 'video' : 'audio';
    return call.outcome === 'completed' ? `${kind[0].toUpperCase()}${kind.slice(1)} call` : `Missed ${kind} call`;
  }
  const prefix = room.last_message_sender_id === userId ? 'You: ' : '';
  const labels = { image: '📷 Photo', video: '🎥 Video', voice: '🎙 Voice message', audio: '🎵 Audio', file: '📎 File' };
  return `${prefix}${labels[room.last_message_type] || room.last_message_text || 'New message'}`;
}

function statusTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'now';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  return minutes < 60 ? `${Math.max(1, minutes)}m` : `${Math.floor(minutes / 60)}h`;
}

function statusPostedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

function isVideoMedia(mediaUrl) {
  if (!mediaUrl) return false;
  if (/mime_type=video/i.test(mediaUrl)) return true;
  return /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);
}

export default function ChatHub({
  me,
  rooms,
  unreadCounts,
  statuses = [],
  onSelectRoom,
  onStartDirect,
  onDiscoverFriends,
  onCreateGroup,
  onPostStatus,
  onDeleteStatus,
  onViewStatus,
  onLoadCallHistory,
  onStartCall,
  onDeleteRoom,
  onDeleteMessage,
  onOpenSidebar,
  notificationStatus,
  onEnableNotifications,
  dataSaver,
  onToggleDataSaver,
  chatBackground,
  onChangeChatBackground,
  onLogout,
  onOpenAdmin,
  isAdmin
}) {
  const [tab, setTab] = useState('chats');
  const [composerOpen, setComposerOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusViewer, setStatusViewer] = useState(null);

  // Keeps the open viewer's data (view_count/viewers in particular) in sync
  // whenever `statuses` refreshes, instead of freezing at whatever snapshot
  // was current the moment the viewer opened.
  useEffect(() => {
    if (!statusViewer) return;
    const fresh = statuses.find((item) => item.id === statusViewer.id);
    if (fresh && fresh !== statusViewer) setStatusViewer(fresh);
  }, [statuses, statusViewer]);
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [chatFilter, setChatFilter] = useState('');
  const searchRequestIdRef = useRef(0);

  const orderedRooms = useMemo(() => [...rooms].sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)), [rooms]);
  const directRooms = useMemo(() => orderedRooms.filter((room) => !room.is_group), [orderedRooms]);
  const visibleRooms = useMemo(() => {
    const query = chatFilter.trim().toLowerCase();
    if (!query) return orderedRooms;
    return orderedRooms.filter((room) => roomName(room, me.id).toLowerCase().includes(query));
  }, [orderedRooms, chatFilter, me.id]);
  const unreadTotal = useMemo(() => Object.values(unreadCounts || {}).reduce((total, count) => total + Number(count || 0), 0), [unreadCounts]);
  const roomsById = useMemo(() => Object.fromEntries(rooms.map((room) => [room.id, room])), [rooms]);

  // App.jsx passes onLoadCallHistory as a plain (unmemoized) function, so its
  // reference changes on every App re-render - websocket-driven state updates
  // (presence, typing, new messages) fire constantly. Depending on it
  // directly meant this effect tore down and refired on nearly every render
  // while the Calls tab was open, aborting each in-flight fetch before it
  // could resolve. A ref keeps the call always up to date without making it
  // a reactive dependency, so this only (re)runs when the tab actually changes.
  const loadCallHistoryRef = useRef(onLoadCallHistory);
  useEffect(() => { loadCallHistoryRef.current = onLoadCallHistory; });

  useEffect(() => {
    if (tab !== 'calls' || !loadCallHistoryRef.current) return;
    let cancelled = false;
    setCallsLoading(true);
    loadCallHistoryRef.current()
      .then((history) => { if (!cancelled) setCallHistory(history || []); })
      .catch((error) => { if (!cancelled) setNotice(error.message || 'Could not load calls.'); })
      .finally(() => { if (!cancelled) setCallsLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  async function runSearch(query) {
    const requestId = ++searchRequestIdRef.current;
    setSearchLoading(true);
    setNotice('');
    try {
      const people = await onDiscoverFriends?.(query, 'all');
      if (searchRequestIdRef.current === requestId) setResults(people || []);
    } catch (error) {
      if (searchRequestIdRef.current === requestId) setNotice(error.message || 'Could not find people.');
    } finally {
      if (searchRequestIdRef.current === requestId) setSearchLoading(false);
    }
  }

  function searchPeople(event) {
    event?.preventDefault();
    runSearch(searchText.trim());
  }

  // Auto-suggest as the user types, without dropping the explicit
  // submit-on-Enter path above - a slow older keystroke's response can never
  // clobber a newer one because both paths share the same request-id guard.
  useEffect(() => {
    if (tab !== 'search') return undefined;
    const query = searchText.trim();
    if (!query) {
      searchRequestIdRef.current += 1;
      setResults([]);
      setSearchLoading(false);
      return undefined;
    }
    const timer = window.setTimeout(() => runSearch(query), 300);
    return () => window.clearTimeout(timer);
  }, [searchText, tab]);

  const deleteRoom = useCallback(async (room) => {
    const verb = room.is_group ? 'Leave' : 'Delete';
    if (!window.confirm(`${verb} this conversation?`)) return;
    try {
      await onDeleteRoom?.(room.id, room.is_group);
    } catch (error) {
      setNotice(error.message || 'Could not remove this conversation.');
    }
  }, [onDeleteRoom]);

  const deleteCall = useCallback(async (callId) => {
    if (!window.confirm('Delete this call from your history?')) return;
    try {
      await onDeleteMessage?.(callId);
      setCallHistory((prev) => prev.filter((call) => call.id !== callId));
    } catch (error) {
      setNotice(error.message || 'Could not delete this call.');
    }
  }, [onDeleteMessage]);

  async function deleteViewedStatus(statusId) {
    if (!window.confirm('Delete this Pulse update?')) return;
    try {
      await onDeleteStatus?.(statusId);
      setStatusViewer(null);
    } catch (error) {
      setNotice(error.message || 'Could not delete your Pulse.');
    }
  }

  async function startChat(username) {
    if (!username) return;
    try {
      await onStartDirect(username);
      setComposerOpen(false);
      setSearchText('');
      setResults([]);
    } catch (error) {
      setNotice(error.message || 'Could not start this chat.');
    }
  }

  async function saveStatus(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get('text') || '').trim();
    const [file] = form.getAll('file');
    if (!text && !(file instanceof File && file.size)) return;
    try {
      await onPostStatus?.({ text, file: file instanceof File ? file : null });
      setStatusOpen(false);
    } catch (error) {
      setNotice(error.message || 'Could not post your Pulse.');
    }
  }

  async function createGroup(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('group-name') || '').trim();
    const usernames = String(form.get('members') || '').split(',').map((value) => value.trim()).filter(Boolean);
    if (!name || !usernames.length) return;
    try {
      await onCreateGroup?.(name, usernames);
      setComposerOpen(false);
    } catch (error) {
      setNotice(error.message || 'Could not create the group.');
    }
  }

  const selectRoom = useCallback((roomId) => {
    setNotice('');
    onSelectRoom(roomId);
  }, [onSelectRoom]);

  const handleCallBack = useCallback((kind, call) => {
    selectRoom(call.room_id);
    onStartCall?.(kind, call.room_id);
  }, [selectRoom, onStartCall]);

  const handleFriendCall = useCallback((kind, roomId) => {
    onStartCall?.(kind, roomId);
  }, [onStartCall]);

  return (
    <section className="chat-hub" aria-label="Chatika home">
      <header className="hub-header">
        <button type="button" className="hub-profile-trigger" onClick={onOpenSidebar} aria-label="Open profile and navigation"><HubAvatar user={me} size="header" /><span><small>CHATIKA</small><strong>My space</strong></span></button>
        <div className="hub-header-actions">
          <button type="button" className="hub-icon-button" onClick={() => { setTab('search'); setSearchText(''); setResults([]); }} aria-label="Search Chatika"><HubIcon name="search" /></button>
          <button type="button" className="hub-new-button" onClick={() => setComposerOpen(true)}><HubIcon name="plus" size={18} /><span>New</span></button>
        </div>
      </header>

      {tab === 'chats' && <section className="hub-pulse-section">
        <div className="hub-section-title"><span>Pulse</span><button type="button" onClick={() => setStatusOpen(true)}>Share an update <HubIcon name="plus" size={14} /></button></div>
        <div className="hub-pulse-rail">
          <button type="button" className="pulse-card pulse-create" onClick={() => setStatusOpen(true)}><HubAvatar user={me} /><span className="pulse-plus"><HubIcon name="plus" size={13} /></span><small>My Pulse</small></button>
          {statuses.map((status) => <button type="button" className={status.is_official ? 'pulse-card official' : 'pulse-card'} key={status.id} onClick={() => setStatusViewer(status)}><HubAvatar user={{ id: status.author_id, username: status.username, avatar_url: status.avatar_url }} /><small>{status.is_official ? 'Chatika' : status.is_own ? 'My update' : status.username}</small><i>{statusTime(status.created_at)}</i></button>)}
        </div>
      </section>}

      <section className="hub-content">
        {tab === 'chats' && <>
          {orderedRooms.length > 4 && <label className="hub-chat-filter"><HubIcon name="search" size={16} /><input value={chatFilter} onChange={(event) => setChatFilter(event.target.value)} placeholder="Search your chats" aria-label="Filter conversations" />{chatFilter && <button type="button" onClick={() => setChatFilter('')} aria-label="Clear filter">×</button>}</label>}
          <div className="hub-section-title conversations-title"><span>Conversations</span><small>{unreadTotal ? `${unreadTotal} new` : `${visibleRooms.length} active`}</small></div>
          <div className="hub-list">
            {visibleRooms.map((room) => <ConversationRow key={room.id} room={room} me={me} unread={unreadCounts?.[room.id] || 0} onSelect={selectRoom} onDelete={deleteRoom} />)}
            {!orderedRooms.length && <HubEmpty icon="chats" title="Your conversations begin here" description="Start a private chat with a Chatika username, or bring people together in a group." action="Start a new chat" onAction={() => setComposerOpen(true)} />}
            {Boolean(orderedRooms.length) && !visibleRooms.length && <HubEmpty icon="search" title="No matches" description="Try a different name." />}
          </div>
        </>}

        {tab === 'friends' && <>
          <div className="hub-section-title conversations-title"><span>Friends</span><button type="button" onClick={() => setComposerOpen(true)}>Add friend</button></div>
          <div className="hub-list friend-hub-list">
            {directRooms.map((room) => <FriendRow key={room.id} room={room} me={me} onSelect={selectRoom} onCall={handleFriendCall} />)}
            {!directRooms.length && <HubEmpty icon="friends" title="Find your people" description="Search by username to start a private Chatika conversation." action="Find a friend" onAction={() => { setTab('search'); setSearchText(''); }} />}
          </div>
        </>}

        {tab === 'calls' && <>
          <div className="hub-section-title conversations-title"><span>Calls</span><button type="button" onClick={() => setComposerOpen(true)}>New call</button></div>
          <div className="hub-list call-hub-list">
            {callsLoading && <p className="hub-loading">Loading your call history…</p>}
            {!callsLoading && callHistory.map((call) => <CallHistoryRow key={call.id} call={call} me={me} room={roomsById[call.room_id]} onCall={handleCallBack} onDelete={deleteCall} />)}
            {!callsLoading && !callHistory.length && <HubEmpty icon="calls" title="No calls yet" description="Audio and video calls you make in Chatika will appear here." action="Call a friend" onAction={() => setTab('friends')} />}
          </div>
        </>}

        {tab === 'settings' && <section className="hub-settings">
          <article><span className="settings-icon"><HubIcon name="spark" /></span><div><strong>Notifications</strong><small>{notificationStatus === 'on' ? 'Enabled for messages and calls' : 'Stay connected when Chatika is closed'}</small></div>{notificationStatus === 'on' ? <b className="settings-good">On</b> : <button type="button" onClick={onEnableNotifications}>Enable</button>}</article>
          <article><span className="settings-icon"><HubIcon name="settings" /></span><div><strong>{dataSaver ? 'Data saver' : 'High quality media'}</strong><small>{dataSaver ? 'Lighter media for lower data use' : 'Full quality when your connection allows'}</small></div><button type="button" onClick={onToggleDataSaver}>{dataSaver ? 'On' : 'Off'}</button></article>
          <article><span className="settings-icon"><HubIcon name="spark" /></span><div><strong>Night theme</strong><small>Changes automatically with your device time</small></div><b className="settings-good">Auto</b></article>
          <article className="settings-background"><span className="settings-icon"><HubIcon name="spark" /></span><div><strong>Chat background</strong><small>Pick a wallpaper for your conversations</small></div></article>
          <div className="settings-background-swatches">
            {CHAT_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                className={chatBackground === bg.id ? 'background-swatch active' : 'background-swatch'}
                style={{ background: bg.swatch }}
                onClick={() => onChangeChatBackground?.(bg.id)}
                aria-label={bg.label}
                aria-pressed={chatBackground === bg.id}
                title={bg.label}
              />
            ))}
          </div>
          {isAdmin && <article><span className="settings-icon"><HubIcon name="friends" /></span><div><strong>Admin control</strong><small>Users, feedback, and beta activity</small></div><button type="button" onClick={onOpenAdmin}>Open</button></article>}
          <button type="button" className="hub-logout" onClick={onLogout}>Log out</button>
        </section>}

        {tab === 'search' && <section className="hub-search">
          <div className="hub-section-title"><span>Find people</span><button type="button" onClick={() => setComposerOpen(true)}>New group</button></div>
          <form onSubmit={searchPeople} className="hub-search-form"><HubIcon name="search" /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search a Chatika username" /><button type="submit">Search</button></form>
          <div className="hub-list search-results">
            {searchLoading && <p className="hub-loading">Searching Chatika…</p>}
            {!searchLoading && results.map((person) => <button key={person.id} type="button" className="hub-person-row" onClick={() => startChat(person.username)}><HubAvatar user={person} /><span><strong>@{person.username}</strong><small>{person.is_online ? 'Online now' : person.is_nearby ? 'Nearby on Chatika' : 'Open a private chat'}</small></span><HubIcon name="chevron" size={18} /></button>)}
            {!searchLoading && !results.length && <HubEmpty icon="search" title="Search people" description="Enter a username to begin a private conversation." />}
          </div>
        </section>}
        {notice && <p className="hub-notice" role="status">{notice}</p>}
      </section>

      <nav className="hub-dock" aria-label="Chatika navigation">
        <TabButton active={tab === 'chats'} icon="chats" label="Chats" badge={unreadTotal} onClick={() => setTab('chats')} />
        <TabButton active={tab === 'friends'} icon="friends" label="Friends" onClick={() => setTab('friends')} />
        <TabButton active={tab === 'calls'} icon="calls" label="Calls" onClick={() => setTab('calls')} />
        <TabButton active={tab === 'settings'} icon="settings" label="Settings" onClick={() => setTab('settings')} />
        <TabButton active={tab === 'search'} icon="search" label="Search" onClick={() => setTab('search')} />
      </nav>

      {composerOpen && <div className="hub-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setComposerOpen(false)}>
        <section className="hub-modal" role="dialog" aria-modal="true" aria-label="Start a conversation">
          <header><div><small>CHATIKA</small><h2>Start something new</h2></div><button type="button" onClick={() => setComposerOpen(false)}>×</button></header>
          <form className="hub-modal-form" onSubmit={(event) => { event.preventDefault(); startChat(String(new FormData(event.currentTarget).get('username') || '').trim()); }}><label>Private message<input name="username" placeholder="@username" autoFocus required /></label><button type="submit" className="hub-primary-action"><HubIcon name="send" size={17} /> Start chat</button></form>
          <div className="hub-modal-divider"><span>or create a group</span></div>
          <form className="hub-modal-form" onSubmit={createGroup}><label>Group name<input name="group-name" placeholder="Weekend plans" required /></label><label>Members<input name="members" placeholder="@friend1, @friend2" required /></label><button type="submit" className="hub-secondary-action"><HubIcon name="friends" size={17} /> Create group</button></form>
        </section>
      </div>}

      {statusOpen && <div className="hub-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setStatusOpen(false)}>
        <section className="hub-modal status-modal" role="dialog" aria-modal="true" aria-label="Post a Pulse">
          <header><div><small>CHATIKA PULSE</small><h2>Share a moment</h2></div><button type="button" onClick={() => setStatusOpen(false)}>×</button></header>
          <form className="hub-modal-form" onSubmit={saveStatus}><label>Visible for 24 hours<textarea name="text" maxLength="280" placeholder="What is happening?" /></label><label className="status-file-label">Add a photo or video<input name="file" type="file" accept="image/*,video/*" /></label><button type="submit" className="hub-primary-action"><HubIcon name="spark" size={17} /> Publish Pulse</button></form>
        </section>
      </div>}

      {statusViewer && <PulseViewer key={statusViewer.id} status={statusViewer} onClose={() => setStatusViewer(null)} onDelete={deleteViewedStatus} onView={onViewStatus} />}
    </section>
  );
}

function TabButton({ active, icon, label, badge, onClick }) {
  return <button type="button" className={active ? 'hub-tab active' : 'hub-tab'} onClick={onClick}><span><HubIcon name={icon} size={active ? 21 : 19} filled={active} />{badge > 0 && <b>{badge > 99 ? '99+' : badge}</b>}</span><small>{label}</small></button>;
}

const ConversationRow = React.memo(function ConversationRow({ room, me, unread, onSelect, onDelete }) {
  const person = roomPerson(room, me.id);
  return (
    <div className="hub-conversation-row">
      <button type="button" className="hub-conversation-main" onClick={() => onSelect(room.id)}>
        <HubAvatar user={person} online={!room.is_group && Boolean(person?.is_online)} />
        <span className="hub-conversation-copy"><span><strong>{roomName(room, me.id)}</strong><time>{room.last_message_at ? formatTime(room.last_message_at) : ''}</time></span><small className={unread ? 'unread' : ''}>{previewFor(room, me.id)}</small></span>
        {unread > 0 && <b className="hub-unread-count">{unread > 99 ? '99+' : unread}</b>}
      </button>
      <button type="button" className="hub-row-delete" onClick={(event) => { event.stopPropagation(); onDelete(room); }} aria-label={room.is_group ? `Leave ${roomName(room, me.id)}` : `Delete conversation with ${roomName(room, me.id)}`}><HubIcon name="trash" size={16} /></button>
    </div>
  );
});

const FriendRow = React.memo(function FriendRow({ room, me, onSelect, onCall }) {
  const person = roomPerson(room, me.id);
  return <article className="hub-friend-row"><button type="button" onClick={() => onSelect(room.id)}><HubAvatar user={person} online={Boolean(person?.is_online)} /><span><strong>{roomName(room, me.id)}</strong><small>{person?.is_online ? 'Online now' : 'Private Chatika friend'}</small></span></button><div><button type="button" aria-label={`Audio call ${roomName(room, me.id)}`} onClick={() => onCall('audio', room.id)}><HubIcon name="phone" size={18} /></button><button type="button" aria-label={`Video call ${roomName(room, me.id)}`} onClick={() => onCall('video', room.id)}><HubIcon name="video" size={18} /></button></div></article>;
});

const CallHistoryRow = React.memo(function CallHistoryRow({ call, me, room, onCall, onDelete }) {
  const details = parseCall(call.text);
  const kind = details.kind === 'video' ? 'video' : 'audio';
  // Call-log rows only exist on the initiator's side, so call.sender_username
  // is always the initiator - when that's us, the "other party" has to come
  // from the room's participants instead, or the row shows our own name.
  const otherParticipant = room && !room.is_group ? room.participants?.find((person) => person.id !== me.id) : null;
  const label = call.sender_id === me.id
    ? (otherParticipant?.username ? `@${otherParticipant.username}` : room?.name || 'Chatika friend')
    : (call.sender_username || room?.name || 'Chatika friend');
  return (
    <article className="hub-call-row">
      <span className={`call-history-icon ${details.outcome === 'missed' ? 'missed' : ''}`}><HubIcon name={kind === 'video' ? 'video' : 'phone'} size={19} /></span>
      <span><strong>{label}</strong><small>{details.outcome === 'missed' ? `Missed ${kind} call` : `${kind[0].toUpperCase()}${kind.slice(1)} call`} · {formatTime(call.created_at)}</small></span>
      <div>
        <button type="button" onClick={() => onCall(kind, call)} aria-label={`Call ${label}`}><HubIcon name={kind === 'video' ? 'video' : 'phone'} size={18} /></button>
        <button type="button" className="call-history-delete" onClick={() => onDelete(call.id)} aria-label="Delete this call from history"><HubIcon name="trash" size={16} /></button>
      </div>
    </article>
  );
});

function PulseViewer({ status, onClose, onDelete, onView }) {
  const [progress, setProgress] = useState(0);
  const isVideo = isVideoMedia(status.media_url);
  const canDelete = status.is_own && status.id !== 'chatika-official';
  const canSeeViews = status.view_count != null;

  useEffect(() => {
    onView?.(status.id);
    // Only on mount for this status - re-opening the same status shouldn't
    // spam the endpoint (the backend also dedupes by viewer, so this is
    // just avoiding a wasted request, not a correctness requirement).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.id]);

  useEffect(() => {
    if (isVideo) return undefined; // video drives its own timing via onTimeUpdate/onEnded below
    const durationMs = 5000;
    let raf;
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      if (pct >= 100) { onClose(); return; }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [isVideo, onClose]);

  function handleVideoTimeUpdate(event) {
    const video = event.currentTarget;
    if (!video.duration) return;
    setProgress(Math.min(100, (video.currentTime / video.duration) * 100));
  }

  return (
    <div className="pulse-viewer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="pulse-viewer-full" role="dialog" aria-modal="true" aria-label="Chatika Pulse">
        <div className="pulse-progress-track"><div className="pulse-progress-fill" style={{ width: `${progress}%` }} /></div>
        <header className="pulse-viewer-full-header">
          <div className="pulse-viewer-user">
            <HubAvatar user={{ id: status.author_id, username: status.username, avatar_url: status.avatar_url }} />
            <span><strong>{status.is_official ? 'Chatika official' : `@${status.username}`}</strong><small>{statusPostedAt(status.created_at)}</small></span>
          </div>
          <div className="pulse-viewer-actions">
            {canDelete && <button type="button" onClick={() => onDelete(status.id)} aria-label="Delete this update"><HubIcon name="trash" size={17} /></button>}
            <button type="button" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>
        <div className="pulse-viewer-body">
          {status.media_url && (isVideo
            ? <video src={resolveMediaUrl(status.media_url)} autoPlay playsInline onTimeUpdate={handleVideoTimeUpdate} onEnded={onClose} />
            : <img src={resolveMediaUrl(status.media_url)} alt="Status update" />)}
          {(status.text || !status.media_url) && <p className="pulse-viewer-text">{status.text || 'Shared a new update.'}</p>}
        </div>
        {canSeeViews && (
          <div className="pulse-viewer-views">
            <span className="pulse-view-count"><HubIcon name="eye" size={15} /> {status.view_count} {status.view_count === 1 ? 'view' : 'views'}</span>
            {status.viewers?.length > 0 && (
              <div className="pulse-viewer-list">
                {status.viewers.map((viewer) => (
                  <span key={viewer.id} className="pulse-viewer-chip">
                    <HubAvatar user={viewer} size="tiny" />
                    @{viewer.username}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function HubEmpty({ icon, title, description, action, onAction }) {
  return <div className="hub-empty"><span><HubIcon name={icon} size={28} /></span><h2>{title}</h2><p>{description}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</div>;
}
