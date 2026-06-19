import { defineConfig } from 'vite'
import type { PreviewServer, ViteDevServer } from 'vite'
import { createChatApiMiddleware } from './src/server/chat-api'

const espnProxy = {
  '/api/espn': {
    target: 'https://site.api.espn.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/espn/, ''),
  },
}

function attachChatApi(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(createChatApiMiddleware())
}

export default defineConfig({
  plugins: [
    {
      name: 'worldcup-chat-api',
      configureServer(server) {
        attachChatApi(server)
      },
      configurePreviewServer(server) {
        attachChatApi(server)
      },
    },
  ],
  server: {
    port: 5174,
    proxy: espnProxy,
  },
  preview: {
    port: 5174,
    proxy: espnProxy,
  },
})
