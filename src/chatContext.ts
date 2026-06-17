import { GROUPS } from './data'
import type { LiveMatch, LiveScoreboard } from './liveScore'

export function buildLiveSnapshot(board: LiveScoreboard | null): string {
  if (!board?.matches.length) {
    return '【实时赛况快照】暂无已加载的赛程数据，请基于 skill 资料库回答。'
  }

  const lines = [
    `【实时赛况快照】更新于 ${board.fetchedAt}，全赛程 ${board.totalCount} 场（已完赛 ${board.finishedCount}，未开始 ${board.scheduledCount}）`,
  ]
  const live = board.matches.filter((m) => m.isLive)
  const finished = board.matches.filter((m) => m.status === 'finished').slice(0, 12)
  const upcoming = board.matches.filter((m) => m.status === 'scheduled').slice(0, 6)

  if (live.length) {
    lines.push('\n▶ 进行中：')
    live.forEach((m) => lines.push(formatMatchLine(m)))
  }
  if (finished.length) {
    lines.push('\n✓ 近期完场：')
    finished.forEach((m) => lines.push(formatMatchLine(m)))
  }
  if (upcoming.length) {
    lines.push('\n○ 未开始：')
    upcoming.forEach((m) => lines.push(formatMatchLine(m)))
  }
  return lines.join('\n')
}

function formatMatchLine(m: LiveMatch): string {
  const stage = m.stageLabel || m.stage
  const status = m.isLive ? m.clock : m.status === 'finished' ? '完场' : m.startTime
  return `- ${stage} | ${m.home.name} ${m.home.score}:${m.away.score} ${m.away.name}（${status}）${m.venue ? ` @ ${m.venue}` : ''}`
}

export function buildGroupsSnapshot(): string {
  const lines = ['【2026 世界杯分组速览】']
  for (const g of GROUPS) {
    lines.push(`${g.id} 组：${g.teams.map((t) => t.name).join('、')}`)
  }
  return lines.join('\n')
}

export function buildChatSystemPrompt(skill: string, liveBoard: LiveScoreboard | null): string {
  return `${skill}

---

## 对话问询模式（当前会话）

你是「绿茵神算」对话助手。用户以聊天方式提问，请用**自然中文**回答（不要强制 JSON）。

能力范围：
- 48 队资料、分组、赛程阶段说明
- 结合下方「实时赛况快照」解读比分、赛果、进行中比赛
- 战术/实力分析、出线形势、关键球员（基于资料库）
- 可帮用户梳理预测思路，但单场结构化预测仍建议用预测台

红线：严禁投注、赔率、下注建议。

${buildGroupsSnapshot()}

${buildLiveSnapshot(liveBoard)}
`
}
