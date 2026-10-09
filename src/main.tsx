import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './shared/services/registerServiceWorker';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing in index.html');

registerServiceWorker();

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
