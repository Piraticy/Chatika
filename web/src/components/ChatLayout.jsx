import React, { useEffect, useMemo, useRef, useState } from 'react';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '😎', '💬', '❤️', '😭', '🤝'];

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
  typingUsers
}) {
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const messagesRef = useRef(null);
  const composerRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
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

  function addEmoji(emoji) {
    const next = `${draft}${emoji}`;
    setDraft(next);
    onTyping?.(Boolean(next.trim()));
  }

  return (
    <div className="chat-root">
      <aside className="sidebar glass">
        <div className="sidebar-head">
          <img src="/logo.svg" alt="Chatika" className="mini-logo" />
          <div className="identity">
            <h2>@{me.username}</h2>
            <small>{statusText}</small>
          </div>
        </div>

        <form onSubmit={submitRoom} className="new-room">
          <input name="name" placeholder="Create room name" required />
          <input name="participant_ids" placeholder="Participant IDs (comma separated)" />
          <button type="submit">Create Room</button>
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
            <h3>Admin approvals</h3>
            {pendingUsers.map((u) => (
              <div className="pending-user" key={u.id}>
                <span>{u.username}</span>
                <button onClick={() => onApprove(u.id)}>Approve</button>
              </div>
            ))}
          </section>
        )}
      </aside>

      <main className="thread glass">
        <header className="thread-head">
          <div>
            <h2>{activeRoom ? activeRoom.name : 'Select a room'}</h2>
            <small>{activeRoom ? (activeRoom.is_group ? 'Group call ready' : 'Private chat ready') : ''}</small>
          </div>
          <div className="avatar-stack" aria-hidden="true">
            <span>A</span>
            <span>C</span>
            <span>K</span>
          </div>
        </header>

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
              <p>{m.text || `[${m.message_type}]`}</p>
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
            placeholder="Write a message..."
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
              {QUICK_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => addEmoji(emoji)} aria-label={`Add ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button type="submit" disabled={!activeRoomId}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
