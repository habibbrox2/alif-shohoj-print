/**
 * Desktop shell entry — the only renderer the Electron EXE loads.
 *
 * index.html remains the Vite dev harness and the browser POS that counter PCs
 * open, and pwa.html is the phone flow, so the shopkeeper shell is never mixed
 * with the customer screens.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudioProvider, useStudio } from '../shared/context/StudioContext';
import { ThemeProvider } from '../shared/context/ThemeContext';
import { InstallationSetup } from '../shared/components/InstallationSetup';
import { WindowsToast } from '../shared/components/WindowsToast';
import { OrderCardModal } from '../features/shop-pos/OrderCardModal';
import { CounterPosterModal } from '../features/shop-pos/CounterPosterModal';
import { WindowsExePackageModal } from '../features/print-agent/WindowsExePackageModal';
import { WindowsAgentView } from '../features/print-agent/WindowsAgentView';
import { registerServiceWorker } from '../shared/services/registerServiceWorker';
import '../index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing in desktop.html');

registerServiceWorker();

const DesktopEntry: React.FC = () => {
  const { installationConfig } = useStudio();

  if (!installationConfig) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
        <InstallationSetup />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col selection:bg-accent selection:text-accent-text">
      <main className="min-w-0 flex-1">
        <WindowsAgentView />
      </main>
      <WindowsToast />
      <OrderCardModal />
      <CounterPosterModal />
      <WindowsExePackageModal />
    </div>
  );
};

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      <StudioProvider initialView="windows_agent">
        <DesktopEntry />
      </StudioProvider>
    </ThemeProvider>
  </React.StrictMode>
);
