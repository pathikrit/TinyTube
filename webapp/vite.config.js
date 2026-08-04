import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base path only matters for the GH Pages build; dev serves at /
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? (process.env.BASE_PATH ?? '/TinyTube/') : '/',
}))
