export function enrichApiErrorMessage(message: string, baseUrl?: string): string {
  const msg = message.trim()
  if (/location is not supported|not available in your country|FAILED_PRECONDITION.*location/i.test(msg)) {
    return '当前地区无法直接使用该 API（常见于 Google Gemini 在中国大陆）。请改用 DeepSeek 或硅基流动预设。'
  }
  if (/GenerateContentRequest\.model|unexpected model name/i.test(msg)) {
    return '模型名格式不对：当前接口是 Google Gemini，模型须为 gemini-2.0-flash 等 gemini-* 名称。请在设置中点「Gemini 预设」。'
  }
  if (/invalid model|model not found|does not exist/i.test(msg) && /deepseek/i.test(baseUrl ?? '')) {
    return `${msg}。DeepSeek 常用模型：deepseek-chat、deepseek-reasoner。`
  }
  if (/authentication|invalid.*api key|invalid_request_error/i.test(msg)) {
    return `${msg}。请确认 API Key 栏填的是密钥（不是 Base URL），且与所选服务商匹配。`
  }
  return msg
}

export function parseApiErrorMessage(raw: string, baseUrl?: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const first = parsed[0] as { error?: { message?: string } } | undefined
      if (first?.error?.message) {
        return enrichApiErrorMessage(first.error.message, baseUrl)
      }
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as {
        error?: { message?: string } | string
        message?: string
      }
      if (typeof obj.error === 'object' && obj.error?.message) {
        return enrichApiErrorMessage(obj.error.message, baseUrl)
      }
      if (typeof obj.error === 'string') {
        return enrichApiErrorMessage(obj.error, baseUrl)
      }
      if (obj.message) return enrichApiErrorMessage(obj.message, baseUrl)
    }
  } catch {
    /* keep raw */
  }
  return enrichApiErrorMessage(raw.slice(0, 300), baseUrl)
}

export function isGeminiBaseUrl(baseUrl: string): boolean {
  return /generativelanguage\.googleapis\.com/i.test(baseUrl.trim())
}

export function validateChatModel(baseUrl: string, model: string): string | null {
  const m = model.trim()
  if (!m) return '请填写模型名'

  if (isGeminiBaseUrl(baseUrl)) {
    if (!/^gemini[\w.-]*/i.test(m)) {
      return `Gemini 接口的模型须为 gemini-* 格式（如 gemini-2.0-flash），当前「${m}」无效。`
    }
  }

  if (/deepseek\.com/i.test(baseUrl) && /^(gpt-|o\d)/i.test(m)) {
    return `DeepSeek 接口请用 deepseek-chat，不能填 ${m}`
  }

  if (/openai\.com/i.test(baseUrl) && /^gemini/i.test(m)) {
    return 'OpenAI 接口不能使用 gemini-* 模型名'
  }

  if (/siliconflow/i.test(baseUrl) && /^(gpt-4o-mini|deepseek-chat)$/i.test(m)) {
    return '硅基流动模型名通常带厂商前缀，如 deepseek-ai/DeepSeek-V3'
  }

  return null
}
