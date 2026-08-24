import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://<owner>.github.io/lokalfinder/landing/ on GitHub Pages.
  base: command === 'build' ? '/lokalfinder/landing/' : '/',
  plugins: [react()],
}))
