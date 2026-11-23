import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = process.env.VITE_API_PROXY ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  // @kiwanja/client is shared with the mobile app: always use this app's single copy of these.
  resolve: { dedupe: ['react', 'react-dom', '@tanstack/react-query', 'socket.io-client'] },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': api,
      '/socket.io': { target: api, ws: true },
    },
  },
  test: { environment: 'node' },
} as never);
