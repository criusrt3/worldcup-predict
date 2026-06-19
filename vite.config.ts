import { defineConfig } from 'vite'

const proxy = {
  '/api/llm': {
    target: 'https://api.deepseek.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/llm/, ''),
  },
  '/api/espn': {
    target: 'https://site.api.espn.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/espn/, ''),
  },
}

export default defineConfig({
  server: {
    port: 5174,
    proxy,
  },
  preview: {
    port: 5174,
    proxy,
  },
})
