/**
 * Customer PWA entry.
 *
 * Loaded on customer phones from the shop LAN (`/pwa.html` on the local
 * gateway). It renders only the customer order flow — never the shopkeeper
 * shell — so no shop-side state or navigation ships to the phone.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudioProvider } from '../shared/context/StudioContext';
import { ThemeProvider } from '../shared/context/ThemeContext';
import { CustomerPwaView } from '../features/customer-pwa/CustomerPwaView';
import { registerServiceWorker } from '../shared/services/registerServiceWorker';
import '../index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing in pwa.html');

registerServiceWorker();

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      <StudioProvider initialView="customer_pwa">
        <CustomerPwaView />
      </StudioProvider>
    </ThemeProvider>
  </React.StrictMode>
);
