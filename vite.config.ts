/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import canvasApiPlugin from './src/server/plugin';

export default defineConfig({
  plugins: [react(), canvasApiPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules', 'xyflow/**', 'Automation-workflow-examples/**'],
  },
});
