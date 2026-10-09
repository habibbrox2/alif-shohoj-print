import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const entry = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // Three separate renderers: the Windows desktop shell that Electron loads,
      // the customer PWA served to phones on the shop LAN, and index.html which
      // stays the Vite dev harness / browser POS for counter PCs.
      input: {
        index: entry('index.html'),
        desktop: entry('desktop.html'),
        pwa: entry('pwa.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:43822',
        changeOrigin: true,
      },
    },
  },
});
