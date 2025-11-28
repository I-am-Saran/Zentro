import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ✅ Vite + React Router + Vercel compatible config
export default defineConfig({
  plugins: [react()],
  base: '/', // 👈 This is crucial for correct routing in production
  appType: 'spa', // ensure dev server serves index.html for all routes
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      // Forward API calls to FastAPI backend during development
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: [], // keep empty
    }, // 👈 Vercel expects build output here
  },
  optimizeDeps: {
    include: ['react-data-table-component', 'file-saver', 'xlsx'],
  },
});