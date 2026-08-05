import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function commitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA // GH Actions
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

// base path only matters for the GH Pages build; dev serves at /
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? (process.env.BASE_PATH ?? '/TinyTube/') : '/',
  define: { __COMMIT_SHA__: JSON.stringify(commitSha()) },
  // globals so testing-library auto-cleans between tests
  test: { include: ['test/**/*.test.{js,jsx}'], environment: 'jsdom', globals: true },
}))
