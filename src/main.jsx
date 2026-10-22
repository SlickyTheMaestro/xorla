import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Xorla's fonts ship with the app itself (no Google Fonts), so they load fast, look the same on every visit and work offline
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import '@fontsource/unbounded/600.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/800.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './index.css';

// Phones offer "Install app" before a screen's own code has loaded, so keep the offer for the screen to use
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    if (/^\/(ride|riders?)\/?$/.test(window.location.pathname)) e.preventDefault();
    window.__xorlaInstall = e;
    window.dispatchEvent(new Event('xorla-install-ready'));
  });
  window.addEventListener('appinstalled', () => { window.__xorlaInstall = null; window.dispatchEvent(new Event('xorla-install-ready')); });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    // Hand the service worker the files this page is using, so Xorla can open next time even with no internet
    const warm = () => navigator.serviceWorker.ready.then((reg) => {
      const urls = [
        ...[...document.querySelectorAll('script[src]')].map((s) => s.src),
        ...[...document.querySelectorAll('link[rel="stylesheet"][href], link[rel="modulepreload"][href]')].map((l) => l.href),
        ...performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes('/assets/')),
      ];
      (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: 'xorla-warm', urls: [...new Set(urls)] });
    }).catch(() => {});
    warm();
    // Screens load in parts: tell it again once the screen's own files have arrived, so the next visit works offline too
    setTimeout(warm, 6000);
  });
}
