import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// Stamped at build/dev-server start so the running page can say WHICH build it
// is. Three rounds of a visual bug were spent editing code while looking at the
// deployed site (note 186) — this is the instrument that makes that a glance
// instead of a conversation.
const BUILD_STAMP = new Date().toISOString();

export default defineConfig({
  define: { __BUILD_STAMP__: JSON.stringify(BUILD_STAMP) },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
