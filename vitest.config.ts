import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./client/src/lib/kiteframe/__tests__/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['client/src/lib/kiteframe/**/*.{ts,tsx}'],
      exclude: [
        'client/src/lib/kiteframe/__tests__/**',
        'client/src/lib/kiteframe/**/*.test.{ts,tsx}',
        'client/src/lib/kiteframe/**/*.spec.{ts,tsx}',
        'client/src/lib/kiteframe/types.ts',
        'client/src/lib/kiteframe/index.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@lib': path.resolve(__dirname, './client/src/lib'),
      '@shared': path.resolve(__dirname, './shared'),
      '@components': path.resolve(__dirname, './client/src/components'),
      '@assets': path.resolve(__dirname, './attached_assets')
    }
  }
});