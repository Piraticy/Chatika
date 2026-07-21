import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppLifecyclePrompts from './components/AppLifecyclePrompts';
import './styles/app.css';
import { registerPwa } from './pwa';

if (!import.meta.env.DEV) registerPwa();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <>
      <App />
      <AppLifecyclePrompts />
    </>
  </React.StrictMode>
);
