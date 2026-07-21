import React, { useMemo, useState } from 'react';

export default function AdminPanel({ open, users, loading, error, onClose, onRefresh, onApprove, onRemove }) {
  const [query, setQuery] = useState('');

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => user.username.toLowerCase().includes(needle));
  }, [query, users]);

  if (!open) return null;

  return (
    <div className="modal-backdrop admin-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <header className="admin-panel-head">
          <div>
            <span className="eyebrow">ADMIN CONTROL</span>
            <h2 id="admin-title">Global user directory</h2>
            <p>See every registered account, regardless of country or device.</p>
          </div>
          <div className="admin-panel-actions">
            <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh users">↻</button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close admin panel">×</button>
          </div>
        </header>

        <div className="admin-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search usernames" aria-label="Search usernames" />
          <span>{users.length} accounts</span>
        </div>

        {error && <div className="notice-card error-card">{error}</div>}
        {loading ? (
          <div className="admin-empty">Loading the global directory…</div>
        ) : !filteredUsers.length ? (
          <div className="admin-empty">No users match this search.</div>
        ) : (
          <div className="user-table" role="table" aria-label="Global user directory">
            {filteredUsers.map((user) => (
              <article className="user-row" key={user.id}>
                <span className="user-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
                <div className="user-details">
                  <strong>@{user.username}</strong>
                  <small>{user.is_online ? 'Online now' : user.last_seen_at ? `Last seen ${formatDate(user.last_seen_at)}` : 'Never connected'}</small>
                </div>
                <span className={user.is_approved ? 'account-status approved' : 'account-status pending'}>{user.is_approved ? 'Active' : 'Pending'}</span>
                {user.is_admin ? <span className="admin-badge">Admin</span> : (
                  <button className="user-action remove" type="button" onClick={() => onRemove(user.id, user.username)}>Remove</button>
                )}
                {!user.is_approved && <button className="user-action approve" type="button" onClick={() => onApprove(user.id)}>Approve</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
