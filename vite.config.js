import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — чтобы сайт работал на GitHub Pages по адресу user.github.io/repo/
export default defineConfig({
  plugins: [react()],
  base: './',
})
