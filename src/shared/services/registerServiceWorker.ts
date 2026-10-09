/**
 * Registers the offline audio service worker. Shared by every renderer entry
 * (desktop shell, customer PWA and the dev/preview harness) so the three
 * entries cannot drift apart.
 */
export const registerServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('SW registered:', registration.scope);
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New SW version available');
            }
          });
        });
      },
      (error) => {
        console.log('SW registration failed:', error);
      }
    );
  });
};
