import { defineConfig } from 'vite';
import { resolve } from 'path';

// Dedicated build config for the content script.
// Content scripts in Chrome MV3 run as classic scripts (not ES modules),
// so we must output a self-contained IIFE with no import statements.
export default defineConfig({
  resolve: {
    alias: {
      '@vaultsync/core': resolve(__dirname, '../../packages/core/src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't wipe the primary build output
    rollupOptions: {
      input: {
        'content/autofill': resolve(__dirname, 'src/content/autofill.ts'),
      },
      output: {
        format: 'iife',
        entryFileNames: '[name].js',
        inlineDynamicImports: false,
      },
    },
  },
  define: {
    'process.env': JSON.stringify({}),
  },
});
