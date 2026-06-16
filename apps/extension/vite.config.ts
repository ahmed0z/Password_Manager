import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vaultsync/core': resolve(__dirname, '../../packages/core/src'),
      '@vaultsync/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel/index.html'),
        'service-worker': resolve(__dirname, 'src/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'service-worker') return 'service-worker.js';
          return 'sidepanel/[name].js';
        },
      },
    },
  },
  define: {
    'process.env': JSON.stringify({
      SUPABASE_URL: 'https://nbzrgenezurnecdmikxl.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ienJnZW5lenVybmVjZG1pa3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Mjc1NzksImV4cCI6MjA5NjMwMzU3OX0.y1tmfWvIWXaeLbCFJHMJk7fggQhSrCcbXyqWxLWHj1w',
      ENCRYPTION_ITERATIONS: '10000',
    }),
  },
});

