import React, { useState } from 'react';

export default function AuthPanel({ mode, onModeChange, onSubmit, loading }) {
  const [form, setForm] = useState({
    username: '',
    phone_number: '',
    password: '',
    device_name: 'Web Device'
  });

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <section className="auth-panel glass">
      <img src="/logo.svg" alt="Chatika logo" className="brand-logo" />
      <h1>Chatika</h1>
      <p>Private by design. Built for bold communication.</p>

      <div className="mode-switch">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')}>
          Login
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => onModeChange('register')}>
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <label>
            Username
            <input value={form.username} onChange={(e) => update('username', e.target.value)} required minLength={3} />
          </label>
        )}

        <label>
          Phone Number
          <input value={form.phone_number} onChange={(e) => update('phone_number', e.target.value)} required />
        </label>

        <label>
          Password
          <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} />
        </label>

        <button disabled={loading} type="submit" className="cta-btn">
          {loading ? 'Please wait...' : mode === 'login' ? 'Enter Chatika' : 'Create Account'}
        </button>
      </form>
    </section>
  );
}
