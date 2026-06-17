import { sendChatMessage } from './chatService'
import type { LiveScoreboard } from './liveScore'
import { clearChatHistory, loadChatHistory, saveChatHistory } from './storage'
import type { ApiSettings, ChatMessage } from './types'

const QUICK_PROMPTS = [
  '今天有哪些比赛？最新比分是什么？',
  '阿根廷本届表现怎么样？',
  'A 组出线形势怎么分析？',
  '巴西和摩洛哥谁更强？',
  '帮我预测一下法国对塞内加尔',
  '小组赛和淘汰赛规则是什么？',
]

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMarkdownLite(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

function renderMessage(msg: ChatMessage) {
  const isUser = msg.role === 'user'
  return `
    <div class="chat-msg chat-msg--${msg.role}">
      <div class="chat-avatar">${isUser ? '🧑' : '⚽'}</div>
      <div class="chat-bubble">
        <span class="chat-role">${isUser ? '你' : '绿茵神算'}</span>
        <div class="chat-text">${formatMarkdownLite(msg.content)}</div>
        ${msg.time ? `<time class="chat-time">${escapeHtml(msg.time)}</time>` : ''}
      </div>
    </div>
  `
}

export function renderChatShell() {
  return `
    <section class="chat-section" id="chat-section">
      <header class="chat-head">
        <div>
          <h2>💬 神算问答 · 对话模式</h2>
          <p class="chat-sub">本地读取 skill.md 资料库 + 赛况快照 · 无需 API 即可问答（大模型深度分析可切 API 模式）</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="clear-chat">清空对话</button>
      </header>

      <div class="chat-quick">
        ${QUICK_PROMPTS.map(
          (p) => `<button type="button" class="chat-quick-btn" data-quick="${escapeHtml(p)}">${escapeHtml(p)}</button>`,
        ).join('')}
      </div>

      <div class="chat-messages" id="chat-messages" aria-live="polite"></div>

      <form class="chat-composer" id="chat-form">
        <textarea id="chat-input" rows="2" placeholder="问我任何世界杯问题… 例如：阿根廷能卫冕吗？今天比分多少？" maxlength="2000"></textarea>
        <button type="submit" class="btn btn-primary btn-glow" id="chat-send">发送</button>
      </form>
    </section>
  `
}

export function createChatController(
  getSettings: () => ApiSettings,
  getLiveBoard: () => LiveScoreboard | null,
) {
  let messages: ChatMessage[] = loadChatHistory()
  let loading = false

  function now() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
  }

  function scrollToBottom() {
    const el = document.getElementById('chat-messages')
    if (el) el.scrollTop = el.scrollHeight
  }

  function paint() {
    const box = document.getElementById('chat-messages')
    if (!box) return

    if (!messages.length) {
      box.innerHTML = `
        <div class="chat-welcome">
          <div class="chat-welcome-icon">🏟️</div>
          <h3>你好，我是绿茵神算</h3>
          <p>默认本地神算：按 Skill 资料库规则分析。可问球队、分组、今日赛程、对阵预测等；完整赛况见「2026 实时世界杯」Tab。</p>
        </div>
      `
    } else {
      box.innerHTML =
        messages.map(renderMessage).join('') +
        (loading
          ? `<div class="chat-msg chat-msg--assistant chat-msg--typing"><div class="chat-avatar">⚽</div><div class="chat-bubble"><span class="chat-typing"><span></span><span></span><span></span></span></div></div>`
          : '')
    }
    scrollToBottom()
  }

  async function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed, time: now() }
    messages.push(userMsg)
    loading = true
    paint()

    const input = document.getElementById('chat-input') as HTMLTextAreaElement | null
    if (input) input.value = ''

    try {
      const reply = await sendChatMessage(trimmed, messages.slice(0, -1), getSettings(), getLiveBoard())
      messages.push({ role: 'assistant', content: reply, time: now() })
      saveChatHistory(messages)
    } catch (e) {
      messages.push({
        role: 'assistant',
        content: e instanceof Error ? e.message : '回复失败，请稍后重试',
        time: now(),
      })
    } finally {
      loading = false
      paint()
    }
  }

  function bind() {
    document.getElementById('chat-form')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const input = document.getElementById('chat-input') as HTMLTextAreaElement
      submit(input?.value ?? '')
    })

    document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) {
        e.preventDefault()
        const input = e.target as HTMLTextAreaElement
        submit(input.value)
      }
    })

    document.querySelectorAll('[data-quick]').forEach((el) => {
      el.addEventListener('click', () => submit((el as HTMLElement).dataset.quick!))
    })

    document.getElementById('clear-chat')?.addEventListener('click', () => {
      messages = []
      clearChatHistory()
      paint()
    })
  }

  return {
    paint,
    bind,
    submit,
    getMessages: () => messages,
  }
}
