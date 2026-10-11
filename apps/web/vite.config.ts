import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { fileURLToPath, URL } from 'node:url';

/**
 * Light obfuscation of the chunks made only of our code; libraries stay as published.
 * It runs on the bundled chunks so lazy routes are already resolved, keeps chunk paths
 * readable and never uses eval (strict CSP). A deterrent: the real protection is in the API.
 */
function obfuscateOwnChunks(): Plugin {
  return {
    name: 'ludoteka:obfuscate-own-chunks',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      const ids = chunk.moduleIds.filter((id) => !id.startsWith('\0'));
      if (!ids.length || ids.some((id) => id.includes('/node_modules/'))) return null;
      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        identifierNamesGenerator: 'mangled',
        stringArray: true,
        stringArrayThreshold: 0.6,
        stringArrayEncoding: [],
        reservedStrings: ['^\\.{1,2}/', '\\.(js|css|svg|png|json)$', '^/'],
        splitStrings: false,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        selfDefending: false,
        debugProtection: false,
        renameGlobals: false,
        transformObjectKeys: false,
        unicodeEscapeSequence: false,
        sourceMap: false,
        target: 'browser',
      });
      return { code: result.getObfuscatedCode(), map: null };
    },
  };
}

/** Libraries in their own chunks so the app chunks contain only our code. */
function vendorChunk(id: string) {
  if (!id.includes('/node_modules/')) return undefined;
  if (id.includes('/@vladmandic/face-api/')) return 'face-api';
  return 'vendor';
}

// Lightning CSS encodes versions as major << 16 | minor << 8.
const v = (major: number, minor = 0) => (major << 16) | (minor << 8);
const cssTargets = { safari: v(14), ios_saf: v(14), chrome: v(90), android: v(90), firefox: v(90), edge: v(90), samsung: v(14) };

export default defineConfig({
  plugins: [
    react(),
    obfuscateOwnChunks(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'theme-init.js'],
      manifest: {
        name: 'Ludoteka Campus · Colegio Francisco Arango',
        short_name: 'Ludoteka',
        description: 'Campus virtual gamificado del Colegio Francisco Arango',
        theme_color: '#140f2e',
        background_color: '#140f2e',
        display: 'standalone',
        lang: 'es',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  css: {
    transformer: 'lightningcss',
    lightningcss: { targets: cssTargets },
  },
  build: {
    target: ['es2020', 'safari14', 'chrome90', 'firefox90', 'edge90'],
    cssTarget: ['safari14', 'chrome90', 'firefox90', 'edge90'],
    cssMinify: 'lightningcss',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { manualChunks: vendorChunk } },
  },
  esbuild: { legalComments: 'none' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@eduquest/contracts': fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.PORT ?? 3000}`,
      '/socket.io': { target: `http://127.0.0.1:${process.env.PORT ?? 3000}`, ws: true },
    },
  },
});
