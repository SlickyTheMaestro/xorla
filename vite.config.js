import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // One file for the icons and one for charts, instead of dozens of tiny downloads
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (/node_modules\/(recharts|d3-|victory-vendor|react-smooth|recharts-scale|decimal\.js-light|lodash|eventemitter3|internmap|tiny-invariant|clsx|react-is|fast-equals)/.test(id)) return 'charts';
        },
      },
    },
  },
});
