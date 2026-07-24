import React, { useMemo, useState } from 'react';
import { avatarGradient, avatarInitial } from '../lib/avatar';

export default function AdminPanel({ open, users = [], feedback = [], passwordResetRequests = [], loading, error, onClose, onRefresh, onApprove, onRemove, onResetPassword }) {
  const [query, setQuery] = useState('');
  const [resetInputs, setResetInputs] = useState({});
  const [resettingId, setResettingId] = useState('');
  const [resetFeedback, setResetFeedback] = useState({});

  const analytics = useMemo(() => buildAnalytics(users), [users]);
  const feedbackAnalytics = useMemo(() => buildFeedbackAnalytics(feedback), [feedback]);
  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => [
      user.username || '',
      countryName(user.country_code),
      user.country_code,
      user.device,
      user.timezone
    ].some((value) => value?.toLowerCase().includes(needle)));
  }, [query, users]);

  if (!open) return null;

  async function submitReset(userId) {
    const newPassword = (resetInputs[userId] || '').trim();
    if (newPassword.length < 8 || resettingId) return;
    setResettingId(userId);
    setResetFeedback((prev) => ({ ...prev, [userId]: '' }));
    try {
      await onResetPassword(userId, newPassword);
      setResetInputs((prev) => ({ ...prev, [userId]: '' }));
    } catch (submitError) {
      setResetFeedback((prev) => ({ ...prev, [userId]: submitError.message || 'Could not reset the password.' }));
    } finally {
      setResettingId('');
    }
  }

  return (
    <div className="modal-backdrop admin-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <header className="admin-panel-head">
          <div>
            <span className="eyebrow">ADMIN ANALYTICS</span>
            <h2 id="admin-title">Chatika community</h2>
            <p>Live account, location, and device insights without storing raw IP addresses.</p>
          </div>
          <div className="admin-panel-actions">
            <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh analytics">↻</button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close admin panel">×</button>
          </div>
        </header>

        <div className="admin-metrics" aria-label="User totals">
          <Metric label="Total users" value={analytics.total} accent="aqua" />
          <Metric label="Online now" value={analytics.online} accent="green" />
          <Metric label="Joined this week" value={analytics.newThisWeek} accent="coral" />
          <Metric label="Countries" value={analytics.countryCount} accent="violet" />
        </div>

        <div className="admin-insights">
          <section className="admin-insight-card">
            <div className="admin-insight-title"><strong>Top countries</strong><span>{analytics.knownLocations} located</span></div>
            <div className="admin-breakdown-list">
              {analytics.countries.length ? analytics.countries.slice(0, 6).map((item) => (
                <Breakdown key={item.name} icon={countryFlag(item.code)} label={item.name} value={item.count} total={analytics.total} />
              )) : <small>Location appears after a user signs up or logs in.</small>}
            </div>
          </section>
          <section className="admin-insight-card">
            <div className="admin-insight-title"><strong>Devices</strong><span>Latest login</span></div>
            <div className="admin-breakdown-list">
              {analytics.devices.map((item) => (
                <Breakdown key={item.name} icon={deviceIcon(item.name)} label={item.name} value={item.count} total={analytics.total} />
              ))}
            </div>
          </section>
        </div>

        <section className="admin-feedback-card">
          <div className="admin-insight-title"><strong>Beta feedback</strong><span>{feedback.length} response{feedback.length === 1 ? '' : 's'}</span></div>
          <div className="feedback-summary">
            <Metric label="Average rating" value={feedbackAnalytics.average ? `${feedbackAnalytics.average}/5` : '—'} accent="green" />
            <div className="feedback-priority"><span>Top improvement</span><strong>{feedbackAnalytics.topImprovement || 'Waiting for feedback'}</strong></div>
            <div className="feedback-priority"><span>Most loved</span><strong>{feedbackAnalytics.topFavorite || 'Waiting for feedback'}</strong></div>
          </div>
          <div className="feedback-list">
            {feedback.slice(0, 8).map((item) => (
              <article key={item.id}>
                <div><strong>@{item.username}</strong><span>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span></div>
                <small>{feedbackLabel(item.favorite_feature)} · Improve {feedbackLabel(item.improvement_area)}</small>
                {item.comment && <p>{item.comment}</p>}
                <time>{item.created_at ? formatDate(item.created_at) : ''} · {item.platform || 'unknown'} · {item.app_version || 'beta'}</time>
              </article>
            ))}
            {!feedback.length && <small>No beta responses yet.</small>}
          </div>
        </section>

        {Boolean(passwordResetRequests.length) && (
          <section className="admin-feedback-card password-reset-card">
            <div className="admin-insight-title"><strong>Password reset requests</strong><span>{passwordResetRequests.length} pending</span></div>
            <div className="password-reset-list">
              {passwordResetRequests.map((request) => (
                <article key={request.id} className="password-reset-row">
                  <div className="user-details">
                    <strong>@{request.username}</strong>
                    <small>Requested {request.requested_at ? formatDate(request.requested_at) : 'recently'}{request.phone_number ? ` · ${request.phone_number}` : ''}</small>
                  </div>
                  <div className="password-reset-form">
                    <input
                      type="text"
                      placeholder="New password (8+ characters)"
                      minLength={8}
                      value={resetInputs[request.id] || ''}
                      onChange={(event) => setResetInputs((prev) => ({ ...prev, [request.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="user-action approve"
                      disabled={(resetInputs[request.id] || '').trim().length < 8 || resettingId === request.id}
                      onClick={() => submitReset(request.id)}
                    >
                      {resettingId === request.id ? 'Setting…' : 'Set password'}
                    </button>
                  </div>
                  {resetFeedback[request.id] && <small className="password-reset-error">{resetFeedback[request.id]}</small>}
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="admin-toolbar">
          <label className="admin-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user, country, or device" aria-label="Search users" />
          </label>
          <span>{filteredUsers.length} of {users.length} accounts</span>
        </div>

        {error && <div className="notice-card error-card">{error}</div>}
        {loading ? (
          <div className="admin-empty">Loading community analytics…</div>
        ) : !filteredUsers.length ? (
          <div className="admin-empty">No users match this search.</div>
        ) : (
          <div className="user-table" role="table" aria-label="Chatika users">
            {filteredUsers.map((user) => (
              <article className="user-row" key={user.id}>
                {user.avatar_url
                  ? <img className="user-avatar" src={user.avatar_url} alt="" />
                  : <span className="user-avatar" style={avatarGradient(user.id || user.username)}>{avatarInitial(user.username)}</span>}
                <div className="user-details">
                  <strong>@{user.username}</strong>
                  <small>{presenceLabel(user)}</small>
                </div>
                <div className="user-origin">
                  <strong>{countryFlag(user.country_code)} {countryName(user.country_code)}</strong>
                  <small>{user.timezone || user.locale || 'Location not available'}</small>
                </div>
                <div className="user-device">
                  <strong>{deviceIcon(deviceCategory(user.device))} {deviceCategory(user.device)}</strong>
                  <small>{user.device || 'Unknown device'}</small>
                </div>
                <div className="user-joined">
                  <strong>{user.created_at ? formatDate(user.created_at) : 'Unknown'}</strong>
                  <small>Joined</small>
                </div>
                <div className="user-admin-actions">
                  <span className={user.is_approved ? 'account-status approved' : 'account-status pending'}>{user.is_approved ? 'Active' : 'Pending'}</span>
                  {user.is_admin ? <span className="admin-badge">Admin</span> : (
                    <button className="user-action remove" type="button" onClick={() => onRemove(user.id, user.username)}>Remove</button>
                  )}
                  {!user.is_approved && <button className="user-action approve" type="button" onClick={() => onApprove(user.id)}>Approve</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, accent }) {
  return <article className={`admin-metric ${accent}`}><strong>{value}</strong><span>{label}</span></article>;
}

function Breakdown({ icon, label, value, total }) {
  const width = total ? Math.max(5, Math.round((value / total) * 100)) : 0;
  return (
    <div className="admin-breakdown">
      <span>{icon}</span><strong>{label}</strong><i><b style={{ width: `${width}%` }} /></i><small>{value}</small>
    </div>
  );
}

function buildAnalytics(users) {
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const countries = countBy(users.filter((user) => user.country_code), (user) => user.country_code)
    .map(({ name: code, count }) => ({ code, name: countryName(code), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const devices = countBy(users, (user) => deviceCategory(user.device)).sort((a, b) => b.count - a.count);
  return {
    total: users.length,
    online: users.filter((user) => user.is_online).length,
    newThisWeek: users.filter((user) => user.created_at && new Date(user.created_at).getTime() >= weekAgo).length,
    countryCount: countries.length,
    knownLocations: users.filter((user) => user.country_code).length,
    countries,
    devices
  };
}

function buildFeedbackAnalytics(feedback) {
  if (!feedback.length) return { average: 0, topFavorite: '', topImprovement: '' };
  const average = (feedback.reduce((total, item) => total + item.rating, 0) / feedback.length).toFixed(1);
  const topFavorite = countBy(feedback, (item) => item.favorite_feature).sort((a, b) => b.count - a.count)[0]?.name;
  const topImprovement = countBy(feedback, (item) => item.improvement_area).sort((a, b) => b.count - a.count)[0]?.name;
  return { average, topFavorite: feedbackLabel(topFavorite), topImprovement: feedbackLabel(topImprovement) };
}

function feedbackLabel(value) {
  return ({ messaging: 'Messaging', calls: 'Calls', media: 'Photos & voice', design: 'Design', speed: 'Speed', reliability: 'Reliability', mobile_ui: 'Mobile layout', notifications: 'Notifications', other: 'Other' })[value] || value || 'Unknown';
}

function countBy(items, getKey) {
  const counts = new Map();
  items.forEach((item) => {
    const key = getKey(item) || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts].map(([name, count]) => ({ name, count }));
}

function countryName(code) {
  if (!code) return 'Unknown country';
  try {
    return new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(code) || code;
  } catch (_error) {
    return code;
  }
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(...code.toUpperCase().split('').map((letter) => 127397 + letter.charCodeAt(0)));
}

function deviceCategory(value) {
  const device = String(value || '').toLowerCase();
  if (device.includes('android')) return 'Android';
  if (device.includes('iphone') || device.includes('ipad') || device.includes('ios')) return 'iOS';
  if (device.includes('mac')) return 'macOS';
  if (device.includes('windows') || device.includes('win32')) return 'Windows';
  if (device.includes('linux')) return 'Linux';
  if (device.includes('web') || device.includes('browser')) return 'Web';
  return 'Other';
}

function deviceIcon(device) {
  return ({ Android: '🤖', iOS: '📱', macOS: '💻', Windows: '🖥️', Linux: '⌨️', Web: '🌐', Other: '◌' })[device] || '◌';
}

function presenceLabel(user) {
  if (user.is_online) return 'Online now';
  return user.last_seen_at ? `Last seen ${new Date(user.last_seen_at).toLocaleString()}` : 'Never connected';
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
