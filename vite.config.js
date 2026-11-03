import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Stamps a unique build id into dist/sw.js so each deploy refreshes the offline cache.
const stampServiceWorker = () => ({
  name: 'stamp-sw',
  apply: 'build',
  closeBundle() {
    const file = fileURLToPath(new URL('./web/dist/sw.js', import.meta.url));
    if (!existsSync(file)) return;
    const id = Date.now().toString(36);
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', id));
  },
});

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  root: 'web',
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  server: {
    host: true, // reachable from your phone on the same Wi-Fi
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800, // the Firebase SDK is most of the bundle
  },
  plugins: [stampServiceWorker()],
});
