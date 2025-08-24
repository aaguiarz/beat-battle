import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/auth': 'http://127.0.0.1:4000',
      '/api': 'http://127.0.0.1:4000'
    }
  }
});
