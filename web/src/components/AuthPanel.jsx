import React, { useState } from 'react';
import { APP_CREDIT, APP_VERSION } from '../lib/version';

export default function AuthPanel({ mode, onModeChange, onSubmit, onForgotPassword, loading }) {
  const [form, setForm] = useState({
    username: '',
    password: '',
    device_name: browserDeviceName(),
    locale: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [resetStatus, setResetStatus] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  async function handleForgotPassword() {
    if (!form.username.trim() || resetSubmitting) return;
    setResetSubmitting(true);
    setResetStatus('');
    try {
      const message = await onForgotPassword(form.username.trim());
      setResetStatus(message || 'Request sent.');
    } catch (_error) {
      setResetStatus('Could not send the request right now. Please try again.');
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <section className="auth-panel">
      <div className="auth-brand-row">
        <img src="/logo.svg" alt="Chatika logo" className="brand-logo" />
        <span className="status-chip"><span className="status-dot" /> Private workspace</span>
      </div>
      <span className="eyebrow">YOUR PEOPLE, IN ONE PLACE</span>
      <h1>{mode === 'login' ? 'Welcome back.' : 'Make space for better conversations.'}</h1>
      <p className="auth-intro">A calm, private place for messages, calls, and focused collaboration across your devices.</p>

      <div className="mode-switch">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')}>
          Login
        </button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => onModeChange('register')}>
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <label>
          Username
          <input autoComplete="username" enterKeyHint="next" value={form.username} onChange={(e) => update('username', e.target.value)} required minLength={3} />
        </label>

        <label>
          <span className="label-row"><span>Password</span><small>8+ characters</small></span>
          <span className="password-field">
            <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} enterKeyHint="go" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
          </span>
        </label>

        <button disabled={loading} type="submit" className="cta-btn">
          <span>{loading ? 'Connecting...' : mode === 'login' ? 'Continue to Chatika' : 'Create my account'}</span>
          {!loading && <span aria-hidden="true">→</span>}
        </button>
      </form>
      {mode === 'login' && (
        <div className="forgot-password-row">
          <button type="button" className="forgot-password-link" onClick={handleForgotPassword} disabled={resetSubmitting || !form.username.trim()}>
            {resetSubmitting ? 'Sending…' : 'Forgot password?'}
          </button>
          {resetStatus && <small className="forgot-password-status">{resetStatus}</small>}
        </div>
      )}
      <div className="auth-footer"><span className="status-dot" /> No tracking. No noisy notifications. Just your conversations.</div>
      <footer className="app-credit">{APP_CREDIT} · {APP_VERSION}</footer>
    </section>
  );
}

function browserDeviceName() {
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Browser';
  const formFactor = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile web' : 'desktop web';
  return `${platform} · ${formFactor}`;
}
