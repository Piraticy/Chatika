import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APP_CREDIT, APP_VERSION } from '../lib/version';
import { CHATIKA_EMOJIS, findChatikaEmoji } from '../lib/emojis';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '😎', '💬', '❤️', '😭', '🤝'];
const REACTION_EMOJIS = ['👍', '❤️', CHATIKA_EMOJIS[0].code, CHATIKA_EMOJIS[1].code];

export default function ChatLayout({
  me,
  rooms,
  activeRoomId,
  messages,
  onSelectRoom,
  onSend,
  onCreateRoom,
  statusText,
  isAdmin,
  pendingUsers,
  onApprove,
  onTyping,
  typingUsers,
  onReact,
  onLogout,
  onOpenAdmin,
  dataSaver,
  onToggleDataSaver,
  shareActive,
  onShareScreen,
  onInvite,
  inviteStatus
}) {
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const messagesRef = useRef(null);
  const composerRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const groupedMessages = useMemo(() => {
    const grouped = [];
    let previous = null;

    for (const msg of orderedMessages) {
      const currentTime = new Date(msg.created_at).getTime();
      const previousTime = previous ? new Date(previous.created_at).getTime() : 0;
      const withinWindow = previous ? Math.abs(currentTime - previousTime) < 5 * 60 * 1000 : false;
      const sameSender = previous ? previous.sender_id === msg.sender_id : false;

      grouped.push({
        ...msg,
        startsGroup: !sameSender || !withinWindow
      });
      previous = msg;
    }
    return grouped;
  }, [orderedMessages]);
  const typingText = useMemo(() => {
    if (!typingUsers?.length) return '';
    if (typingUsers.length === 1) return 'Someone is typing...';
    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [orderedMessages, activeRoomId]);

  useEffect(() => {
    function onDocumentClick(event) {
      if (!composerRef.current) return;
      if (!composerRef.current.contains(event.target)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  function submitMessage(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeRoomId) return;
    onSend(text);
    onTyping?.(false);
    setDraft('');
    setEmojiOpen(false);
  }

  function submitRoom(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '').trim();
    const ids = String(form.get('participant_ids') || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!name) return;
    onCreateRoom(name, ids);
    e.currentTarget.reset();
  }

  function submitInvite(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get('username') || '').trim();
    if (!username || !activeRoomId) return;
    onInvite(username);
    e.currentTarget.reset();
  }

  function addEmoji(emoji) {
    const next = `${draft}${emoji}`;
    setDraft(next);
    onTyping?.(Boolean(next.trim()));
  }

  function reactionSummary(reactionUsers) {
    const src = reactionUsers || {};
    return Object.entries(src)
      .map(([emoji, users]) => ({
        emoji,
        count: Array.isArray(users) ? users.length : 0,
        mine: Array.isArray(users) ? users.includes(me.id) : false
      }))
      .filter((item) => item.count > 0);
  }

  function renderText(text, keyPrefix = 'chatika-text') {
    return String(text || '').split(/(:chatika_[a-z]+:)/g).map((part, index) => {
      const emoji = findChatikaEmoji(part);
      if (!emoji) return part;
      return <ChatikaEmoji key={`${keyPrefix}-${index}`} emoji={emoji} />;
    });
  }

  return (
    <div className="chat-root">
      <button className="mobile-menu-backdrop" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      <aside className={sidebarOpen ? 'sidebar glass open' : 'sidebar glass'}>
        <div className="sidebar-head">
          <img src="/logo.svg" alt="Chatika" className="mini-logo" />
          <div className="identity">
            <h2>@{me.username}</h2>
            <small>{statusText}</small>
          </div>
          <button className="icon-button sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">×</button>
        </div>

        <div className="sidebar-label"><span>YOUR ROOMS</span><span>{rooms.length} total</span></div>

        <form onSubmit={submitRoom} className="new-room">
          <input name="name" placeholder="New room name" required />
          <input name="participant_ids" placeholder="Participant IDs · optional" />
          <button type="submit"><span>＋</span> Create room</button>
        </form>

        <form onSubmit={submitInvite} className="invite-form">
          <div className="sidebar-label"><span>INVITE TO ROOM</span><span>{activeRoomId ? 'ready' : 'select a room'}</span></div>
          <div className="invite-row">
            <input name="username" placeholder="@username" disabled={!activeRoomId} required />
            <button type="submit" disabled={!activeRoomId}>Invite</button>
          </div>
          {inviteStatus && <small className={inviteStatus.error ? 'invite-status error' : 'invite-status'}>{inviteStatus.text}</small>}
        </form>

        <div className="room-list">
          {rooms.map((room) => (
            <button
              key={room.id}
              className={room.id === activeRoomId ? 'room-item active' : 'room-item'}
              onClick={() => onSelectRoom(room.id)}
            >
              <span className="room-name">{room.name}</span>
              <small>{room.is_group ? 'Group' : 'Direct'}</small>
            </button>
          ))}
        </div>

        {isAdmin && (
          <section className="admin-box">
            <div className="sidebar-label"><span>ADMIN QUEUE</span><span>{pendingUsers.length}</span></div>
            {pendingUsers.map((u) => (
              <div className="pending-user" key={u.id}>
                <span>{u.username}</span>
                <button onClick={() => onApprove(u.id)}>Approve</button>
              </div>
            ))}
            <button className="admin-open-button" type="button" onClick={onOpenAdmin}>Open admin control</button>
          </section>
        )}
        <div className="sidebar-foot">
          <span>{APP_CREDIT} · v{APP_VERSION}</span>
          <button type="button" onClick={onLogout}>Log out</button>
        </div>
      </aside>

      <main className="thread glass">
        <header className="thread-head">
          <div className="thread-title-wrap">
            <button className="icon-button menu-trigger" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">☰</button>
            <div>
              <span className="eyebrow">{activeRoom ? (activeRoom.is_group ? 'GROUP ROOM' : 'DIRECT ROOM') : 'CHATIKA'}</span>
              <h2>{activeRoom ? activeRoom.name : 'Select a room'}</h2>
              <small>{activeRoom ? (activeRoom.is_group ? `${activeRoom.participant_ids?.length || 1} people · ready to connect` : 'Private and encrypted by design') : 'Pick a room to begin'}</small>
            </div>
          </div>
          <div className="thread-actions">
            <button type="button" className={shareActive ? 'share-button active' : 'share-button'} onClick={onShareScreen} disabled={!activeRoomId}>
              <span className="share-icon">▣</span><span>{shareActive ? 'Sharing' : 'Share screen'}</span>
            </button>
            <button type="button" className="icon-button" onClick={onToggleDataSaver} aria-label="Toggle data saver" title="Toggle data saver">
              {dataSaver ? '◒' : '◓'}
            </button>
            <div className="avatar-stack" aria-hidden="true">
              <span>A</span><span>C</span><span>K</span>
            </div>
          </div>
        </header>

        <div className="thread-notice"><span className="status-dot" /> {dataSaver ? 'Data saver on · lighter media and fewer messages loaded' : 'High quality mode · adaptive to your connection'}</div>

        <section className="messages" ref={messagesRef}>
          {!orderedMessages.length && (
            <div className="empty-chat">
              <h3>No messages yet</h3>
              <p>Start the conversation in this room.</p>
            </div>
          )}

          {groupedMessages.map((m) => (
            <article key={m.id} className={m.sender_id === me.id ? 'msg mine' : 'msg'}>
              {m.startsGroup && <span className="msg-sender">{m.sender_id === me.id ? 'You' : 'Member'}</span>}
              <p>{m.text ? renderText(m.text, m.id) : `[${m.message_type}]`}</p>
              <div className="reaction-row">
                <div className="reaction-buttons">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="reaction-btn"
                      onClick={() => onReact?.(m.id, emoji)}
                      aria-label={`React ${emoji}`}
                    >
                      {findChatikaEmoji(emoji) ? <ChatikaEmoji emoji={findChatikaEmoji(emoji)} /> : emoji}
                    </button>
                  ))}
                </div>
                <div className="reaction-summary">
                  {reactionSummary(m.reaction_users).map((item) => (
                    <span key={`${m.id}-${item.emoji}`} className={item.mine ? 'reaction-chip mine' : 'reaction-chip'}>
                      {renderText(item.emoji, `${m.id}-reaction`)} {item.count}
                    </span>
                  ))}
                </div>
              </div>
              <time>{new Date(m.created_at).toLocaleTimeString()}</time>
            </article>
          ))}
          {typingText && <div className="typing-indicator">{typingText}</div>}
        </section>

        <form onSubmit={submitMessage} className="composer" ref={composerRef}>
          <button
            type="button"
            className="emoji-toggle"
            onClick={() => setEmojiOpen((prev) => !prev)}
            aria-label="Toggle emoji picker"
            title="Emoji"
            disabled={!activeRoomId}
          >
            🙂
          </button>
          <input
            name="text"
            placeholder={activeRoomId ? 'Write a message...' : 'Select a room first'}
            disabled={!activeRoomId}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onTyping?.(Boolean(e.target.value.trim()));
            }}
            onBlur={() => onTyping?.(false)}
          />
          {emojiOpen && (
            <div className="emoji-picker" role="dialog" aria-label="Emoji picker">
              <span className="emoji-picker-label">Chatika originals</span>
              <div className="chatika-emoji-grid">
                {CHATIKA_EMOJIS.map((emoji) => (
                  <button key={emoji.code} type="button" className="chatika-emoji-choice" onClick={() => addEmoji(emoji.code)} aria-label={`Add ${emoji.label}`} title={emoji.label}>
                    <ChatikaEmoji emoji={emoji} />
                  </button>
                ))}
              </div>
              <span className="emoji-picker-label">Quick picks</span>
              <div className="quick-emoji-grid">
                {QUICK_EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => addEmoji(emoji)} aria-label={`Add ${emoji}`}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="submit" disabled={!activeRoomId}>
            Send <span aria-hidden="true">↗</span>
          </button>
        </form>
      </main>
    </div>
  );
}

function ChatikaEmoji({ emoji }) {
  return (
    <span className={`chatika-emoji ${emoji.variant}`} role="img" aria-label={emoji.label} title={emoji.label}>
      {emoji.glyph}
    </span>
  );
}
