import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { SyncManager } from './lib/syncManager';

// Register Service Worker for offline support safely in sandbox contexts
try {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  if (!isIframe && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    registerSW({ 
      immediate: true,
      onRegisterError(err) {
        console.warn('Service worker registration failed:', err);
      }
    });
  } else if (isIframe) {
    console.log('Bypassing Service Worker registration inside iframe sandbox.');
  }
} catch (e) {
  console.warn('Service worker registration not supported in this frame context:', e);
}

// Initialize Sync Manager
SyncManager.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
