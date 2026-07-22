import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppLifecyclePrompts from './components/AppLifecyclePrompts';
import './styles/app.css';
import { registerPwa } from './pwa';

function syncViewportFrame() {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty('--app-height', `${Math.round(viewport?.height || window.innerHeight)}px`);
  document.documentElement.style.setProperty('--app-top', `${Math.round(viewport?.offsetTop || 0)}px`);
}

syncViewportFrame();
window.addEventListener('resize', syncViewportFrame, { passive: true });
window.addEventListener('orientationchange', syncViewportFrame, { passive: true });
window.visualViewport?.addEventListener('resize', syncViewportFrame, { passive: true });
window.visualViewport?.addEventListener('scroll', syncViewportFrame, { passive: true });

if (!import.meta.env.DEV) registerPwa();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <>
      <App />
      <AppLifecyclePrompts />
    </>
  </React.StrictMode>
);
