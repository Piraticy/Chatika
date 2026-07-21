import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppLifecyclePrompts from './components/AppLifecyclePrompts';
import './styles/app.css';
import { registerPwa } from './pwa';

function syncViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
}

syncViewportHeight();
window.addEventListener('resize', syncViewportHeight, { passive: true });
window.visualViewport?.addEventListener('resize', syncViewportHeight, { passive: true });

if (!import.meta.env.DEV) registerPwa();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <>
      <App />
      <AppLifecyclePrompts />
    </>
  </React.StrictMode>
);
