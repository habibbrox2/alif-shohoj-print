import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './shared/services/registerServiceWorker';
import '../resources/assets/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing in resources/index.html');

registerServiceWorker();

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
