import { normalizeChatEndpoint } from './chat-endpoint'
import { parseApiErrorMessage } from './parse-api-error'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatProxyRequest {
  baseUrl?: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  responseFormat?: 'json_object' | 'text'
}

export async function forwardChatCompletion(
  req: ChatProxyRequest,
): Promise<{ content: string }> {
  const apiKey = req.apiKey?.trim()
  if (!apiKey) throw new Error('未配置 API Key')

  const { endpoint, blocked } = normalizeChatEndpoint(req.baseUrl)
  if (blocked) throw new Error(blocked)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.85,
      ...(req.responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' } }
        : {}),
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`API 错误 ${res.status}: ${parseApiErrorMessage(raw, req.baseUrl)}`)
  }

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] }
  } catch {
    throw new Error('API 返回了无效 JSON')
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('API 返回为空')
  return { content }
}
