import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version) },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
} as any);
