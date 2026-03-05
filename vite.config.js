import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { cursorRelayPlugin } from './vite-plugin-cursor-relay'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cursorRelayPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
