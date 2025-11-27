import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // ESTO ES LO IMPORTANTE: Permite leer claves modernas
  },
  esbuild: {
    target: 'esnext',
  }
})
