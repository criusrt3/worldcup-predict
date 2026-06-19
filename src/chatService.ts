import { callLlmChat, validateApiSettings } from './lib/chat-api-client'
import { normalizeChatReply } from './chatReplyFormat'
import { buildChatSystemPrompt } from './chatContext'
import { loadSkillForChat } from './skillLoader'
import { localChatReply } from './skillEngine'
import type { LiveScoreboard } from './liveScore'
import type { ApiSettings, ChatMessage } from './types'

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

  const keyError = validateApiSettings(settings)
  if (keyError) throw new Error(keyError)

  const skill = await loadSkillForChat()
  const system = buildChatSystemPrompt(skill, liveBoard)
  const recent = history.slice(-10)
  const content = await callLlmChat(
    settings,
    [
      { role: 'system', content: system },
      ...recent.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: trimmed },
    ],
    { temperature: 0.85 },
  )
  return normalizeChatReply(content)
}
