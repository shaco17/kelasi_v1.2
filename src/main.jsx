import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const RELOAD_GUARD = 'kelasi-sw-reload-guard';
  const reloadToast = 'kelasi-sw-update-toast';
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || sessionStorage.getItem(RELOAD_GUARD) === '1') return;
    reloading = true;
    sessionStorage.setItem(RELOAD_GUARD, '1');
    sessionStorage.setItem(reloadToast, '1');
    window.location.reload();
  });
  navigator.serviceWorker.register('/sw.js').then(async registration => {
    await registration.update().catch(() => {});
    if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }).catch(() => {});
}
