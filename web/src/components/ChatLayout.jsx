import React from 'react';

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
  onApprove
}) {
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

  function submitMessage(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = String(form.get('text') || '').trim();
    if (!text || !activeRoomId) return;
    onSend(text);
    e.currentTarget.reset();
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

  return (
    <div className="chat-root">
      <aside className="sidebar glass">
        <div className="sidebar-head">
          <img src="/logo.svg" alt="Chatika" className="mini-logo" />
          <div>
            <h2>{me.username}</h2>
            <small>{statusText}</small>
          </div>
        </div>

        <form onSubmit={submitRoom} className="new-room">
          <input name="name" placeholder="Room name" required />
          <input name="participant_ids" placeholder="Participant IDs (comma separated)" />
          <button type="submit">Create</button>
        </form>

        <div className="room-list">
          {rooms.map((room) => (
            <button
              key={room.id}
              className={room.id === activeRoomId ? 'room-item active' : 'room-item'}
              onClick={() => onSelectRoom(room.id)}
            >
              <span>{room.name}</span>
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
        <header>
          <h2>{activeRoom ? activeRoom.name : 'Select a room'}</h2>
          <small>{activeRoom ? (activeRoom.is_group ? 'Group call ready' : 'Private chat ready') : ''}</small>
        </header>

        <section className="messages">
          {messages.map((m) => (
            <article key={m.id} className={m.sender_id === me.id ? 'msg mine' : 'msg'}>
              <p>{m.text || `[${m.message_type}]`}</p>
              <time>{new Date(m.created_at).toLocaleTimeString()}</time>
            </article>
          ))}
        </section>

        <form onSubmit={submitMessage} className="composer">
          <input name="text" placeholder="Write a message..." disabled={!activeRoomId} />
          <button type="submit" disabled={!activeRoomId}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
