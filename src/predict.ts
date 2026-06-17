import type { ApiSettings, MatchStage, PredictionResult, TeamInfo } from './types'
import { localPredict } from './skillEngine'
import { loadSkill } from './skillLoader'

function parseJson(content: string): PredictionResult {
  const trimmed = content.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('模型未返回有效 JSON')
  const parsed = JSON.parse(jsonMatch[0]) as PredictionResult
  if (!parsed.teamA?.winProb || parsed.draw == null || !parsed.teamB?.winProb) {
    throw new Error('JSON 字段不完整')
  }
  return parsed
}

export async function predictMatch(
  teamA: TeamInfo,
  teamB: TeamInfo,
  stage: MatchStage,
  settings: ApiSettings,
): Promise<PredictionResult> {
  if (settings.demoMode || !settings.apiKey.trim()) {
    return localPredict(teamA, teamB, stage)
  }

  const skill = await loadSkill()
  const endpoint = settings.useProxy
    ? '/api/llm/v1/chat/completions'
    : `${settings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`

  const userPrompt = `请预测这场 2026 世界杯比赛:【${stage}】${teamA.name} vs ${teamB.name}。严格按约束文档的 JSON 格式输出，不要输出 JSON 以外的任何文字。`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: skill },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('API 返回为空')
  return parseJson(content)
}
