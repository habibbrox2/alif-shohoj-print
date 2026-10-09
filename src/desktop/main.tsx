/**
 * Desktop shell entry — the only renderer the Electron EXE loads.
 *
 * index.html remains the Vite dev harness and the browser POS that counter PCs
 * open, and pwa.html is the phone flow, so the shopkeeper shell is never mixed
 * with the customer screens.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudioProvider } from '../shared/context/StudioContext';
import { ThemeProvider } from '../shared/context/ThemeContext';
import { I18nProvider } from '../shared/i18n/I18nContext';
import { DesktopApp } from '../features/desktop/DesktopApp';
import { registerServiceWorker } from '../shared/services/registerServiceWorker';
import '../index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing in desktop.html');

registerServiceWorker();

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <StudioProvider initialView="windows_agent">
          <DesktopApp />
        </StudioProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
