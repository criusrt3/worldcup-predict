import { forwardChatCompletion } from './_lib/chat-proxy'
import type { ChatProxyRequest } from './_lib/chat-proxy'

export const config = {
  runtime: 'edge',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = (await request.json()) as ChatProxyRequest
    const result = await forwardChatCompletion(body)
    return jsonResponse(result)
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : '请求失败' },
      400,
    )
  }
}
