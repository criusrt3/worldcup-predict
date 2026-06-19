export const UNSUPPORTED_CHAT_API_MSG =
  '该 Base URL 不支持 Chat Completions，请使用 OpenAI、DeepSeek、硅基流动等兼容接口。'

export function isCursorOfficialApi(baseUrl: string): boolean {
  return /api\.cursor\.com/i.test(baseUrl.trim())
}

export function validateChatBaseUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim()
  if (!trimmed) return null
  if (isCursorOfficialApi(trimmed)) return UNSUPPORTED_CHAT_API_MSG
  if (/\/agents\b/i.test(trimmed)) {
    return '该地址为 Agent API，不能用于 Chat Completions。请填写 OpenAI 兼容的 Chat 地址。'
  }
  return null
}

export function normalizeChatEndpoint(baseUrl?: string): {
  endpoint: string
  blocked?: string
} {
  const trimmed = baseUrl?.trim() || 'https://api.openai.com/v1'
  const blocked = validateChatBaseUrl(trimmed)
  if (blocked) return { endpoint: '', blocked }

  let url = trimmed.replace(/\/$/, '')

  if (/\/v1\/agents$/i.test(url)) {
    return { endpoint: '', blocked: validateChatBaseUrl(url) ?? UNSUPPORTED_CHAT_API_MSG }
  }

  url = url.replace(/\/chat\/completions$/i, '')

  if (/generativelanguage\.googleapis\.com/i.test(url)) {
    if (!/\/openai$/i.test(url)) {
      if (/\/v1beta$/i.test(url)) url = `${url}/openai`
      else url = `${url}/v1beta/openai`
    }
    return { endpoint: `${url}/chat/completions` }
  }

  if (!/\/v\d+$/i.test(url) && /openai\.com$/i.test(url)) {
    url = `${url}/v1`
  }

  return { endpoint: `${url}/chat/completions` }
}

export const API_PROVIDER_PRESETS = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    hint: '官方 OpenAI API Key（sk-...）',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    hint: 'DeepSeek 开放平台 API Key',
  },
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    hint: 'Google AI Studio API Key；模型须为 gemini-*',
  },
  siliconflow: {
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    hint: '硅基流动 OpenAI 兼容接口',
  },
} as const

export type ApiProviderPreset = keyof typeof API_PROVIDER_PRESETS
