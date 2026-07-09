import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// stellar-sdk pulls in Node-only polyfill code (util/process) that expects
// `process`/`global` to exist; Vite doesn't provide these in the browser by
// default, which crashes the app before React can mount.
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
})
