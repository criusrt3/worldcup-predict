import { formatApiError, resolveLlmEndpoint } from './apiEndpoint'
import { buildChatSystemPrompt } from './chatContext'
import { loadSkill } from './skillLoader'
import { localChatReply } from './skillEngine'
import type { LiveScoreboard } from './liveScore'
import type { ApiSettings, ChatMessage } from './types'

async function callChatApi(
  settings: ApiSettings,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const endpoint = resolveLlmEndpoint(settings)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(formatApiError(res.status, errText, settings))
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('AI 返回为空')
  return content
}

function mockReply(question: string, board: LiveScoreboard | null): Promise<string> {
  return localChatReply(question, board)
}

export async function sendChatMessage(
  question: string,
  history: ChatMessage[],
  settings: ApiSettings,
  liveBoard: LiveScoreboard | null,
): Promise<string> {
  const trimmed = question.trim()
  if (!trimmed) throw new Error('请输入问题')

  if (settings.demoMode || !settings.apiKey.trim()) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))
    return await mockReply(trimmed, liveBoard)
  }

  const skill = await loadSkill()
  const system = buildChatSystemPrompt(skill, liveBoard)
  const recent = history.slice(-10)
  return callChatApi(settings, system, [...recent, { role: 'user', content: trimmed }])
}
