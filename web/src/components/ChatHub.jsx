import React, { useEffect, useMemo, useState } from 'react';
import { resolveMediaUrl } from '../lib/api';
import { avatarGradient, avatarInitial, presetFromAvatarUrl, presetGradient } from '../lib/avatar';

function HubIcon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'chats') return <svg {...common}><path d="M21 11.5a8 8 0 0 1-8.5 8 8.9 8.9 0 0 1-3.7-.9L3 20l1.6-4.1A8 8 0 1 1 21 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></svg>;
  if (name === 'friends') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.8-3.3 2.7-5 5.5-5s4.7 1.7 5.5 5M17 10h4M19 8v4" /></svg>;
  if (name === 'calls') return <svg {...common}><path d="M6.6 3.5 4 5.6c-1 1 .5 5.4 3.7 8.6s7.7 4.7 8.7 3.7l2.1-2.6-3.2-2.2-2 1.4a12.5 12.5 0 0 1-3.8-3.8l1.4-2Z" /></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1 1.8-2 1.2-1.4-1a7 7 0 0 1-2 .8l-.5 1.7h-2.3l-.5-1.7a7 7 0 0 1-2-.8l-1.4 1-2-1.2.1-1.8a7.7 7.7 0 0 1-1-1.7l-1.5-.7V10l1.5-.7a7.7 7.7 0 0 1 1-1.7L4.8 5.8l2-1.2 1.4 1a7 7 0 0 1 2-.8l.5-1.7h2.3l.5 1.7a7 7 0 0 1 2 .8l1.4-1 2 1.2-.1 1.8a7.7 7.7 0 0 1 1 1.7l1.5.7v2.3l-1.5.7a7.7 7.7 0 0 1-1 1.7Z" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'send') return <svg {...common}><path d="m21 3-7 18-3.9-7.1L3 10Z" /><path d="M10.1 13.9 21 3" /></svg>;
  if (name === 'phone') return <svg {...common}><path d="M7 3.5 4.5 5.7c-1 1 .5 5.4 3.7 8.6s7.7 4.7 8.8 3.7l2-2.5-3.1-2.2-2 1.3a13 13 0 0 1-3.8-3.8l1.4-2Z" /></svg>;
  if (name === 'video') return <svg {...common}><rect x="3" y="6" width="12" height="12" rx="3" /><path d="m15 10 5-3v10l-5-3Z" /></svg>;
  if (name === 'spark') return <svg {...common}><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" /></svg>;
  if (name === 'chevron') return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
}

function HubAvatar({ user, size = 'default' }) {
  const preset = presetFromAvatarUrl(user?.avatar_url);
  if (user?.avatar_url && !preset) return <img className={`hub-avatar ${size}`} src={resolveMediaUrl(user.avatar_url)} alt="" />;
  if (preset) return <span className={`hub-avatar ${size}`} style={presetGradient(preset)}>{preset.glyph}</span>;
  return <span className={`hub-avatar ${size}`} style={avatarGradient(user?.id || user?.username)}>{avatarInitial(user?.username)}</span>;
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
  onLoadCallHistory,
  onStartCall,
  onOpenSidebar,
  notificationStatus,
  onEnableNotifications,
  dataSaver,
  onToggleDataSaver,
  onLogout,
  onOpenAdmin,
  isAdmin
}) {
  const [tab, setTab] = useState('chats');
  const [composerOpen, setComposerOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusViewer, setStatusViewer] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const orderedRooms = useMemo(() => [...rooms].sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)), [rooms]);
  const directRooms = useMemo(() => orderedRooms.filter((room) => !room.is_group), [orderedRooms]);
  const unreadTotal = useMemo(() => Object.values(unreadCounts || {}).reduce((total, count) => total + Number(count || 0), 0), [unreadCounts]);

  useEffect(() => {
    if (tab !== 'calls' || !onLoadCallHistory) return;
    let cancelled = false;
    setCallsLoading(true);
    onLoadCallHistory()
      .then((history) => { if (!cancelled) setCallHistory(history || []); })
      .catch((error) => { if (!cancelled) setNotice(error.message || 'Could not load calls.'); })
      .finally(() => { if (!cancelled) setCallsLoading(false); });
    return () => { cancelled = true; };
  }, [tab, onLoadCallHistory]);

  async function searchPeople(event) {
    event?.preventDefault();
    setSearchLoading(true);
    setNotice('');
    try {
      setResults(await onDiscoverFriends?.(searchText.trim(), 'all') || []);
    } catch (error) {
      setNotice(error.message || 'Could not find people.');
    } finally {
      setSearchLoading(false);
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

  function selectRoom(roomId) {
    setNotice('');
    onSelectRoom(roomId);
  }

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
          <div className="hub-section-title conversations-title"><span>Conversations</span><small>{unreadTotal ? `${unreadTotal} new` : `${orderedRooms.length} active`}</small></div>
          <div className="hub-list">
            {orderedRooms.map((room) => <ConversationRow key={room.id} room={room} me={me} unread={unreadCounts?.[room.id] || 0} onSelect={() => selectRoom(room.id)} />)}
            {!orderedRooms.length && <HubEmpty icon="chats" title="Your conversations begin here" description="Start a private chat with a Chatika username, or bring people together in a group." action="Start a new chat" onAction={() => setComposerOpen(true)} />}
          </div>
        </>}

        {tab === 'friends' && <>
          <div className="hub-section-title conversations-title"><span>Friends</span><button type="button" onClick={() => setComposerOpen(true)}>Add friend</button></div>
          <div className="hub-list friend-hub-list">
            {directRooms.map((room) => <FriendRow key={room.id} room={room} me={me} onSelect={() => selectRoom(room.id)} onCall={(kind) => onStartCall?.(kind, room.id)} />)}
            {!directRooms.length && <HubEmpty icon="friends" title="Find your people" description="Search by username to start a private Chatika conversation." action="Find a friend" onAction={() => { setTab('search'); setSearchText(''); }} />}
          </div>
        </>}

        {tab === 'calls' && <>
          <div className="hub-section-title conversations-title"><span>Calls</span><button type="button" onClick={() => setComposerOpen(true)}>New call</button></div>
          <div className="hub-list call-hub-list">
            {callsLoading && <p className="hub-loading">Loading your call history…</p>}
            {!callsLoading && callHistory.map((call) => <CallHistoryRow key={call.id} call={call} onCall={(kind) => { selectRoom(call.room_id); onStartCall?.(kind, call.room_id); }} />)}
            {!callsLoading && !callHistory.length && <HubEmpty icon="calls" title="No calls yet" description="Audio and video calls you make in Chatika will appear here." action="Call a friend" onAction={() => setTab('friends')} />}
          </div>
        </>}

        {tab === 'settings' && <section className="hub-settings">
          <article><span className="settings-icon"><HubIcon name="spark" /></span><div><strong>Notifications</strong><small>{notificationStatus === 'on' ? 'Enabled for messages and calls' : 'Stay connected when Chatika is closed'}</small></div>{notificationStatus === 'on' ? <b className="settings-good">On</b> : <button type="button" onClick={onEnableNotifications}>Enable</button>}</article>
          <article><span className="settings-icon"><HubIcon name="settings" /></span><div><strong>{dataSaver ? 'Data saver' : 'High quality media'}</strong><small>{dataSaver ? 'Lighter media for lower data use' : 'Full quality when your connection allows'}</small></div><button type="button" onClick={onToggleDataSaver}>{dataSaver ? 'On' : 'Off'}</button></article>
          {isAdmin && <article><span className="settings-icon"><HubIcon name="friends" /></span><div><strong>Admin control</strong><small>Users, feedback, and beta activity</small></div><button type="button" onClick={onOpenAdmin}>Open</button></article>}
          <button type="button" className="hub-logout" onClick={onLogout}>Log out</button>
        </section>}

        {tab === 'search' && <section className="hub-search">
          <div className="hub-section-title"><span>Find people</span><button type="button" onClick={() => setComposerOpen(true)}>New group</button></div>
          <form onSubmit={searchPeople} className="hub-search-form"><HubIcon name="search" /><input autoFocus value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search a Chatika username" /><button type="submit">Search</button></form>
          <div className="hub-list search-results">
            {searchLoading && <p className="hub-loading">Searching Chatika…</p>}
            {!searchLoading && results.map((person) => <button key={person.id} type="button" className="hub-person-row" onClick={() => startChat(person.username)}><HubAvatar user={person} /><span><strong>@{person.username}</strong><small>{person.is_online ? 'Online now' : person.is_nearby ? 'Nearby on Chatika' : 'Open a private chat'}</small></span><HubIcon name="chevron" size={18} /></button>)}
            {!searchLoading && !results.length && <HubEmpty icon="search" title="Search people" description="Enter a username to begin a private conversation." />}
          </div>
        </section>}
      </section>

      {notice && <p className="hub-notice" role="status">{notice}</p>}
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
          <form className="hub-modal-form" onSubmit={saveStatus}><label>Visible for 24 hours<textarea name="text" maxLength="280" placeholder="What is happening?" /></label><label className="status-file-label">Add a photo<input name="file" type="file" accept="image/*" /></label><button type="submit" className="hub-primary-action"><HubIcon name="spark" size={17} /> Publish Pulse</button></form>
        </section>
      </div>}

      {statusViewer && <div className="hub-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setStatusViewer(null)}>
        <section className="hub-modal pulse-viewer" role="dialog" aria-modal="true" aria-label="Chatika Pulse">
          <header><div className="pulse-viewer-user"><HubAvatar user={{ id: statusViewer.author_id, username: statusViewer.username, avatar_url: statusViewer.avatar_url }} /><span><strong>{statusViewer.is_official ? 'Chatika official' : `@${statusViewer.username}`}</strong><small>{statusTime(statusViewer.created_at)} ago</small></span></div><button type="button" onClick={() => setStatusViewer(null)}>×</button></header>
          {statusViewer.media_url && <img src={resolveMediaUrl(statusViewer.media_url)} alt="Status update" />}
          <p>{statusViewer.text || 'Shared a new update.'}</p>
        </section>
      </div>}
    </section>
  );
}

function TabButton({ active, icon, label, badge, onClick }) {
  return <button type="button" className={active ? 'hub-tab active' : 'hub-tab'} onClick={onClick}><span><HubIcon name={icon} size={20} />{badge > 0 && <b>{badge > 99 ? '99+' : badge}</b>}</span><small>{label}</small></button>;
}

function ConversationRow({ room, me, unread, onSelect }) {
  const person = roomPerson(room, me.id);
  return <button type="button" className="hub-conversation-row" onClick={onSelect}><HubAvatar user={person} /><span className="hub-conversation-copy"><span><strong>{roomName(room, me.id)}</strong><time>{room.last_message_at ? formatTime(room.last_message_at) : ''}</time></span><small className={unread ? 'unread' : ''}>{previewFor(room, me.id)}</small></span>{unread > 0 && <b className="hub-unread-count">{unread > 99 ? '99+' : unread}</b>}</button>;
}

function FriendRow({ room, me, onSelect, onCall }) {
  const person = roomPerson(room, me.id);
  return <article className="hub-friend-row"><button type="button" onClick={onSelect}><HubAvatar user={person} /><span><strong>{roomName(room, me.id)}</strong><small>{person?.is_online ? 'Online now' : 'Private Chatika friend'}</small></span></button><div><button type="button" aria-label={`Audio call ${roomName(room, me.id)}`} onClick={() => onCall('audio')}><HubIcon name="phone" size={18} /></button><button type="button" aria-label={`Video call ${roomName(room, me.id)}`} onClick={() => onCall('video')}><HubIcon name="video" size={18} /></button></div></article>;
}

function CallHistoryRow({ call, onCall }) {
  const details = parseCall(call.text);
  const kind = details.kind === 'video' ? 'video' : 'audio';
  const label = call.name || call.sender_username || 'Chatika friend';
  return <article className="hub-call-row"><span className={`call-history-icon ${details.outcome === 'missed' ? 'missed' : ''}`}><HubIcon name={kind === 'video' ? 'video' : 'phone'} size={19} /></span><span><strong>{label}</strong><small>{details.outcome === 'missed' ? `Missed ${kind} call` : `${kind[0].toUpperCase()}${kind.slice(1)} call`} · {formatTime(call.created_at)}</small></span><button type="button" onClick={() => onCall(kind)} aria-label={`Call ${label}`}><HubIcon name={kind === 'video' ? 'video' : 'phone'} size={18} /></button></article>;
}

function HubEmpty({ icon, title, description, action, onAction }) {
  return <div className="hub-empty"><span><HubIcon name={icon} size={28} /></span><h2>{title}</h2><p>{description}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</div>;
}
