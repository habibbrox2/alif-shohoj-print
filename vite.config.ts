import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const entry = (name: string) => fileURLToPath(new URL(`./resources/views/${name}`, import.meta.url));

/**
 * The entry documents live in `resources/`, but the dev server and `vite preview`
 * serve the project root at `/` and `npm run dev:desktop` waits on that URL.
 * Rewrite the root request to the counter-POS harness so both keep working.
 */
const rootDocumentMiddleware: Connect.NextHandleFunction = (request, _response, next) => {
  const url = request.url;
  if (url === '/' || url === '/index.html') {
    request.url = '/resources/views/index.html';
  } else if (url?.startsWith('/?') || url?.startsWith('/index.html?')) {
    request.url = `/resources/views/index.html${url.slice(url.indexOf('?'))}`;
  }
  next();
};

const rootDocumentRewrite = (): Plugin => ({
  name: 'root-document-rewrite',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(rootDocumentMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use(rootDocumentMiddleware);
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), rootDocumentRewrite()],
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
