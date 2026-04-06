import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { SyncManager } from './lib/syncManager';

// Register Service Worker for offline support
registerSW({ immediate: true });

// Initialize Sync Manager
SyncManager.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
