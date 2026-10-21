import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    // Hand the service worker the files this page is using, so Xorla can open next time even with no internet
    navigator.serviceWorker.ready.then((reg) => {
      const urls = [
        ...[...document.querySelectorAll('script[src]')].map((s) => s.src),
        ...[...document.querySelectorAll('link[rel="stylesheet"][href], link[rel="modulepreload"][href]')].map((l) => l.href),
        ...performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /\/assets\/|fonts\.(googleapis|gstatic)\.com/.test(n)),
      ];
      (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: 'xorla-warm', urls: [...new Set(urls)] });
    }).catch(() => {});
  });
}
