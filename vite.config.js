import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // ESTO ES CRÍTICO: Elimina el error amarillo
    outDir: 'dist',
  },
  esbuild: {
    target: 'esnext',
  }
})
