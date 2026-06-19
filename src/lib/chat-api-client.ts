import {
  API_PROVIDER_PRESETS,
  validateChatBaseUrl,
  type ApiProviderPreset,
} from '../../api/_lib/chat-endpoint'
import { validateChatModel } from '../../api/_lib/parse-api-error'
import type { ApiSettings } from '../types'

export { API_PROVIDER_PRESETS, type ApiProviderPreset }

export function validateApiSettings(settings: ApiSettings): string | null {
  if (settings.demoMode) return null

  const key = settings.apiKey.trim()
  if (!key) return '请先填入 API Key，或开启「本地神算」。'

  if (/^https?:\/\//i.test(key) || /\.(com|cn|net|io)\b/i.test(key)) {
    return 'API Key 填错了：你填的看起来像网址。请在「API Key」栏填入密钥，Base URL 填在下方单独一栏。'
  }

  const urlError = validateChatBaseUrl(settings.baseUrl)
  if (urlError) return urlError

  const modelError = validateChatModel(settings.baseUrl, settings.model)
  if (modelError) return modelError

  return null
}

export async function callLlmChat(
  settings: ApiSettings,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { temperature?: number; responseFormat?: 'json_object' | 'text' },
): Promise<string> {
  const blocked = validateChatBaseUrl(settings.baseUrl)
  if (blocked) throw new Error(blocked)

  const modelError = validateChatModel(settings.baseUrl, settings.model)
  if (modelError) throw new Error(modelError)

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      messages,
      temperature: options?.temperature,
      responseFormat: options?.responseFormat,
    }),
  })

  const raw = await res.text()
  let data: { content?: string; error?: string }
  try {
    data = JSON.parse(raw) as { content?: string; error?: string }
  } catch {
    if (raw.includes('Serverless Function') || raw.includes('FUNCTION_INVOCATION_FAILED')) {
      throw new Error('AI 服务未就绪，请确认已部署 /api/chat 并重新部署')
    }
    if (raw.includes('NOT_FOUND') || raw.includes('The page could not be found')) {
      throw new Error('AI 服务未就绪：/api/chat 不可用。请用 npm run dev 启动，或重新部署 Vercel。')
    }
    throw new Error('AI 服务返回了无效数据')
  }

  if (!res.ok) {
    throw new Error(data.error ?? `AI 请求失败 ${res.status}`)
  }
  if (!data.content) throw new Error('API 返回为空')
  return data.content
}
