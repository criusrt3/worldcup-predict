import type { Connect } from 'vite'
import { forwardChatCompletion } from '../../api/_lib/chat-proxy'
import type { ChatProxyRequest } from '../../api/_lib/chat-proxy'

async function readBody(
  req: { on: (e: string, cb: (chunk: Uint8Array) => void) => void },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const merged = new Uint8Array(total)
      let offset = 0
      for (const c of chunks) {
        merged.set(c, offset)
        offset += c.length
      }
      resolve(new TextDecoder().decode(merged))
    })
    req.on('error', reject)
  })
}

function sendJson(
  res: { setHeader: (k: string, v: string) => void; statusCode: number; end: (b: string) => void },
  status: number,
  body: unknown,
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = status
  res.end(JSON.stringify(body))
}

export function createChatApiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const incoming = req as {
      url?: string
      method?: string
      on?: (e: string, cb: (chunk: Uint8Array) => void) => void
    }

    if (!incoming.url?.startsWith('/api/chat') || incoming.method !== 'POST') {
      return next()
    }

    try {
      const raw = incoming.on ? await readBody({ on: incoming.on }) : '{}'
      const body = JSON.parse(raw) as ChatProxyRequest
      const result = await forwardChatCompletion(body)
      sendJson(res, 200, result)
    } catch (e) {
      sendJson(res, 400, { error: e instanceof Error ? e.message : 'AI 请求失败' })
    }
  }
}
