import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Planner is a static SPA: it will be deployed to Firebase Hosting and talks to
// Firebase directly from the browser, so there is no application server here.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Firebase SDK は更新頻度が低いので別チャンクに分けてキャッシュを効かせます。
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
