import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built app works at any GitHub Pages path
export default defineConfig({
  plugins: [react()],
  base: './',
});
