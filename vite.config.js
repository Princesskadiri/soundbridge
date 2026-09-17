import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { createBackend } from './server/backend.js';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const attach = server => { const backend = createBackend({ database: env.SOUNDBRIDGE_DATABASE || '.data/soundbridge.sqlite', apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, spotifyClientId: env.SPOTIFY_CLIENT_ID, spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET }); server.middlewares.use(backend); server.httpServer?.once('close', () => backend.close()); };
  return { server: { fs: { deny: ['**/.env*', '**/.git/**', '**/.data/**', '**/server/**', '**/*.sqlite*', '**/*.{pem,crt,key}', resolve(env.SOUNDBRIDGE_DATABASE || '.data/soundbridge.sqlite')] } }, optimizeDeps: { entries: ['index.html'] }, plugins: [react(), { name: 'soundbridge-ai', configureServer: attach, configurePreviewServer: attach }] };
});
