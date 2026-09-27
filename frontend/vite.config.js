import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev` only: forward /api to a local backend, like Nginx does in production
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
