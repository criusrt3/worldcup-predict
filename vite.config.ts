import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5174,
    proxy: {
      '/api/llm': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llm/, ''),
      },
      '/api/espn': {
        target: 'https://site.api.espn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/espn/, ''),
      },
    },
  },
})
