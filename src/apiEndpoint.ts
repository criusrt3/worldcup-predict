import type { ApiSettings } from './types'

export function resolveLlmEndpoint(settings: ApiSettings): string {
  if (!settings.useProxy) {
    return `${settings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  }
  return '/api/llm/v1/chat/completions'
}

export function formatApiError(status: number, errText: string, settings: ApiSettings): string {
  const snippet = errText.slice(0, 200)
  if (status === 404 && settings.useProxy) {
    const hint = import.meta.env.DEV
      ? '请确认已用 npm run dev 启动开发服务器。'
      : '线上部署需配置 /api/llm 代理（见 vercel.json），或关闭「API 代理」改为直连 Base URL。'
    return `API 请求失败 (${status})：代理路径 /api/llm 不可用。${hint} 原始响应：${snippet}`
  }
  return `API 请求失败 (${status}): ${snippet}`
}
